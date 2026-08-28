import { z } from 'zod'
import { db } from '@/lib/db'
import { HttpError, ok, readJson, requireActor, route } from '@/lib/api'
import { startDeliverableStage } from '@/server/lifecycle'

/** LAB_TEST tidak punya Deliverable sendiri — tahap itu diwakili sampel lab. */
const skemaDeliverable = z.object({
  projectId: z.string().min(1, 'Proyek wajib dipilih.'),
  type: z.enum(['DESK_STUDY', 'SAMPLING_PLAN', 'DRAFT_REPORT', 'EXPOSE', 'FINAL_REPORT']),
  name: z.string().min(3, 'Nama pekerjaan wajib diisi.'),
  dueDate: z.string().datetime({ offset: true }),
})

export const POST = route(async (request: Request) => {
  await requireActor('deliverable:write')

  const body = await readJson(request, (value) => {
    const hasil = skemaDeliverable.safeParse(value)
    if (!hasil.success) {
      throw new HttpError(400, hasil.error.issues[0].message, 'VALIDATION_ERROR')
    }
    return hasil.data
  })

  // Gate urutan tahapan wajib ada di domain; route hanya mencatat hasilnya.
  await startDeliverableStage({ projectId: body.projectId, stage: body.type })

  const deliverable = await db.deliverable.create({
    data: { ...body, dueDate: new Date(body.dueDate) },
  })
  return ok(deliverable, 201)
})
