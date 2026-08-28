import { HttpError, ok, requireActor, route } from '@/lib/api'
import {
  MAX_SIZE_BYTES,
  listAttachments,
  readPermissionFor,
  saveAttachment,
  writePermissionFor,
} from '@/server/attachments'

export const GET = route(async (request: Request) => {
  const { searchParams } = new URL(request.url)
  const entityType = searchParams.get('entityType') ?? ''
  const entityId = searchParams.get('entityId') ?? ''

  if (!entityType || !entityId) {
    throw new HttpError(400, 'entityType dan entityId wajib diisi.', 'VALIDATION_ERROR')
  }

  // Izin ditentukan entitas yang dilampiri: dokumen kontrak dijaga izin
  // kontrak, foto lapangan dijaga izin pekerjaan teknis, dan seterusnya.
  await requireActor(readPermissionFor(entityType))

  return ok(await listAttachments(entityType, entityId))
})

export const POST = route(async (request: Request) => {
  const form = await request.formData().catch(() => null)
  if (!form) {
    throw new HttpError(400, 'Permintaan bukan unggahan berkas.', 'INVALID_FORM')
  }

  const entityType = String(form.get('entityType') ?? '')
  const entityId = String(form.get('entityId') ?? '')
  const berkas = form.get('file')

  if (!entityType || !entityId) {
    throw new HttpError(400, 'entityType dan entityId wajib diisi.', 'VALIDATION_ERROR')
  }
  if (!(berkas instanceof File)) {
    throw new HttpError(400, 'Berkas belum dipilih.', 'FILE_MISSING')
  }
  // Dicegat lebih awal agar berkas raksasa tidak perlu dibaca ke memori.
  if (berkas.size > MAX_SIZE_BYTES) {
    throw new HttpError(
      413,
      `Ukuran berkas melebihi ${Math.round(MAX_SIZE_BYTES / 1024 / 1024)} MB.`,
      'FILE_TOO_LARGE',
    )
  }

  const actor = await requireActor(writePermissionFor(entityType))

  const lampiran = await saveAttachment({
    entityType,
    entityId,
    originalName: berkas.name,
    mimeType: berkas.type,
    bytes: new Uint8Array(await berkas.arrayBuffer()),
    caption: String(form.get('caption') ?? '') || undefined,
    uploadedById: actor.id,
    now: new Date(),
  })

  return ok(lampiran, 201)
})
