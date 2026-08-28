import { cookies } from 'next/headers'
import { z } from 'zod'
import { db } from '@/lib/db'
import { HttpError, ok, readJson, route } from '@/lib/api'
import { pengalihAkunAktif } from '@/lib/dev'
import { SESSION_COOKIE, SESSION_MAX_AGE, createSessionToken } from '@/server/auth'
import type { Division, Role } from '@/server/shared/constants'

const skema = z.object({ userId: z.string().min(1) })

/** Masuk sebagai pengguna lain tanpa kata sandi — hanya saat pengembangan. */
export const POST = route(async (request: Request) => {
  if (!pengalihAkunAktif()) {
    // 404, bukan 403: keberadaan fitur ini pun tidak perlu terbaca.
    throw new HttpError(404, 'Tidak ditemukan.', 'NOT_FOUND')
  }

  const { userId } = await readJson(request, (value) => {
    const hasil = skema.safeParse(value)
    if (!hasil.success) throw new HttpError(400, 'Akun tidak sah.', 'VALIDATION_ERROR')
    return hasil.data
  })

  const user = await db.user.findUnique({ where: { id: userId } })
  if (!user) throw new HttpError(404, 'Akun tidak ditemukan.', 'USER_NOT_FOUND')
  if (!user.isActive) {
    throw new HttpError(403, 'Akun sudah dinonaktifkan.', 'ACCOUNT_INACTIVE')
  }

  const session = {
    userId: user.id,
    role: user.role as Role,
    division: user.division as Division,
    name: user.name,
  }

  ;(await cookies()).set(SESSION_COOKIE, await createSessionToken(session, new Date()), {
    httpOnly: true,
    sameSite: 'lax',
    secure: false, // fitur ini memang hanya hidup di lingkungan pengembangan
    path: '/',
    maxAge: SESSION_MAX_AGE,
  })

  return ok(session)
})
