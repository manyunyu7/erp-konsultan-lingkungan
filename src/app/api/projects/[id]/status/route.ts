import { z } from 'zod'
import { HttpError, ok, readJson, requireActor, route } from '@/lib/api'
import { changeProjectStatus } from '@/server/lifecycle'

const skema = z.object({
  status: z.enum(['PREPARATION', 'RUNNING', 'REPORTING', 'CLOSING', 'CLOSED', 'CANCELLED']),
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

    // Prasyarat kontrak (RUNNING) dan BAST (CLOSED) dijaga di lapisan domain.
    const project = await changeProjectStatus({ projectId: id, to: body.status })
    return ok(project)
  },
)
