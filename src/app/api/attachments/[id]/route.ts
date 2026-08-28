import { ok, requireActor, route } from '@/lib/api'
import { deleteAttachment, getAttachment, writePermissionFor } from '@/server/attachments'

export const DELETE = route(
  async (_request: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params

    // Berkas dibaca lebih dulu untuk mengetahui entitasnya, karena izin yang
    // berlaku ditentukan oleh entitas yang dilampiri.
    const lampiran = await getAttachment(id)
    await requireActor(writePermissionFor(lampiran.entityType))

    return ok(await deleteAttachment(id))
  },
)
