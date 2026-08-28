import { z } from 'zod'
import { HttpError, ok, readJson, requireActor, route } from '@/lib/api'
import { issueBast } from '@/server/lifecycle'

const skemaBast = z.object({
  projectId: z.string().min(1, 'Proyek wajib dipilih.'),
  number: z.string().min(3, 'Nomor BAST wajib diisi.'),
  signedAt: z.string().datetime({ offset: true }),
  permitNumber: z.string().optional(),
})

export const POST = route(async (request: Request) => {
  await requireActor('project:write')

  const body = await readJson(request, (value) => {
    const hasil = skemaBast.safeParse(value)
    if (!hasil.success) {
      throw new HttpError(400, hasil.error.issues[0].message, 'VALIDATION_ERROR')
    }
    return hasil.data
  })

  // Syarat laporan final APPROVED dijaga di lapisan domain.
  const bast = await issueBast({
    projectId: body.projectId,
    number: body.number,
    signedAt: new Date(body.signedAt),
    permitNumber: body.permitNumber?.trim() || undefined,
  })
  return ok(bast, 201)
})
