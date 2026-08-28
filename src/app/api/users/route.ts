import { z } from 'zod'
import { db } from '@/lib/db'
import { HttpError, ok, readJson, requireActor, route } from '@/lib/api'
import { hashPassword, normalizeEmail } from '@/server/auth'
import { DIVISIONS, ROLES } from '@/server/shared/constants'

/** Kata sandi tidak pernah ikut dikirim, bahkan dalam bentuk hash. */
const KOLOM_AMAN = {
  id: true,
  name: true,
  email: true,
  role: true,
  division: true,
  isActive: true,
  createdAt: true,
} as const

export const GET = route(async () => {
  await requireActor('user:read')
  const users = await db.user.findMany({
    orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    select: KOLOM_AMAN,
  })
  return ok(users)
})

const skemaBuat = z.object({
  name: z.string().min(3, 'Nama minimal 3 karakter.'),
  email: z.string().email('Format email tidak sah.'),
  role: z.enum(ROLES),
  division: z.enum(DIVISIONS),
  password: z.string().min(1, 'Kata sandi wajib diisi.'),
})

export const POST = route(async (request: Request) => {
  await requireActor('user:write')

  const body = await readJson(request, (value) => {
    const hasil = skemaBuat.safeParse(value)
    if (!hasil.success) {
      throw new HttpError(400, hasil.error.issues[0].message, 'VALIDATION_ERROR')
    }
    return hasil.data
  })

  const email = normalizeEmail(body.email)
  if (await db.user.findUnique({ where: { email } })) {
    throw new HttpError(409, `Email ${email} sudah terdaftar.`, 'EMAIL_TAKEN')
  }

  // Aturan kekuatan kata sandi dijaga hashPassword, bukan diulang di sini.
  const user = await db.user.create({
    data: {
      name: body.name,
      email,
      role: body.role,
      division: body.division,
      passwordHash: await hashPassword(body.password),
    },
    select: KOLOM_AMAN,
  })

  return ok(user, 201)
})
