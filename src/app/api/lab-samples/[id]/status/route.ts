import { z } from 'zod'
import { HttpError, ok, readJson, requireActor, route } from '@/lib/api'
import { changeLabSampleStatus } from '@/server/lifecycle'

const skema = z.object({
  status: z.enum(['COLLECTED', 'SENT', 'TESTED', 'REPORTED']),
})

export const PATCH = route(
  async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
    await requireActor('deliverable:write')
    const { id } = await ctx.params

    const body = await readJson(request, (value) => {
      const hasil = skema.safeParse(value)
      if (!hasil.success) {
        throw new HttpError(400, hasil.error.issues[0].message, 'VALIDATION_ERROR')
      }
      return hasil.data
    })

    // Syarat nomor Chain of Custody sebelum SENT dijaga di lapisan domain.
    const sample = await changeLabSampleStatus({ labSampleId: id, to: body.status })
    return ok(sample)
  },
)
