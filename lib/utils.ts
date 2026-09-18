import { getAddress, isAddress } from "viem";

/** Canonical storage form for wallet addresses: lowercase hex. */
export function normalizeAddress(address: string): string {
  return address.trim().toLowerCase();
}

/** EIP-55 checksummed form, used for display and on-chain calls. */
export function checksumAddress(address: string): `0x${string}` {
  return getAddress(address.trim());
}

export function isValidAddress(value: string): boolean {
  return isAddress(value.trim());
}

export function shortenAddress(address: string, chars = 4): string {
  if (address.length < chars * 2 + 2) return address;
  return `${address.slice(0, 2 + chars)}…${address.slice(-chars)}`;
}

/**
 * Points are whole numbers in the UI; on-chain they are ERC-20 base units.
 * Kept as BigInt so 18-decimal amounts never touch IEEE-754 floats.
 */
export function pointsToWei(points: number | bigint, decimals = 18): bigint {
  return BigInt(points) * 10n ** BigInt(decimals);
}

export function weiToPoints(wei: bigint | string, decimals = 18): number {
  const value = typeof wei === "string" ? BigInt(wei) : wei;
  return Number(value / 10n ** BigInt(decimals));
}

// Excludes vowels and lookalike characters so codes cannot spell anything and
// cannot be misread when dictated out loud.
const JOIN_CODE_ALPHABET = "3479BCDFGHJKLMNPQRTVWXY";

export function generateJoinCode(length = 6): string {
  let code = "";
  for (let i = 0; i < length; i += 1) {
    code += JOIN_CODE_ALPHABET.charAt(
      Math.floor(Math.random() * JOIN_CODE_ALPHABET.length),
    );
  }
  return code;
}

export function normalizeJoinCode(code: string): string {
  return code.trim().toUpperCase().replace(/[\s-]/g, "");
}

export function classNames(
  ...values: Array<string | false | null | undefined>
): string {
  return values.filter(Boolean).join(" ");
}
