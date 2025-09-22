/* @vitest-environment node */
import { describe, it, expect } from 'vitest'
import { hashPassword, verifyPassword, validatePassword } from '../utils/password'

describe('password utils (Argon2id via oslo)', () => {
  it('hashes and verifies a valid password', async () => {
    const plain = 'correct-horse-battery-staple'
    const hash = await hashPassword(plain)
    expect(hash).toBeTypeOf('string')
    expect(hash.length).toBeGreaterThan(0)

    const ok = await verifyPassword(plain, hash)
    expect(ok).toBe(true)
  })

  it('fails verification for wrong password', async () => {
    const hash = await hashPassword('topsecret!')
    const ok = await verifyPassword('wrongsecret!', hash)
    expect(ok).toBe(false)
  })

  it('enforces minimum length policy', () => {
    const res = validatePassword('short')
    expect(res.valid).toBe(false)
  })
})
