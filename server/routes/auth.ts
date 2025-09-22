import { prisma as realPrisma, lucia as realLucia, validateRequest as realValidateRequest } from "../auth/lucia";
import { hashPassword as realHashPassword, verifyPassword as realVerifyPassword, validatePassword as realValidatePassword } from "../utils/password";

function json(data: any, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

function getPath(req: Request): string {
  return new URL(req.url).pathname;
}

function setCookieHeaders(res: Response, cookies: string[]) {
  cookies.forEach((c) => res.headers.append("Set-Cookie", c));
}

export type AuthDeps = {
  prisma: typeof realPrisma;
  lucia: typeof realLucia;
  validateRequest: typeof realValidateRequest;
  hashPassword: typeof realHashPassword;
  verifyPassword: typeof realVerifyPassword;
  validatePassword: typeof realValidatePassword;
};

export function createAuthRouter(deps?: Partial<AuthDeps>) {
  const prisma = deps?.prisma ?? (realPrisma as any);
  const lucia = deps?.lucia ?? (realLucia as any);
  const validateRequest = deps?.validateRequest ?? realValidateRequest;
  const hashPassword = deps?.hashPassword ?? realHashPassword;
  const verifyPassword = deps?.verifyPassword ?? realVerifyPassword;
  const validatePassword = deps?.validatePassword ?? realValidatePassword;

  return async function routeAuth(req: Request): Promise<Response> {
  const path = getPath(req);
  try {
    if (req.method === "POST" && path === "/api/auth/register") {
      const body = await req.json().catch(() => ({}));
      const { email, password, name } = body as { email?: string; password?: string; name?: string };
      if (!email || !password) return json({ error: "Email and password are required" }, { status: 400 });
      const policy = validatePassword(password);
      if (!policy.valid) return json({ error: policy.reason }, { status: 400 });

      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) return json({ error: "Email already in use" }, { status: 409 });

      const passwordHash = await hashPassword(password);
      const user = await prisma.user.create({
        data: { id: crypto.randomUUID(), email, password: passwordHash, name: name ?? null },
      });

      const session = await lucia.createSession(user.id, {});
      const sessionCookie = lucia.createSessionCookie(session.id);

      const res = json({ user: { id: user.id, email: user.email, name: user.name, isActive: user.isActive } }, { status: 201 });
      setCookieHeaders(res, [
        `${sessionCookie.name}=${sessionCookie.value}; Path=/; SameSite=${sessionCookie.attributes.sameSite}; ${sessionCookie.attributes.secure ? "Secure; " : ""}HttpOnly; Max-Age=${sessionCookie.attributes.maxAge ?? 0}`,
      ]);
      return res;
    }

    if (req.method === "POST" && path === "/api/auth/login") {
      const body = await req.json().catch(() => ({}));
      const { email, password } = body as { email?: string; password?: string };
      if (!email || !password) return json({ error: "Email and password are required" }, { status: 400 });

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) return json({ error: "Invalid credentials" }, { status: 401 });

      const valid = await verifyPassword(password, user.password);
      if (!valid) return json({ error: "Invalid credentials" }, { status: 401 });

      const session = await lucia.createSession(user.id, {});
      const sessionCookie = lucia.createSessionCookie(session.id);

      const res = json({ user: { id: user.id, email: user.email, name: user.name, isActive: user.isActive } });
      setCookieHeaders(res, [
        `${sessionCookie.name}=${sessionCookie.value}; Path=/; SameSite=${sessionCookie.attributes.sameSite}; ${sessionCookie.attributes.secure ? "Secure; " : ""}HttpOnly; Max-Age=${sessionCookie.attributes.maxAge ?? 0}`,
      ]);
      return res;
    }

    if (req.method === "GET" && path === "/api/auth/me") {
      const { user } = await validateRequest(req);
      if (!user) return json({ user: null }, { status: 200 });
      return json({ user });
    }

    if (req.method === "POST" && path === "/api/auth/logout") {
      const { session } = await validateRequest(req);
      // Always clear cookie, even if session is missing or invalid
      if (session) {
        await lucia.invalidateSession(session.id);
      }
      const blank = lucia.createBlankSessionCookie();
      const res = json({ ok: true });
      setCookieHeaders(res, [
        `${blank.name}=${blank.value}; Path=/; SameSite=${blank.attributes.sameSite}; ${blank.attributes.secure ? "Secure; " : ""}HttpOnly; Max-Age=${blank.attributes.maxAge ?? 0}`,
      ]);
      return res;
    }

    return json({ error: "Not Found" }, { status: 404 });
  } catch (err) {
    console.error("/api/auth error", err);
    return json({ error: "Internal Server Error" }, { status: 500 });
  }
  };
}

// Default router using real dependencies
export const routeAuth = createAuthRouter();
