import { z } from 'zod'
import { HttpError, ok, readJson, requireActor, route } from '@/lib/api'
import { KPI_PERIOD_TYPES, createKpiEvaluation } from '@/server/hr'

const skemaKpi = z.object({
  personnelId: z.string().min(1, 'Personel wajib dipilih.'),
  periodType: z.enum(KPI_PERIOD_TYPES),
  periodYear: z.number().int().optional(),
  projectId: z.string().optional(),
  punctualityScore: z.number().int(),
  qualityScore: z.number().int(),
  teamworkScore: z.number().int(),
  note: z.string().optional(),
})

export const POST = route(async (request: Request) => {
  await requireActor('kpi:write')

  const body = await readJson(request, (value) => {
    const hasil = skemaKpi.safeParse(value)
    if (!hasil.success) {
      throw new HttpError(400, hasil.error.issues[0].message, 'VALIDATION_ERROR')
    }
    return hasil.data
  })

  // Rentang skor, pembobotan, dan kecocokan periode dinilai di lapisan domain.
  const evaluation = await createKpiEvaluation({
    personnelId: body.personnelId,
    periodType: body.periodType,
    periodYear: body.periodYear ?? null,
    projectId: body.projectId ?? null,
    punctualityScore: body.punctualityScore,
    qualityScore: body.qualityScore,
    teamworkScore: body.teamworkScore,
    note: body.note ?? null,
    evaluatedAt: new Date(),
  })
  return ok(evaluation, 201)
})
