import { cookies } from 'next/headers'
import { z } from 'zod'
import { HttpError, ok, readJson, route } from '@/lib/api'
import { SESSION_COOKIE, SESSION_MAX_AGE, login } from '@/server/auth'

const schema = z.object({
  email: z.string().email('Format email tidak sah.'),
  password: z.string().min(1, 'Kata sandi wajib diisi.'),
})

export const POST = route(async (request: Request) => {
  const body = await readJson(request, (value) => {
    const hasil = schema.safeParse(value)
    if (!hasil.success) {
      throw new HttpError(400, hasil.error.issues[0].message, 'VALIDATION_ERROR')
    }
    return hasil.data
  })

  const { token, session } = await login(body.email, body.password, new Date())

  ;(await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true, // tidak bisa dibaca skrip di peramban
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  })

  return ok(session)
})
