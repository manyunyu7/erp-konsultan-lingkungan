import { z } from 'zod'
import { db } from '@/lib/db'
import { HttpError, ok, readJson, requireActor, route } from '@/lib/api'
import { EMPLOYMENT_TYPES } from '@/server/hr'

export const GET = route(async () => {
  await requireActor('personnel:read')
  const personnel = await db.personnel.findMany({
    orderBy: { fullName: 'asc' },
    include: {
      certifications: { orderBy: { expiresAt: 'asc' } },
      assignments: { include: { project: { select: { code: true } } } },
    },
  })
  return ok(personnel)
})

const skemaPersonel = z.object({
  fullName: z.string().min(3, 'Nama lengkap minimal 3 karakter.'),
  employmentType: z.enum(EMPLOYMENT_TYPES),
  position: z.string().min(2, 'Jabatan wajib diisi.'),
  expertise: z.string().optional(),
  joinedAt: z.string().datetime({ offset: true }).optional(),
})

export const POST = route(async (request: Request) => {
  await requireActor('personnel:write')

  const body = await readJson(request, (value) => {
    const hasil = skemaPersonel.safeParse(value)
    if (!hasil.success) {
      throw new HttpError(400, hasil.error.issues[0].message, 'VALIDATION_ERROR')
    }
    return hasil.data
  })

  const personnel = await db.personnel.create({
    data: {
      fullName: body.fullName,
      employmentType: body.employmentType,
      position: body.position,
      expertise: body.expertise ?? null,
      joinedAt: body.joinedAt ? new Date(body.joinedAt) : null,
    },
  })
  return ok(personnel, 201)
})
