import { useState } from 'react'
import { login, register, type UserDto } from '../services/auth'

export default function AuthForm({ onAuthed }: { onAuthed?: (user: UserDto) => void }) {
  const [mode, setMode] = useState<'login'|'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      let u: UserDto
      if (mode === 'register') {
        u = await register(email, password, name || undefined)
      } else {
        u = await login(email, password)
      }
      onAuthed?.(u)
      setPassword('')
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-4 border rounded bg-white/70 max-w-md">
      <div className="flex gap-2 mb-3">
        <button className={`px-3 py-1 rounded ${mode==='login'?'bg-gray-900 text-white':'bg-gray-200'}`} onClick={() => setMode('login')}>Login</button>
        <button className={`px-3 py-1 rounded ${mode==='register'?'bg-gray-900 text-white':'bg-gray-200'}`} onClick={() => setMode('register')}>Register</button>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        {mode==='register' && (
          <input className="border rounded px-2 py-1" placeholder="Name (optional)" value={name} onChange={e=>setName(e.target.value)} />
        )}
        <input className="border rounded px-2 py-1" placeholder="Email" type="email" value={email} onChange={e=>setEmail(e.target.value)} required />
        <input className="border rounded px-2 py-1" placeholder="Password" type="password" value={password} onChange={e=>setPassword(e.target.value)} required />
        {error && <div className="text-red-600 text-sm">{error}</div>}
        <button className="px-3 py-2 bg-blue-600 text-white rounded" type="submit" disabled={loading}>
          {loading ? 'Please wait…' : (mode==='login'?'Login':'Create account')}
        </button>
      </form>
    </div>
  )
}
