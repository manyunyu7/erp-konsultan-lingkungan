import { db } from '@/lib/db'
import { currentActor } from '@/lib/api'
import { can } from '@/server/auth'
import { Card, CardContent } from '@/components/ui/card'
import { Badge, type VarianBadge } from '@/components/ui/badge'
import { AksesDitolak, Kosong } from '@/components/ui/notice'
import { tanggal } from '@/lib/utils'

const KATEGORI_LABEL: Record<string, string> = {
  TENDER_DEADLINE: 'Tenggat tender',
  TECHNICAL_DEADLINE: 'Tenggat pekerjaan teknis',
  INVOICING: 'Penagihan',
  PAYMENT_OVERDUE: 'Pembayaran lewat tempo',
  CONTRACT_EXPIRY: 'Kontrak akan berakhir',
  CERTIFICATE_EXPIRY: 'Sertifikat akan kedaluwarsa',
}

const KATEGORI_VARIAN: Record<string, VarianBadge> = {
  TENDER_DEADLINE: 'peringatan',
  TECHNICAL_DEADLINE: 'peringatan',
  INVOICING: 'info',
  PAYMENT_OVERDUE: 'bahaya',
  CONTRACT_EXPIRY: 'peringatan',
  CERTIFICATE_EXPIRY: 'bahaya',
}

/** Waktu pemicu ditampilkan sampai jam karena beberapa peringatan terbit harian. */
function waktuPemicu(nilai: Date): string {
  const jam = new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jakarta',
  }).format(nilai)
  return `${tanggal(nilai)} · ${jam} WIB`
}

export default async function HalamanPeringatan() {
  const actor = await currentActor()
  if (!actor) return null
  if (!can(actor, 'notification:read')) return <AksesDitolak />

  // Hanya peringatan yang memang ditujukan kepada pengguna ini.
  const items = await db.notificationRecipient.findMany({
    where: { userId: actor.id },
    orderBy: { notification: { triggerAt: 'desc' } },
    include: { notification: true },
  })

  const belumDibaca = items.filter((i) => i.readAt === null).length

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-gap">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Peringatan</h1>
        <p className="text-sm text-muted-foreground">
          {belumDibaca > 0
            ? `${belumDibaca} peringatan belum dibaca, terbaru di atas.`
            : 'Semua peringatan sudah dibaca.'}
        </p>
      </div>

      {items.length === 0 ? (
        <Card>
          <CardContent>
            <Kosong pesan="Belum ada peringatan untuk Anda." />
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-gap">
          {items.map((item) => {
            const n = item.notification
            const belum = item.readAt === null
            return (
              <Card key={item.id}>
                <CardContent className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge varian={KATEGORI_VARIAN[n.category] ?? 'netral'}>
                      {KATEGORI_LABEL[n.category] ?? n.category}
                    </Badge>
                    {belum ? (
                      <Badge varian="utama">Belum dibaca</Badge>
                    ) : (
                      <Badge varian="netral">Sudah dibaca {tanggal(item.readAt)}</Badge>
                    )}
                    <span className="ml-auto text-xs text-muted-foreground">
                      {waktuPemicu(n.triggerAt)}
                    </span>
                  </div>
                  <h2 className={belum ? 'text-sm font-semibold' : 'text-sm font-medium'}>
                    {n.title}
                  </h2>
                  <p className="text-sm text-muted-foreground">{n.message}</p>
                  <p className="text-sm">
                    <span className="text-muted-foreground">Yang perlu dilakukan: </span>
                    {n.action}
                  </p>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
