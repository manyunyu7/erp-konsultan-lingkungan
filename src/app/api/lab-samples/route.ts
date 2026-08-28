import { z } from 'zod'
import { db } from '@/lib/db'
import { HttpError, ok, readJson, requireActor, route } from '@/lib/api'
import { assertLaboratoryName } from '@/server/lifecycle'

const skemaSampel = z.object({
  projectId: z.string().min(1, 'Proyek wajib dipilih.'),
  sampleCode: z.string().min(1, 'Kode sampel wajib diisi.'),
  matrix: z.enum(['AIR', 'UDARA', 'TANAH', 'FLORA', 'FAUNA', 'SOSEKBUD']),
  location: z.string().min(3, 'Lokasi pengambilan wajib diisi.'),
  takenAt: z.string().datetime({ offset: true }),
  laboratory: z.string().min(1, 'Laboratorium wajib diisi.'),
  cocNumber: z.string().optional(),
})

export const POST = route(async (request: Request) => {
  await requireActor('deliverable:write')

  const body = await readJson(request, (value) => {
    const hasil = skemaSampel.safeParse(value)
    if (!hasil.success) {
      throw new HttpError(400, hasil.error.issues[0].message, 'VALIDATION_ERROR')
    }
    return hasil.data
  })

  const project = await db.project.findUnique({ where: { id: body.projectId } })
  if (!project) {
    throw new HttpError(404, 'Proyek tidak ditemukan.', 'PROJECT_NOT_FOUND')
  }

  // Syarat laboratorium terakreditasi datang dari lapisan domain.
  assertLaboratoryName(body.laboratory)

  const sample = await db.labSample.create({
    data: {
      ...body,
      takenAt: new Date(body.takenAt),
      cocNumber: body.cocNumber?.trim() || null,
    },
  })
  return ok(sample, 201)
})
