// Centralized env-driven cookie/session options for Lucia
// This file will be extended in later issues to include Lucia + Prisma adapter setup.
import { PrismaClient } from "@prisma/client";
import { PrismaAdapter } from "@lucia-auth/adapter-prisma";
import { Lucia } from "lucia";

const env = (name: string, fallback?: string): string => {
  const v = process.env[name];
  if (v === undefined || v === null || v === "") return fallback ?? "";
  return v;
};

export const NODE_ENV = env("NODE_ENV", "development");
export const IS_PROD = NODE_ENV === "production";

export const LUCIA_SESSION_COOKIE_NAME = env(
  "LUCIA_SESSION_COOKIE_NAME",
  "spritel_session"
);

export const SESSION_TTL = Number.parseInt(env("SESSION_TTL", "86400"), 10);

export type CookieAttributes = {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax" | "strict" | "none";
  path: string;
  maxAge?: number; // seconds
  domain?: string;
};

export type CookieConfig = {
  name: string;
  attributes: CookieAttributes;
};

export function getSessionCookieConfig(ttlSeconds: number = SESSION_TTL): CookieConfig {
  return {
    name: LUCIA_SESSION_COOKIE_NAME,
    attributes: {
      httpOnly: true,
      secure: IS_PROD, // must be true in production (HTTPS)
      sameSite: "lax",
      path: "/",
      maxAge: ttlSeconds,
    },
  };
}

// Helper to create a Set-Cookie header value (basic)
export function buildSetCookie(name: string, value: string, attrs: CookieAttributes): string {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    `Path=${attrs.path}`,
    attrs.maxAge !== undefined ? `Max-Age=${attrs.maxAge}` : undefined,
    `SameSite=${attrs.sameSite.charAt(0).toUpperCase() + attrs.sameSite.slice(1)}`,
    attrs.secure ? "Secure" : undefined,
    attrs.httpOnly ? "HttpOnly" : undefined,
    attrs.domain ? `Domain=${attrs.domain}` : undefined,
  ].filter(Boolean) as string[];
  return parts.join("; ");
}

// --- Lucia + Prisma adapter setup ---
export const prisma = new PrismaClient();

const adapter = new PrismaAdapter(prisma.session, prisma.user);

const cookieCfg = getSessionCookieConfig();

export const lucia = new Lucia(adapter, {
  sessionCookie: {
    name: cookieCfg.name,
    attributes: {
      secure: cookieCfg.attributes.secure,
      sameSite: cookieCfg.attributes.sameSite,
      // maxAge is applied when creating cookies for new/updated sessions
    },
  },
  // Map only the attributes you want to expose to the client
  getUserAttributes: (databaseUser: any) => {
    return {
      id: databaseUser.id,
      name: databaseUser.name ?? null,
      email: databaseUser.email,
      isActive: databaseUser.isActive,
    };
  },
});

// Parse Cookie header into a map
function parseCookies(header: string | null): Record<string, string> {
  const result: Record<string, string> = {};
  if (!header) return result;
  header.split(';').forEach((part) => {
    const [k, ...rest] = part.trim().split('=');
    if (!k) return;
    result[k] = decodeURIComponent(rest.join('='));
  });
  return result;
}

// Validate request using Lucia session cookie
export async function validateRequest(req: Request) {
  const cookieHeader = req.headers.get('cookie');
  const cookies = parseCookies(cookieHeader);
  const sessionId = cookies[cookieCfg.name];
  if (!sessionId) return { user: null, session: null } as const;

  const { user, session } = await lucia.validateSession(sessionId);
  return { user, session } as const;
}
