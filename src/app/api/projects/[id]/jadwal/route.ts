import { z } from 'zod'
import { HttpError, ok, readJson, requireActor, route } from '@/lib/api'
import { rescheduleProject } from '@/server/lifecycle'

const skema = z.object({
  startDate: z.string().datetime({ offset: true }),
  endDate: z.string().datetime({ offset: true }),
})

export const PATCH = route(
  async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
    await requireActor('project:write')
    const { id } = await ctx.params

    const body = await readJson(request, (value) => {
      const hasil = skema.safeParse(value)
      if (!hasil.success) {
        throw new HttpError(400, hasil.error.issues[0].message, 'VALIDATION_ERROR')
      }
      return hasil.data
    })

    // Urutan tanggal divalidasi oleh assertProjectDates di lapisan domain.
    const project = await rescheduleProject({
      projectId: id,
      startDate: new Date(body.startDate),
      endDate: new Date(body.endDate),
    })
    return ok(project)
  },
)
