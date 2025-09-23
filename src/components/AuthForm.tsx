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
    <div className="w-full max-w-md mx-auto">
      {/* Main Container with modern styling */}
      <div className="bg-gray-900 bg-opacity-90 rounded-lg shadow-2xl p-8 backdrop-blur-sm border border-indigo-500/30">
        {/* Header */}
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400 mb-2">
            Welcome to Spritel
          </h2>
          <p className="text-gray-300 text-sm">
            {mode === 'login' ? 'Sign in to continue your adventure' : 'Create your account to begin'}
          </p>
        </div>

        {/* Mode Toggle */}
        <div className="flex gap-1 mb-6 p-1 bg-gray-800 rounded-lg">
          <button 
            className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
              mode === 'login'
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg'
                : 'text-gray-400 hover:text-white hover:bg-gray-700'
            }`} 
            onClick={() => setMode('login')}
          >
            Sign In
          </button>
          <button 
            className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
              mode === 'register'
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg'
                : 'text-gray-400 hover:text-white hover:bg-gray-700'
            }`} 
            onClick={() => setMode('register')}
          >
            Sign Up
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-1">
                Name (optional)
              </label>
              <input 
                id="name"
                className="w-full px-4 py-3 bg-gray-800 rounded-lg border border-gray-600 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200" 
                placeholder="Enter your name" 
                value={name} 
                onChange={e => setName(e.target.value)} 
              />
            </div>
          )}
          
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1">
              Email
            </label>
            <input 
              id="email"
              className="w-full px-4 py-3 bg-gray-800 rounded-lg border border-gray-600 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200" 
              placeholder="Enter your email" 
              type="email" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              required 
            />
          </div>
          
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1">
              Password
            </label>
            <input 
              id="password"
              className="w-full px-4 py-3 bg-gray-800 rounded-lg border border-gray-600 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200" 
              placeholder="Enter your password" 
              type="password" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              required 
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-900/50 border border-red-500/50 rounded-lg">
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          )}

          {/* Submit Button */}
          <button 
            className={`w-full px-6 py-3 rounded-lg font-bold text-lg transition-all duration-200 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${
              loading
                ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg hover:shadow-indigo-500/50'
            }`}
            type="submit" 
            disabled={loading}
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {mode === 'login' ? 'Signing in...' : 'Creating account...'}
              </span>
            ) : (
              mode === 'login' ? 'Sign In' : 'Create Account'
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-gray-400 text-xs">
            By continuing, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </div>
    </div>
  )
}
