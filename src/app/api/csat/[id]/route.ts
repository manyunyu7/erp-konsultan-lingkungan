import { z } from 'zod'
import { HttpError, ok, readJson, requireActor, route } from '@/lib/api'
import { recordCsatResponse } from '@/server/lifecycle'

const skor = z.number().int().min(0).max(100)

const skema = z.object({
  technicalScore: skor,
  timelinessScore: skor,
  responsivenessScore: skor,
  complianceScore: skor,
  comment: z.string().optional(),
})

/** `id` di sini adalah projectId — survei CSAT unik per proyek. */
export const PATCH = route(
  async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
    await requireActor('csat:write')
    const { id } = await ctx.params

    const body = await readJson(request, (value) => {
      const hasil = skema.safeParse(value)
      if (!hasil.success) {
        throw new HttpError(400, hasil.error.issues[0].message, 'VALIDATION_ERROR')
      }
      return hasil.data
    })

    const { comment, ...scores } = body

    // Pembobotan 35/25/20/20 dan kategorinya dihitung di lapisan domain.
    const hasil = await recordCsatResponse({
      projectId: id,
      scores,
      comment: comment?.trim() || undefined,
      now: new Date(),
    })
    return ok(hasil)
  },
)
