import { z } from 'zod'
import { HttpError, ok, readJson, requireActor, route } from '@/lib/api'
import { sendCsatSurvey } from '@/server/lifecycle'

const skema = z.object({
  projectId: z.string().min(1, 'Proyek wajib dipilih.'),
})

export const POST = route(async (request: Request) => {
  await requireActor('csat:write')

  const body = await readJson(request, (value) => {
    const hasil = skema.safeParse(value)
    if (!hasil.success) {
      throw new HttpError(400, hasil.error.issues[0].message, 'VALIDATION_ERROR')
    }
    return hasil.data
  })

  // Syarat BAST tertanda tangan dijaga di lapisan domain.
  const survey = await sendCsatSurvey({ projectId: body.projectId, now: new Date() })
  return ok(survey, 201)
})
