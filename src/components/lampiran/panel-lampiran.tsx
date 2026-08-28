import { db } from '@/lib/db'
import { currentActor, izinkan } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { ATTACHABLE } from '@/server/attachments/rules'
import { DaftarLampiran, type LampiranTampil } from './daftar-lampiran'

/**
 * Panel lampiran siap pasang untuk halaman rincian.
 *
 * Daftar diambil di server agar berkas ikut tersaji pada muatan pertama, dan
 * izin diperiksa di sini supaya tombol unggah tidak muncul untuk pengguna yang
 * memang akan ditolak server.
 */
export async function PanelLampiran({
  entityType,
  entityId,
  judul,
}: {
  entityType: keyof typeof ATTACHABLE | string
  entityId: string
  judul?: string
}) {
  const aturan = ATTACHABLE[entityType]
  if (!aturan) return null

  const actor = await currentActor()
  if (!actor) return null
  if (!(await izinkan(actor, aturan.read))) return null

  const bolehUnggah = await izinkan(actor, aturan.write)

  const baris = await db.attachment.findMany({
    where: { entityType, entityId },
    orderBy: { createdAt: 'desc' },
    include: { uploadedBy: { select: { name: true } } },
  })

  // Data Prisma tidak boleh menyeberang apa adanya ke komponen klien; tanggal
  // diubah jadi string dan hanya kolom yang dipakai antarmuka yang ikut.
  const awal: LampiranTampil[] = baris.map((b) => ({
    id: b.id,
    originalName: b.originalName,
    caption: b.caption,
    mimeType: b.mimeType,
    sizeBytes: b.sizeBytes,
    createdAt: b.createdAt.toISOString(),
    uploadedByName: b.uploadedBy.name,
  }))

  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">{judul ?? `Lampiran ${aturan.label.toLowerCase()}`}</h2>
        <DaftarLampiran
          entityType={entityType}
          entityId={entityId}
          bolehUnggah={bolehUnggah}
          awal={awal}
        />
      </CardContent>
    </Card>
  )
}
