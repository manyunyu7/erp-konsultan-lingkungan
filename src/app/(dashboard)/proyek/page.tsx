import Link from 'next/link'
import { db } from '@/lib/db'
import { currentActor, izinkan } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TD, TH, THead, TR } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { AksesDitolak, Kosong } from '@/components/ui/notice'
import { rupiah, sisaHari, tanggal } from '@/lib/utils'
import {
  JENIS_DOKUMEN_LABEL,
  PROYEK_STATUS_LABEL,
  PROYEK_STATUS_VARIAN,
  labelSisaHari,
  varianSisaKontrak,
} from './labels'

/** Proyek yang masih hidup ditampilkan lebih dulu, diurut tanggal berakhir. */
const STATUS_BERJALAN = ['PREPARATION', 'RUNNING', 'REPORTING', 'CLOSING']

export default async function HalamanProyek() {
  const actor = await currentActor()
  if (!actor) return null
  if (!await izinkan(actor, 'project:read')) return <AksesDitolak />

  const bolehNilai = await izinkan(actor, 'invoice:read')
  const bolehBuat = await izinkan(actor, 'project:write')
  const now = new Date()

  const projects = await db.project.findMany({
    orderBy: { endDate: 'asc' },
    include: {
      client: { select: { name: true } },
      projectManager: { select: { name: true } },
      deliverables: { select: { status: true } },
    },
  })

  const berjalan = projects.filter((p) => STATUS_BERJALAN.includes(p.status))
  const arsip = projects
    .filter((p) => !STATUS_BERJALAN.includes(p.status))
    .sort((a, b) => b.endDate.getTime() - a.endDate.getTime())

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-gap">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Proyek</h1>
          <p className="text-sm text-muted-foreground">
            Kontrak yang mendekati berakhir ditandai H-30 dan H-14 — per {tanggal(now)}
          </p>
        </div>
        {bolehBuat && (
          <Link href="/proyek/baru">
            <Button>Proyek baru</Button>
          </Link>
        )}
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3">
          <h2 className="text-sm font-medium">Sedang berjalan</h2>
          {berjalan.length === 0 ? (
            <Kosong pesan="Belum ada proyek yang sedang berjalan." />
          ) : (
            <TabelProyek daftar={berjalan} bolehNilai={bolehNilai} now={now} tampilkanSisa />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-3">
          <h2 className="text-sm font-medium">Sudah ditutup</h2>
          {arsip.length === 0 ? (
            <Kosong pesan="Belum ada proyek yang ditutup." />
          ) : (
            <TabelProyek daftar={arsip} bolehNilai={bolehNilai} now={now} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

interface BarisProyek {
  id: string
  code: string
  name: string
  documentType: string
  status: string
  contractValue: unknown
  endDate: Date
  client: { name: string }
  projectManager: { name: string } | null
  deliverables: { status: string }[]
}

function TabelProyek({
  daftar,
  bolehNilai,
  now,
  tampilkanSisa,
}: {
  daftar: BarisProyek[]
  bolehNilai: boolean
  now: Date
  tampilkanSisa?: boolean
}) {
  return (
    <Table>
      <THead>
        <TR>
          <TH>Job Order</TH>
          <TH>Nama</TH>
          <TH>Klien</TH>
          <TH>Dokumen</TH>
          <TH>PM</TH>
          {bolehNilai && <TH className="text-right">Nilai kontrak</TH>}
          <TH>Tahapan teknis</TH>
          <TH>Berakhir</TH>
          <TH>Status</TH>
        </TR>
      </THead>
      <tbody>
        {daftar.map((p) => {
          const sisa = sisaHari(p.endDate, now)
          const total = p.deliverables.length
          const selesai = p.deliverables.filter((d) => d.status === 'APPROVED').length
          const persen = total === 0 ? 0 : Math.round((selesai / total) * 100)
          return (
            <TR key={p.id}>
              <TD className="font-medium whitespace-nowrap">
                <Link href={`/proyek/${p.id}`} className="text-primary hover:underline">
                  {p.code}
                </Link>
              </TD>
              <TD className="max-w-64 truncate">{p.name}</TD>
              <TD className="max-w-40 truncate text-muted-foreground">{p.client.name}</TD>
              <TD className="whitespace-nowrap">
                {JENIS_DOKUMEN_LABEL[p.documentType] ?? p.documentType}
              </TD>
              <TD className="max-w-36 truncate text-muted-foreground">
                {p.projectManager?.name ?? 'Belum ditunjuk'}
              </TD>
              {bolehNilai && (
                <TD className="text-right tabular-nums whitespace-nowrap">
                  {rupiah(Number(p.contractValue))}
                </TD>
              )}
              <TD className="whitespace-nowrap">
                {total === 0 ? (
                  <span className="text-muted-foreground">Belum dirinci</span>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-16 overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${persen}%` }}
                      />
                    </div>
                    <span className="tabular-nums text-muted-foreground">
                      {selesai}/{total}
                    </span>
                  </div>
                )}
              </TD>
              <TD className="whitespace-nowrap">
                <div className="flex items-center gap-2">
                  <span>{tanggal(p.endDate)}</span>
                  {tampilkanSisa && sisa <= 30 && (
                    <Badge varian={varianSisaKontrak(sisa)}>{labelSisaHari(sisa)}</Badge>
                  )}
                </div>
              </TD>
              <TD>
                <Badge varian={PROYEK_STATUS_VARIAN[p.status] ?? 'netral'}>
                  {PROYEK_STATUS_LABEL[p.status] ?? p.status}
                </Badge>
              </TD>
            </TR>
          )
        })}
      </tbody>
    </Table>
  )
}
