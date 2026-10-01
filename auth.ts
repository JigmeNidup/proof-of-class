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
    async jwt({ token, user }) {
      if (user) {
        token.id = (user.id as string) || token.id;
        token.address = user.address;
        token.role = user.role;
        token.trainerStatus = user.trainerStatus;
      }

      // Re-read trainer fields on every session check. Approval happens in
      // another tab (the owner's dashboard), so a JWT minted as TRAINEE/PENDING
      // would otherwise keep the approved trainer off the dashboard until they
      // signed in again. Looking at the database here means they just refresh.
      if (token.id) {
        try {
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
        } catch (error) {
          console.error("[auth] jwt trainer refresh failed", error);
        }
      }

      return token;
    },
    async session({ session, token }) {
      session.user = session.user ?? ({} as typeof session.user);
      if (token.id) session.user.id = token.id;
      if (token.address) session.user.address = token.address;
      session.user.role = token.role ?? "TRAINEE";
      if (token.trainerStatus) session.user.trainerStatus = token.trainerStatus;
      return session;
    },
  },
});
