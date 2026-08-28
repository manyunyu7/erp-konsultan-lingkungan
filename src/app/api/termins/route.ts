import { z } from 'zod'
import { HttpError, ok, readJson, requireActor, route } from '@/lib/api'
import { createTerminPlan } from '@/server/finance'

const skema = z.object({
  projectId: z.string().min(1, 'Proyek wajib dipilih.'),
  percentages: z.array(z.union([z.number(), z.string().min(1)])),
  plannedDates: z.array(z.string().datetime({ offset: true })),
})

export const POST = route(async (request: Request) => {
  await requireActor('invoice:write')

  const body = await readJson(request, (value) => {
    const hasil = skema.safeParse(value)
    if (!hasil.success) {
      throw new HttpError(400, hasil.error.issues[0].message, 'VALIDATION_ERROR')
    }
    return hasil.data
  })

  // Rentang 20-30/40-50/20-30 dan total 100% dijaga di lapisan domain.
  const termins = await createTerminPlan({
    projectId: body.projectId,
    percentages: body.percentages,
    plannedDates: body.plannedDates.map((tanggal) => new Date(tanggal)),
  })
  return ok(termins, 201)
})
