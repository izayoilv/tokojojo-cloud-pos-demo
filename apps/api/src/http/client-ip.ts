import { isIP } from "node:net";

type HeaderValue = string | string[] | undefined;

export type HeaderSource =
  { get(name: string): string | null } | Record<string, HeaderValue>;

export interface ResolveClientIpInput {
  peerAddress?: string | null;
  headers: HeaderSource;
  trustedProxies?: readonly string[];
}

export function parseTrustedProxies(
  value: string | null | undefined,
): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function headerValue(headers: HeaderSource, name: string): string | null {
  if ("get" in headers && typeof headers.get === "function") {
    return headers.get(name);
  }
  const value = (headers as Record<string, HeaderValue>)[name];
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function normalizeAddress(value: string | null | undefined): string | null {
  if (!value) return null;
  let address = value.trim();
  if (!address) return null;
  if (address.startsWith("::ffff:")) address = address.slice(7);
  if (address.startsWith("[") && address.includes("]")) {
    address = address.slice(1, address.indexOf("]"));
  }
  return isIP(address) ? address : null;
}

function ipv4ToNumber(address: string): number | null {
  if (isIP(address) !== 4) return null;
  return address
    .split(".")
    .map(Number)
    .reduce((value, part) => value * 256 + part, 0);
}

function isLoopback(address: string): boolean {
  return address === "::1" || address.startsWith("127.");
}

function matchesTrustedProxy(address: string, entry: string): boolean {
  if (entry === "loopback") return isLoopback(address);
  if (entry.includes("/")) {
    const [network, prefixText] = entry.split("/");
    const networkNumber = ipv4ToNumber(network ?? "");
    const addressNumber = ipv4ToNumber(address);
    const prefix = Number(prefixText);
    if (
      networkNumber === null ||
      addressNumber === null ||
      !Number.isInteger(prefix) ||
      prefix < 0 ||
      prefix > 32
    ) {
      return false;
    }
    const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
    return (addressNumber & mask) === (networkNumber & mask);
  }
  return address === normalizeAddress(entry);
}

function isTrustedPeer(
  peerAddress: string,
  trustedProxies: readonly string[],
): boolean {
  return trustedProxies.some((entry) =>
    matchesTrustedProxy(peerAddress, entry),
  );
}

function firstForwardedAddress(value: string | null): string | null {
  if (!value) return null;
  for (const part of value.split(",")) {
    const address = normalizeAddress(part);
    if (address) return address;
  }
  return null;
}

/**
 * One resolver for Express, GraphQL context, nonce, and rate limiters.
 * Forwarded headers are only trusted when the direct peer is configured as a
 * trusted proxy; otherwise the socket address is authoritative.
 */
export function resolveClientIp(input: ResolveClientIpInput): string {
  const peer = normalizeAddress(input.peerAddress) ?? "unknown";
  const trustedProxies = input.trustedProxies ?? [];
  if (peer === "unknown" || !isTrustedPeer(peer, trustedProxies)) {
    return peer;
  }

  const cloudflare = normalizeAddress(
    headerValue(input.headers, "cf-connecting-ip"),
  );
  if (cloudflare) return cloudflare;

  const forwarded = firstForwardedAddress(
    headerValue(input.headers, "x-forwarded-for"),
  );
  return forwarded ?? peer;
}
