import { z } from 'zod'
import { HttpError, ok, readJson, requireActor, route } from '@/lib/api'
import { MANPOWER_REQUEST_STATUSES, transitionManpowerRequest } from '@/server/hr'

const skema = z.object({ status: z.enum(MANPOWER_REQUEST_STATUSES) })

export const PATCH = route(
  async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
    await requireActor('personnel:write')
    const { id } = await ctx.params

    const body = await readJson(request, (value) => {
      const hasil = skema.safeParse(value)
      if (!hasil.success) {
        throw new HttpError(400, hasil.error.issues[0].message, 'VALIDATION_ERROR')
      }
      return hasil.data
    })

    // Transisi status F-HR-01 yang sah ditentukan lapisan domain.
    const updated = await transitionManpowerRequest(id, body.status)
    return ok(updated)
  },
)
