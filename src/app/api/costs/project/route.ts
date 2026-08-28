import { z } from 'zod'
import { HttpError, ok, readJson, requireActor, route } from '@/lib/api'
import { createProjectCost } from '@/server/finance'

const skemaNominal = z.union([z.number(), z.string().min(1)])

const skema = z.object({
  projectId: z.string().min(1, 'Proyek wajib dipilih.'),
  category: z.string().min(1, 'Kategori biaya wajib dipilih.'),
  description: z.string().min(3, 'Uraian biaya wajib diisi.'),
  amount: skemaNominal,
  incurredAt: z.string().datetime({ offset: true }),
})

export const POST = route(async (request: Request) => {
  const actor = await requireActor('cost:write')

  const body = await readJson(request, (value) => {
    const hasil = skema.safeParse(value)
    if (!hasil.success) {
      throw new HttpError(400, hasil.error.issues[0].message, 'VALIDATION_ERROR')
    }
    return hasil.data
  })

  // Syarat kontrak/SPK sudah diteken diperiksa di lapisan domain.
  const cost = await createProjectCost({
    projectId: body.projectId,
    category: body.category,
    description: body.description,
    amount: body.amount,
    incurredAt: new Date(body.incurredAt),
    requestedById: actor.id,
  })
  return ok(cost, 201)
})
