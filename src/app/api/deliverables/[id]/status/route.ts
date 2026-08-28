import { z } from 'zod'
import { HttpError, ok, readJson, requireActor, route } from '@/lib/api'
import { changeDeliverableStatus } from '@/server/lifecycle'

const skema = z.object({
  status: z.enum(['PENDING', 'IN_PROGRESS', 'QC_REVIEW', 'SUBMITTED', 'APPROVED']),
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

    // Gerbang QC sebelum SUBMITTED dijaga di lapisan domain.
    const deliverable = await changeDeliverableStatus({
      deliverableId: id,
      to: body.status,
      now: new Date(),
    })
    return ok(deliverable)
  },
)
