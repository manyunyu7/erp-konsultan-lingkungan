import Link from 'next/link'
import { Plus } from 'lucide-react'
import { db } from '@/lib/db'
import { currentActor, izinkan } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Badge, type VarianBadge } from '@/components/ui/badge'
import { Table, TD, TH, THead, TR } from '@/components/ui/table'
import { AksesDitolak, Kosong } from '@/components/ui/notice'
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

/** Tender yang masih dikejar; sisanya sudah tidak butuh tindakan. */
const STATUS_AKTIF = ['IDENTIFIED', 'PREPARING', 'SUBMITTED']

export default async function HalamanTender() {
  const actor = await currentActor()
  if (!actor) return null
  if (!(await izinkan(actor, 'tender:read'))) return <AksesDitolak />

  const bolehNilai = await izinkan(actor, 'cost:read')
  // Dihitung di sini karena `await` tidak dapat dipakai langsung di dalam JSX.
  const bolehTulisTender = await izinkan(actor, 'tender:write')
  const now = new Date()

  const tenders = await db.tender.findMany({
    orderBy: { submissionDeadline: 'asc' },
    include: { client: { select: { name: true } } },
  })

  const aktif = tenders.filter((t) => STATUS_AKTIF.includes(t.status))
  const selesai = tenders
    .filter((t) => !STATUS_AKTIF.includes(t.status))
    .sort((a, b) => b.submissionDeadline.getTime() - a.submissionDeadline.getTime())

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-gap">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Tender</h1>
          <p className="text-sm text-muted-foreground">
            Yang tenggatnya paling dekat tampil lebih dulu — per {tanggal(now)}
          </p>
        </div>
        {bolehTulisTender && (
          <Link
            href="/tender/baru"
            className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90"
          >
            <Plus className="size-4" />
            Tender baru
          </Link>
        )}
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3">
          <h2 className="text-sm font-medium">Sedang berjalan</h2>
          {aktif.length === 0 ? (
            <Kosong pesan="Belum ada tender yang sedang dikejar." />
          ) : (
            <TabelTender daftar={aktif} bolehNilai={bolehNilai} now={now} tampilkanSisa />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-3">
          <h2 className="text-sm font-medium">Sudah selesai</h2>
          {selesai.length === 0 ? (
            <Kosong pesan="Belum ada tender yang sudah diputus." />
          ) : (
            <TabelTender daftar={selesai} bolehNilai={bolehNilai} now={now} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

interface BarisTender {
  id: string
  code: string
  title: string
  source: string
  status: string
  bidValue: unknown
  winRateProbability: number | null
  submissionDeadline: Date
  client: { name: string }
}

function TabelTender({
  daftar,
  bolehNilai,
  now,
  tampilkanSisa,
}: {
  daftar: BarisTender[]
  bolehNilai: boolean
  now: Date
  tampilkanSisa?: boolean
}) {
  return (
    <Table>
      <THead>
        <TR>
          <TH>Kode</TH>
          <TH>Judul</TH>
          <TH>Klien</TH>
          <TH>Sumber</TH>
          {bolehNilai && <TH className="text-right">Nilai penawaran</TH>}
          <TH className="text-right">Peluang menang</TH>
          <TH>Tenggat unggah</TH>
          <TH>Status</TH>
        </TR>
      </THead>
      <tbody>
        {daftar.map((t) => {
          const sisa = sisaHari(t.submissionDeadline, now)
          return (
            <TR key={t.id}>
              <TD className="font-medium whitespace-nowrap">
                <Link href={`/tender/${t.id}`} className="hover:underline">
                  {t.code}
                </Link>
              </TD>
              <TD className="max-w-64 truncate">
                <Link href={`/tender/${t.id}`} className="hover:underline">
                  {t.title}
                </Link>
              </TD>
              <TD className="max-w-40 truncate text-muted-foreground">{t.client.name}</TD>
              <TD className="whitespace-nowrap">{SUMBER_LABEL[t.source] ?? t.source}</TD>
              {bolehNilai && (
                <TD className="text-right tabular-nums whitespace-nowrap">
                  {t.bidValue === null ? '—' : rupiah(Number(t.bidValue))}
                </TD>
              )}
              <TD className="text-right tabular-nums">
                {t.winRateProbability === null ? '—' : `${t.winRateProbability}%`}
              </TD>
              <TD className="whitespace-nowrap">
                <div className="flex items-center gap-2">
                  <span>{tanggal(t.submissionDeadline)}</span>
                  {tampilkanSisa && (
                    <Badge varian={sisa < 0 ? 'bahaya' : sisa <= 3 ? 'peringatan' : 'netral'}>
                      {sisa < 0 ? `Lewat ${Math.abs(sisa)} hari` : `H-${sisa}`}
                    </Badge>
                  )}
                </div>
              </TD>
              <TD>
                <Badge varian={STATUS_VARIAN[t.status] ?? 'netral'}>
                  {STATUS_LABEL[t.status] ?? t.status}
                </Badge>
              </TD>
            </TR>
          )
        })}
      </tbody>
    </Table>
  )
}
