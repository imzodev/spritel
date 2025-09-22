import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_BASE ?? '' // e.g., '' or 'http://localhost:3001'

export const http = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

export type UserDto = {
  id: string
  email: string
  name?: string | null
  isActive?: boolean
}

export async function register(email: string, password: string, name?: string) {
  const { data } = await http.post<{ user: UserDto }>('/api/auth/register', {
    email,
    password,
    name,
  })
  return data.user
}

export async function login(email: string, password: string) {
  const { data } = await http.post<{ user: UserDto }>('/api/auth/login', {
    email,
    password,
  })
  return data.user
}

export async function me() {
  const { data } = await http.get<{ user: UserDto | null }>('/api/auth/me')
  return data.user
}

export async function logout() {
  await http.post('/api/auth/logout')
}
