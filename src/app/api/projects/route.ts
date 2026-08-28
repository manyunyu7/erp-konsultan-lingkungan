import { z } from 'zod'
import { db } from '@/lib/db'
import { HttpError, ok, readJson, requireActor, route } from '@/lib/api'
import { convertTenderToProject } from '@/server/lifecycle'

export const GET = route(async () => {
  await requireActor('project:read')
  const projects = await db.project.findMany({
    orderBy: { endDate: 'asc' },
    include: {
      client: { select: { name: true } },
      projectManager: { select: { name: true } },
      termins: { orderBy: { sequence: 'asc' } },
      deliverables: { orderBy: { dueDate: 'asc' } },
      bast: true,
      csat: true,
    },
  })
  return ok(projects)
})

const skemaProyek = z.object({
  tenderId: z.string().min(1, 'Tender wajib dipilih.'),
  code: z.string().min(3, 'Kode Job Order minimal 3 karakter.'),
  name: z.string().min(3, 'Nama proyek wajib diisi.'),
  documentType: z.enum(['AMDAL', 'UKL_UPL', 'DELH', 'DPLH']),
  startDate: z.string().datetime({ offset: true }),
  endDate: z.string().datetime({ offset: true }),
})

export const POST = route(async (request: Request) => {
  await requireActor('project:write')

  const body = await readJson(request, (value) => {
    const hasil = skemaProyek.safeParse(value)
    if (!hasil.success) {
      throw new HttpError(400, hasil.error.issues[0].message, 'VALIDATION_ERROR')
    }
    return hasil.data
  })

  const ganda = await db.project.findUnique({ where: { code: body.code } })
  if (ganda) {
    throw new HttpError(409, `Kode Job Order ${body.code} sudah dipakai.`, 'PROJECT_CODE_TAKEN')
  }

  // Syarat tender WON, nilai kontrak, dan rentang tanggal dijaga di lapisan domain.
  const project = await convertTenderToProject({
    tenderId: body.tenderId,
    code: body.code,
    name: body.name,
    documentType: body.documentType,
    startDate: new Date(body.startDate),
    endDate: new Date(body.endDate),
  })
  return ok(project, 201)
})
