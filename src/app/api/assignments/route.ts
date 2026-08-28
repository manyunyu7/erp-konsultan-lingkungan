import { z } from 'zod'
import { HttpError, ok, readJson, requireActor, route } from '@/lib/api'
import { assignPersonnelToProject } from '@/server/hr'

const skemaPenugasan = z.object({
  projectId: z.string().min(1, 'Proyek wajib dipilih.'),
  personnelId: z.string().min(1, 'Personel wajib dipilih.'),
  role: z.string().min(2, 'Peran dalam tim wajib diisi.'),
  startDate: z.string().datetime({ offset: true }),
  endDate: z.string().datetime({ offset: true }).optional(),
})

export const POST = route(async (request: Request) => {
  await requireActor('project:write')

  const body = await readJson(request, (value) => {
    const hasil = skemaPenugasan.safeParse(value)
    if (!hasil.success) {
      throw new HttpError(400, hasil.error.issues[0].message, 'VALIDATION_ERROR')
    }
    return hasil.data
  })

  // Gate kelayakan sertifikat sepenuhnya dijaga lapisan domain.
  const assignment = await assignPersonnelToProject({
    projectId: body.projectId,
    personnelId: body.personnelId,
    role: body.role,
    startDate: new Date(body.startDate),
    endDate: body.endDate ? new Date(body.endDate) : null,
  })
  return ok(assignment, 201)
})
