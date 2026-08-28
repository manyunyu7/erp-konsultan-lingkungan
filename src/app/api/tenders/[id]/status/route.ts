import { z } from 'zod'
import { HttpError, ok, readJson, requireActor, route } from '@/lib/api'
import { changeTenderStatus } from '@/server/lifecycle'

const skema = z.object({
  status: z.enum(['IDENTIFIED', 'PREPARING', 'SUBMITTED', 'WON', 'LOST', 'CANCELLED']),
})

export const PATCH = route(
  async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
    await requireActor('tender:write')
    const { id } = await ctx.params

    const body = await readJson(request, (value) => {
      const hasil = skema.safeParse(value)
      if (!hasil.success) {
        throw new HttpError(400, hasil.error.issues[0].message, 'VALIDATION_ERROR')
      }
      return hasil.data
    })

    // Aturan transisi dan gate tenggat dijaga di lapisan domain, bukan di sini.
    const tender = await changeTenderStatus({
      tenderId: id,
      to: body.status,
      now: new Date(),
    })
    return ok(tender)
  },
)
