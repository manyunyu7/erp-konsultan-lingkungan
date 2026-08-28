import { BusinessRuleError } from '@/server/shared/constants'
import type { Permission } from '@/server/auth/rules'

/**
 * Aturan penerimaan berkas.
 *
 * Unggahan berkas adalah permukaan serangan klasik, jadi tiga hal dijaga:
 * jenis berkas dibatasi daftar putih, ukuran dibatasi, dan nama berkas di
 * penyimpanan TIDAK PERNAH berasal dari nama kiriman pengguna — nama kiriman
 * hanya disimpan sebagai label untuk ditampilkan.
 */

export const ATTACHMENT_KINDS = ['DOKUMEN', 'FOTO'] as const
export type AttachmentKind = (typeof ATTACHMENT_KINDS)[number]

/** Daftar putih jenis berkas beserta akhiran yang dipakai di penyimpanan. */
export const ALLOWED_TYPES: Record<string, { ext: string; kind: AttachmentKind }> = {
  'application/pdf': { ext: 'pdf', kind: 'DOKUMEN' },
  'image/jpeg': { ext: 'jpg', kind: 'FOTO' },
  'image/png': { ext: 'png', kind: 'FOTO' },
  'image/webp': { ext: 'webp', kind: 'FOTO' },
  'application/msword': { ext: 'doc', kind: 'DOKUMEN' },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
    ext: 'docx',
    kind: 'DOKUMEN',
  },
  'application/vnd.ms-excel': { ext: 'xls', kind: 'DOKUMEN' },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
    ext: 'xlsx',
    kind: 'DOKUMEN',
  },
}

export const MAX_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB

/** Entitas yang boleh dilampiri, beserta izin yang menjaganya. */
export const ATTACHABLE: Record<string, { read: Permission; write: Permission; label: string }> = {
  Project: { read: 'project:read', write: 'project:write', label: 'Proyek' },
  Tender: { read: 'tender:read', write: 'tender:write', label: 'Tender' },
  Contract: { read: 'contract:read', write: 'contract:write', label: 'Kontrak' },
  Deliverable: {
    read: 'deliverable:read',
    write: 'deliverable:write',
    label: 'Pekerjaan teknis',
  },
  LabSample: { read: 'deliverable:read', write: 'deliverable:write', label: 'Sampel lab' },
  Personnel: { read: 'personnel:read', write: 'personnel:write', label: 'Personel' },
  Certification: {
    read: 'personnel:read',
    write: 'personnel:write',
    label: 'Sertifikat',
  },
  Invoice: { read: 'invoice:read', write: 'invoice:write', label: 'Invoice' },
}

export function assertAttachableEntity(entityType: string): void {
  if (!(entityType in ATTACHABLE)) {
    throw new BusinessRuleError(
      `Entitas "${entityType}" tidak dapat dilampiri berkas.`,
      'ENTITY_NOT_ATTACHABLE',
    )
  }
}

export function readPermissionFor(entityType: string): Permission {
  assertAttachableEntity(entityType)
  return ATTACHABLE[entityType].read
}

export function writePermissionFor(entityType: string): Permission {
  assertAttachableEntity(entityType)
  return ATTACHABLE[entityType].write
}

export function assertTypeAllowed(mimeType: string): AttachmentKind {
  const izin = ALLOWED_TYPES[mimeType]
  if (!izin) {
    throw new BusinessRuleError(
      'Jenis berkas tidak didukung. Unggah PDF, gambar (JPG/PNG/WebP), Word, atau Excel.',
      'FILE_TYPE_NOT_ALLOWED',
    )
  }
  return izin.kind
}

export function assertSizeAllowed(sizeBytes: number): void {
  if (sizeBytes <= 0) {
    throw new BusinessRuleError('Berkas kosong.', 'FILE_EMPTY')
  }
  if (sizeBytes > MAX_SIZE_BYTES) {
    throw new BusinessRuleError(
      `Ukuran berkas melebihi ${Math.round(MAX_SIZE_BYTES / 1024 / 1024)} MB.`,
      'FILE_TOO_LARGE',
    )
  }
}

/**
 * Membersihkan nama berkas kiriman untuk ditampilkan.
 *
 * Nama ini tidak pernah dipakai sebagai jalur penyimpanan, tetapi tetap
 * dibersihkan karena akan ditampilkan kembali dan dipakai saat pengguna
 * mengunduhnya.
 */
export function sanitizeDisplayName(name: string): string {
  const bersih = name
    .replace(/[\r\n\t]/g, ' ')
    .replace(/[/\\]/g, '-')
    .replace(/\.{2,}/g, '.')
    .trim()
  const dipotong = bersih.slice(0, 150)
  return dipotong === '' || dipotong === '.' ? 'berkas' : dipotong
}

/**
 * Menyusun jalur penyimpanan dari nilai yang kita kendalikan sendiri:
 * tanggal, pengenal acak, dan akhiran dari daftar putih. Nama kiriman
 * pengguna sama sekali tidak ikut, sehingga jalurnya mustahil ditembus.
 */
export function buildStoredPath(mimeType: string, id: string, now: Date): string {
  const { ext } = ALLOWED_TYPES[mimeType] ?? {}
  if (!ext) {
    throw new BusinessRuleError(
      'Jenis berkas tidak didukung.',
      'FILE_TYPE_NOT_ALLOWED',
    )
  }
  const tahun = now.getUTCFullYear()
  const bulan = String(now.getUTCMonth() + 1).padStart(2, '0')
  return `${tahun}/${bulan}/${id}.${ext}`
}

/** Berkas gambar dapat dipratinjau langsung; sisanya diunduh. */
export function isPreviewable(mimeType: string): boolean {
  return ALLOWED_TYPES[mimeType]?.kind === 'FOTO' || mimeType === 'application/pdf'
}

export function formatSize(sizeBytes: number): string {
  if (sizeBytes < 1024) return `${sizeBytes} B`
  if (sizeBytes < 1024 * 1024) return `${Math.round(sizeBytes / 1024)} KB`
  return `${(sizeBytes / 1024 / 1024).toFixed(1)} MB`
}
