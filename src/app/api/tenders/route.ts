import { z } from 'zod'
import { db } from '@/lib/db'
import { HttpError, ok, readJson, requireActor, route } from '@/lib/api'

export const GET = route(async () => {
  await requireActor('tender:read')
  const tenders = await db.tender.findMany({
    orderBy: { submissionDeadline: 'asc' },
    include: { client: { select: { name: true } }, project: { select: { code: true } } },
  })
  return ok(tenders)
})

const skemaTender = z.object({
  code: z.string().min(3, 'Kode tender minimal 3 karakter.'),
  title: z.string().min(3, 'Judul tender wajib diisi.'),
  clientId: z.string().min(1, 'Klien wajib dipilih.'),
  source: z.enum(['LPSE', 'BUMN', 'SWASTA', 'PENUNJUKAN_LANGSUNG']),
  description: z.string().optional(),
  torSummary: z.string().optional(),
  estimatedValue: z.number().nonnegative().optional(),
  bidValue: z.number().nonnegative().optional(),
  winRateProbability: z.number().int().min(0).max(100).optional(),
  submissionDeadline: z.string().datetime({ offset: true }),
})

export const POST = route(async (request: Request) => {
  await requireActor('tender:write')

  const body = await readJson(request, (value) => {
    const hasil = skemaTender.safeParse(value)
    if (!hasil.success) {
      throw new HttpError(400, hasil.error.issues[0].message, 'VALIDATION_ERROR')
    }
    return hasil.data
  })

  const ganda = await db.tender.findUnique({ where: { code: body.code } })
  if (ganda) {
    throw new HttpError(409, `Kode tender ${body.code} sudah dipakai.`, 'TENDER_CODE_TAKEN')
  }

  const tender = await db.tender.create({
    data: { ...body, submissionDeadline: new Date(body.submissionDeadline) },
  })
  return ok(tender, 201)
})
