/* @vitest-environment node */
import 'dotenv/config'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createAuthRouter } from '../routes/auth'
import { hashPassword } from '../utils/password'

// Base URL: prefer VITE_API_URL from .env, fallback to localhost:3001
const TEST_BASE_URL = process.env.VITE_API_URL || 'http://localhost:3001'

function buildReq(method: string, path: string, body?: any, cookie?: string) {
  return new Request(TEST_BASE_URL + path, {
    method,
    headers: {
      'content-type': body ? 'application/json' : undefined,
      ...(cookie ? { cookie } : {}),
    } as any,
    body: body ? JSON.stringify(body) : undefined,
  })
}

function getSetCookies(res: Response): string[] {
  const values: string[] = []
  res.headers.forEach((v, k) => {
    if (k.toLowerCase() === 'set-cookie') values.push(v)
  })
  return values
}

describe('auth routes', () => {
  const userStore: any[] = []
  const sessions = new Map<string, { id: string; userId: string }>()
  const prisma = {
    user: {
      findUnique: vi.fn(async ({ where: { email } }: any) => userStore.find(u => u.email === email) ?? null),
      create: vi.fn(async ({ data }: any) => { userStore.push(data); return data; }),
    },
  } as any
  const lucia = {
    createSession: vi.fn(async (userId: string) => { const id = 'sess_' + Math.random().toString(36).slice(2); const s = { id, userId }; sessions.set(id, s); return s }),
    createSessionCookie: vi.fn((sessionId: string) => ({ name: 'spritel_session', value: sessionId, attributes: { sameSite: 'Lax', secure: false, maxAge: 86400 } })),
    createBlankSessionCookie: vi.fn(() => ({ name: 'spritel_session', value: '', attributes: { sameSite: 'Lax', secure: false, maxAge: 0 } })),
    invalidateSession: vi.fn(async (id: string) => { sessions.delete(id) }),
  } as any
  const validateRequest = vi.fn(async (req: Request) => {
    const cookie = req.headers.get('cookie') || ''
    const match = cookie.match(/spritel_session=([^;]+)/)
    const id = match?.[1]
    if (!id) return { user: null, session: null } as const
    const s = sessions.get(id)
    if (!s) return { user: null, session: null } as const
    const user = userStore.find(u => u.id === s.userId) ?? null
    return { user, session: s } as const
  })

  const routeAuth = createAuthRouter({
    prisma: prisma as any,
    lucia: lucia as any,
    validateRequest: validateRequest as any,
    hashPassword: (pwd: string) => hashPassword(pwd),
    verifyPassword: async (plain: string, hash: string) => {
      // Use actual Argon2id verify
      const { Argon2id } = await import('oslo/password')
      const a = new Argon2id()
      return a.verify(hash, plain)
    },
    validatePassword: (pwd: string) => ({ valid: pwd.length >= 8 } as any),
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('registers a new user and sets session cookie', async () => {
    const req = buildReq('POST', '/api/auth/register', { email: 'a@b.com', password: 'password123', name: 'A' })
    const res = await routeAuth(req)
    expect(res.status).toBe(201)
    const body = await res.json() as any
    expect(body.user.email).toBe('a@b.com')
    const cookies = getSetCookies(res)
    expect(cookies.length).toBeGreaterThan(0)
    expect(cookies[0]).toMatch(/spritel_session=/)
  })

  it('logs in an existing user and sets session cookie', async () => {
    // First register user with a known hash
    const pwd = await hashPassword('password123')
    const register = buildReq('POST', '/api/auth/register', { email: 'login@b.com', password: 'password123', name: 'B' })
    await routeAuth(register)

    const res = await routeAuth(buildReq('POST', '/api/auth/login', { email: 'login@b.com', password: 'password123' }))
    expect(res.status).toBe(200)
    const cookies = getSetCookies(res)
    expect(cookies[0]).toMatch(/spritel_session=/)
  })

  it('me returns null when not authenticated', async () => {
    const res = await routeAuth(buildReq('GET', '/api/auth/me'))
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.user).toBeNull()
  })

  it('logout invalidates session and clears cookie', async () => {
    const reg = await routeAuth(buildReq('POST', '/api/auth/register', { email: 'out@b.com', password: 'password123' }))
    const cookie = getSetCookies(reg)[0]
    const res = await routeAuth(buildReq('POST', '/api/auth/logout', undefined, cookie))
    expect(res.status).toBe(200)
    const setCookies = getSetCookies(res)
    expect(setCookies[0]).toMatch(/spritel_session=/)
    expect(setCookies[0]).toMatch(/Max-Age=0/)
  })
})
