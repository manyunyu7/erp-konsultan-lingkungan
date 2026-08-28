import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { db } from '@/lib/db'
import { currentActor, izinkan } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Badge, type VarianBadge } from '@/components/ui/badge'
import { AksesDitolak } from '@/components/ui/notice'
import { PanelLampiran } from '@/components/lampiran/panel-lampiran'
import { rupiah, sisaHari, tanggal } from '@/lib/utils'

const STATUS_LABEL: Record<string, string> = {
  IDENTIFIED: 'Teridentifikasi',
  PREPARING: 'Penyiapan dokumen',
  SUBMITTED: 'Sudah dimasukkan',
  WON: 'Menang',
  LOST: 'Kalah',
  CANCELLED: 'Dibatalkan',
}

const STATUS_VARIAN: Record<string, VarianBadge> = {
  IDENTIFIED: 'netral',
  PREPARING: 'info',
  SUBMITTED: 'utama',
  WON: 'sukses',
  LOST: 'bahaya',
  CANCELLED: 'netral',
}

const SUMBER_LABEL: Record<string, string> = {
  LPSE: 'LPSE',
  BUMN: 'BUMN',
  SWASTA: 'Swasta',
  PENUNJUKAN_LANGSUNG: 'Penunjukan langsung',
}

export default async function HalamanRincianTender({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const actor = await currentActor()
  if (!actor) return null
  if (!(await izinkan(actor, 'tender:read'))) return <AksesDitolak />

  // Nilai penawaran adalah angka komersial; hanya yang berhak melihat biaya.
  const bolehNilai = await izinkan(actor, 'cost:read')

  const tender = await db.tender.findUnique({
    where: { id },
    include: { client: { select: { name: true } } },
  })
  if (!tender) notFound()

  const sisa = sisaHari(tender.submissionDeadline)

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-gap">
      <div className="flex flex-col gap-1">
        <Link
          href="/tender"
          className="flex w-fit items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Kembali ke daftar tender
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-lg font-semibold tracking-tight">{tender.title}</h1>
          <Badge varian={STATUS_VARIAN[tender.status] ?? 'netral'}>
            {STATUS_LABEL[tender.status] ?? tender.status}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {tender.code} · {tender.client.name}
        </p>
      </div>

      <Card>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <Info label="Kode">{tender.code}</Info>
          <Info label="Klien">{tender.client.name}</Info>
          <Info label="Sumber">{SUMBER_LABEL[tender.source] ?? tender.source}</Info>
          {bolehNilai && (
            <>
              <Info label="Nilai penawaran">
                {tender.bidValue === null ? '—' : rupiah(Number(tender.bidValue))}
              </Info>
              <Info label="Perkiraan nilai">
                {tender.estimatedValue === null ? '—' : rupiah(Number(tender.estimatedValue))}
              </Info>
            </>
          )}
          <Info label="Peluang menang">
            {tender.winRateProbability === null ? '—' : `${tender.winRateProbability}%`}
          </Info>
          <Info label="Tenggat unggah">
            <span className="flex flex-wrap items-center gap-2">
              {tanggal(tender.submissionDeadline)}
              <Badge varian={sisa < 0 ? 'bahaya' : sisa <= 3 ? 'peringatan' : 'netral'}>
                {sisa < 0 ? `Lewat ${Math.abs(sisa)} hari` : `H-${sisa}`}
              </Badge>
            </span>
          </Info>
          <Info label="Pengumuman">{tanggal(tender.announcementDate)}</Info>
          <Info label="Status">{STATUS_LABEL[tender.status] ?? tender.status}</Info>
          {tender.description && (
            <div className="sm:col-span-3">
              <Info label="Uraian">{tender.description}</Info>
            </div>
          )}
          {tender.torSummary && (
            <div className="sm:col-span-3">
              <Info label="Ringkasan KAK/TOR">{tender.torSummary}</Info>
            </div>
          )}
        </CardContent>
      </Card>

      <PanelLampiran entityType="Tender" entityId={tender.id} judul="Dokumen tender" />
    </div>
  )
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{children}</span>
    </div>
  )
}
