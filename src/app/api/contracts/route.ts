import { z } from 'zod'
import { db } from '@/lib/db'
import { HttpError, ok, readJson, requireActor, route } from '@/lib/api'

const skemaKontrak = z.object({
  projectId: z.string().min(1, 'Proyek wajib dipilih.'),
  type: z.enum(['SPK', 'LOA', 'PKS', 'ADDENDUM']),
  number: z.string().min(3, 'Nomor kontrak wajib diisi.'),
  signedAt: z.string().datetime({ offset: true }),
  validUntil: z.string().datetime({ offset: true }),
  documentUrl: z.string().url('Tautan dokumen tidak sah.').optional(),
})

export const POST = route(async (request: Request) => {
  await requireActor('contract:write')

  const body = await readJson(request, (value) => {
    const hasil = skemaKontrak.safeParse(value)
    if (!hasil.success) {
      throw new HttpError(400, hasil.error.issues[0].message, 'VALIDATION_ERROR')
    }
    return hasil.data
  })

  const project = await db.project.findUnique({ where: { id: body.projectId } })
  if (!project) {
    throw new HttpError(404, 'Proyek tidak ditemukan.', 'PROJECT_NOT_FOUND')
  }

  const contract = await db.contract.create({
    data: {
      ...body,
      signedAt: new Date(body.signedAt),
      validUntil: new Date(body.validUntil),
      documentUrl: body.documentUrl ?? null,
    },
  })
  return ok(contract, 201)
})
