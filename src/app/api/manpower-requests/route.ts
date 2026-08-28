import { z } from 'zod'
import { db } from '@/lib/db'
import { HttpError, ok, readJson, requireActor, route } from '@/lib/api'
import { EMPLOYMENT_TYPES, createManpowerRequest } from '@/server/hr'

export const GET = route(async () => {
  await requireActor('personnel:read')
  const requests = await db.manpowerRequest.findMany({
    orderBy: { createdAt: 'desc' },
    include: { requestedBy: { select: { name: true } } },
  })
  return ok(requests)
})

const skemaKebutuhan = z.object({
  formNumber: z.string().min(3, 'Nomor form F-HR-01 wajib diisi.'),
  position: z.string().min(2, 'Posisi wajib diisi.'),
  employmentType: z.enum(EMPLOYMENT_TYPES),
  qualification: z.string().min(1, 'Kualifikasi wajib diisi.'),
  certifications: z.string().min(1, 'Sertifikasi yang dibutuhkan wajib diisi.'),
  quantity: z.number().int(),
  neededBy: z.string().datetime({ offset: true }),
})

export const POST = route(async (request: Request) => {
  const actor = await requireActor('personnel:write')

  const body = await readJson(request, (value) => {
    const hasil = skemaKebutuhan.safeParse(value)
    if (!hasil.success) {
      throw new HttpError(400, hasil.error.issues[0].message, 'VALIDATION_ERROR')
    }
    return hasil.data
  })

  // Pengaju diambil dari sesi, bukan dari badan permintaan, supaya jejak
  // pertanggungjawaban F-HR-01 tidak bisa dipalsukan klien.
  const created = await createManpowerRequest(
    { ...body, neededBy: new Date(body.neededBy), requestedById: actor.id },
    new Date(),
  )
  return ok(created, 201)
})
