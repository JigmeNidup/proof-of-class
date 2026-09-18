import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";

import { isPlatformOwner } from "@/lib/platform";
import { prisma } from "@/lib/prisma";
import { csrfNonceFromCookieHeader, verifySiwe } from "@/lib/siwe";

const siweCredentialsSchema = z.object({
  message: z.string().min(1),
  signature: z.string().regex(/^0x[0-9a-fA-F]+$/),
});

function expectedDomain(request: Request): string {
  const configured = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL;
  if (configured) {
    try {
      return new URL(configured).host;
    } catch {
      // fall through to the request host
    }
  }
  return new URL(request.url).host;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 30 },
  trustHost: true,
  pages: { signIn: "/signin" },
  providers: [
    Credentials({
      id: "siwe",
      name: "Ethereum",
      credentials: {
        message: { label: "Message", type: "text" },
        signature: { label: "Signature", type: "text" },
      },
      async authorize(credentials, request) {
        const parsed = siweCredentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const nonce = csrfNonceFromCookieHeader(
          request.headers.get("cookie"),
        );
        if (!nonce) return null;

        const result = await verifySiwe(
          parsed.data.message,
          parsed.data.signature as `0x${string}`,
          { domain: expectedDomain(request), nonce },
        );
        if (!result.ok) return null;

        // The env owner is always a trainer. Everyone else starts as a trainee
        // and stays that way until they apply and the owner approves.
        const owner = isPlatformOwner(result.address);
        const user = await prisma.user.upsert({
          where: { walletAddress: result.address },
          update: owner
            ? { role: "TRAINER", trainerStatus: "APPROVED" }
            : {},
          create: {
            walletAddress: result.address,
            role: owner ? "TRAINER" : "TRAINEE",
            trainerStatus: owner ? "APPROVED" : "NONE",
          },
        });

        return {
          id: user.id,
          name: user.displayName ?? user.walletAddress,
          address: user.walletAddress,
          role: user.role,
          trainerStatus: user.trainerStatus,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id as string;
        token.address = user.address;
        token.role = user.role;
        token.trainerStatus = user.trainerStatus;
      } else if (token.id && !token.trainerStatus) {
        // Sessions minted before trainerStatus existed on the JWT.
        const fresh = await prisma.user.findUnique({
          where: { id: token.id },
          select: { trainerStatus: true, role: true },
        });
        if (fresh) {
          token.trainerStatus = fresh.trainerStatus;
          token.role = fresh.role;
        }
      }

      // Role can change after sign-in (the owner approved, or the applicant
      // just submitted), so refresh it when the client calls update().
      if (trigger === "update" && token.id) {
        const fresh = await prisma.user.findUnique({
          where: { id: token.id },
          select: {
            role: true,
            trainerStatus: true,
            walletAddress: true,
            displayName: true,
          },
        });
        if (fresh) {
          token.role = fresh.role;
          token.trainerStatus = fresh.trainerStatus;
          token.address = fresh.walletAddress;
          token.name = fresh.displayName ?? fresh.walletAddress;
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (token.id) session.user.id = token.id;
      if (token.address) session.user.address = token.address;
      if (token.role) session.user.role = token.role;
      if (token.trainerStatus) session.user.trainerStatus = token.trainerStatus;
      return session;
    },
  },
});
