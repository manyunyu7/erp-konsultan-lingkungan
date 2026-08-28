import { z } from 'zod'
import { HttpError, ok, readJson, requireActor, route } from '@/lib/api'
import { decideBiddingApproval } from '@/server/finance'

const skema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED']),
  note: z.string().optional(),
})

export const PATCH = route(
  async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
    const actor = await requireActor('cost:approve')
    const { id } = await ctx.params

    const body = await readJson(request, (value) => {
      const hasil = skema.safeParse(value)
      if (!hasil.success) {
        throw new HttpError(400, hasil.error.issues[0].message, 'VALIDATION_ERROR')
      }
      return hasil.data
    })

    // Peran penyetuju diambil dari sesi, bukan dari badan permintaan: kalau
    // dikirim klien, siapa pun bisa mengaku Direktur dan melewati gate dua-peran.
    const cost = await decideBiddingApproval({
      costEntryId: id,
      approverId: actor.id,
      role: actor.role,
      decision: body.decision,
      note: body.note,
      now: new Date(),
    })
    return ok(cost)
  },
)
