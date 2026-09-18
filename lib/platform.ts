/**
 * The platform owner: the one account that can approve trainers.
 *
 * Deliberately configuration rather than a database role. There is no API that
 * grants it, so it cannot be escalated by editing a row or by replaying a
 * request - and it survives a database reset. The address itself is not a
 * secret (addresses never are); authority comes from proving control of it
 * through SIWE, which is why the same value is safe to expose to the browser
 * for showing the admin link.
 */
import { normalizeAddress } from "@/lib/utils";

const configured = (
  process.env.NEXT_PUBLIC_PLATFORM_OWNER_ADDRESS ?? ""
).trim();

/** Null when unset or malformed, which leaves nobody able to approve. */
export const PLATFORM_OWNER_ADDRESS: string | null = /^0x[0-9a-fA-F]{40}$/.test(
  configured,
)
  ? normalizeAddress(configured)
  : null;

export function hasPlatformOwner(): boolean {
  return PLATFORM_OWNER_ADDRESS !== null;
}

export function isPlatformOwner(address?: string | null): boolean {
  if (!PLATFORM_OWNER_ADDRESS || !address) return false;
  return normalizeAddress(address) === PLATFORM_OWNER_ADDRESS;
}
