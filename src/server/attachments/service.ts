import { mkdir, unlink, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { db } from '@/lib/db'
import { BusinessRuleError } from '@/server/shared/constants'
import {
  assertAttachableEntity,
  assertSizeAllowed,
  assertTypeAllowed,
  buildStoredPath,
  sanitizeDisplayName,
} from './rules'

/**
 * Berkas disimpan di luar direktori publik supaya tidak dapat diambil begitu
 * saja lewat URL statis; setiap pengambilan harus melewati pemeriksaan izin.
 */
export function storageRoot(): string {
  return resolve(process.env.UPLOAD_DIR ?? 'storage/uploads')
}

/** Jalur mutlak sebuah berkas, dengan penjagaan agar tetap di dalam akar. */
export function absolutePathFor(storedPath: string): string {
  const akar = storageRoot()
  const penuh = resolve(join(akar, storedPath))
  if (penuh !== akar && !penuh.startsWith(akar + '/')) {
    throw new BusinessRuleError('Jalur berkas tidak sah.', 'INVALID_STORED_PATH')
  }
  return penuh
}

export interface UploadInput {
  entityType: string
  entityId: string
  originalName: string
  mimeType: string
  bytes: Uint8Array
  caption?: string
  uploadedById: string
  now: Date
}

export async function saveAttachment(input: UploadInput) {
  assertAttachableEntity(input.entityType)
  const kind = assertTypeAllowed(input.mimeType)
  assertSizeAllowed(input.bytes.byteLength)

  // Baris dibuat lebih dulu agar pengenalnya dipakai sebagai nama berkas —
  // dengan begitu nama di penyimpanan sepenuhnya kita yang tentukan.
  const id = crypto.randomUUID()
  const storedPath = buildStoredPath(input.mimeType, id, input.now)
  const tujuan = absolutePathFor(storedPath)

  await mkdir(dirname(tujuan), { recursive: true })
  await writeFile(tujuan, input.bytes)

  return db.attachment.create({
    data: {
      id,
      entityType: input.entityType,
      entityId: input.entityId,
      kind,
      originalName: sanitizeDisplayName(input.originalName),
      storedPath,
      mimeType: input.mimeType,
      sizeBytes: input.bytes.byteLength,
      caption: input.caption?.trim() || null,
      uploadedById: input.uploadedById,
    },
  })
}

export async function listAttachments(entityType: string, entityId: string) {
  assertAttachableEntity(entityType)
  return db.attachment.findMany({
    where: { entityType, entityId },
    orderBy: { createdAt: 'desc' },
    include: { uploadedBy: { select: { name: true } } },
  })
}

export async function getAttachment(id: string) {
  const berkas = await db.attachment.findUnique({ where: { id } })
  if (!berkas) {
    throw new BusinessRuleError('Berkas tidak ditemukan.', 'ATTACHMENT_NOT_FOUND')
  }
  return berkas
}

export async function deleteAttachment(id: string) {
  const berkas = await getAttachment(id)

  // Baris dihapus lebih dulu; berkas yatim di disk jauh lebih ringan
  // akibatnya daripada baris yang menunjuk berkas yang sudah lenyap.
  await db.attachment.delete({ where: { id } })
  try {
    await unlink(absolutePathFor(berkas.storedPath))
  } catch {
    // Berkas mungkin sudah hilang; penghapusan tetap dianggap berhasil.
  }
  return berkas
}
