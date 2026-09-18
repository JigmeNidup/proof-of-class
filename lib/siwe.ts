import { recoverMessageAddress, type Hex } from "viem";
import { parseSiweMessage, validateSiweMessage } from "viem/siwe";

import { normalizeAddress } from "./utils";

export type SiweVerification =
  | { ok: true; address: string; chainId: number }
  | { ok: false; reason: string };

/**
 * Verifies an EIP-4361 sign-in.
 *
 * Recovery is done locally with `recoverMessageAddress` rather than viem's
 * `verifySiweMessage` action, so signing in never depends on an RPC being
 * reachable. Smart-contract wallets (EIP-1271) are therefore out of scope here.
 */
export async function verifySiwe(
  rawMessage: string,
  signature: Hex,
  expected: { domain: string; nonce: string },
): Promise<SiweVerification> {
  let parsed;
  try {
    parsed = parseSiweMessage(rawMessage);
  } catch {
    return { ok: false, reason: "malformed_message" };
  }

  if (!parsed.address) return { ok: false, reason: "missing_address" };
  if (!parsed.nonce) return { ok: false, reason: "missing_nonce" };

  // Binds the signature to this origin and to a nonce we issued, so a
  // signature captured on another site cannot be replayed here.
  const valid = validateSiweMessage({
    message: parsed,
    domain: expected.domain,
    nonce: expected.nonce,
  });
  if (!valid) return { ok: false, reason: "domain_or_nonce_mismatch" };

  let recovered: string;
  try {
    recovered = await recoverMessageAddress({
      message: rawMessage,
      signature,
    });
  } catch {
    return { ok: false, reason: "unrecoverable_signature" };
  }

  if (normalizeAddress(recovered) !== normalizeAddress(parsed.address)) {
    return { ok: false, reason: "signer_mismatch" };
  }

  return {
    ok: true,
    address: normalizeAddress(parsed.address),
    chainId: parsed.chainId ?? 0,
  };
}

/**
 * Auth.js stores the CSRF cookie as `token|hash`; `getCsrfToken()` on the
 * client returns just the token half, which is what the SIWE nonce carries.
 */
export function csrfNonceFromCookieHeader(
  cookieHeader: string | null | undefined,
): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(
    /(?:^|;\s*)(?:__Host-|__Secure-)?authjs\.csrf-token=([^;]+)/,
  );
  if (!match) return null;
  const [token] = decodeURIComponent(match[1]).split("|");
  return token || null;
}
