import { validateRequest as realValidateRequest } from "../auth/lucia";

export type ValidateRequest = typeof realValidateRequest;

export type SessionUser = {
  user: any | null;
  session: any | null;
};

export function createAuthMiddleware(deps?: { validateRequest?: ValidateRequest }) {
  const validateRequest = deps?.validateRequest ?? realValidateRequest;

  async function getSessionUser(req: Request): Promise<SessionUser> {
    const { user, session } = await validateRequest(req);
    return { user, session } as const;
  }

  // Returns 401 Response when unauthenticated, otherwise the { user, session } object.
  async function requireAuth(req: Request): Promise<Response | SessionUser> {
    const result = await getSessionUser(req);
    if (!result.user || !result.session) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
    return result;
  }

  return { getSessionUser, requireAuth } as const;
}

export const { getSessionUser, requireAuth } = createAuthMiddleware();
