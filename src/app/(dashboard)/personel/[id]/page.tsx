import Link from 'next/link'
import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { currentActor } from '@/lib/api'
import { can } from '@/server/auth'
import { expectedPeriodType, type EmploymentType } from '@/server/hr'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TD, TH, THead, TR } from '@/components/ui/table'
import { Kosong } from '@/components/ui/notice'
import { sisaHari, tanggal } from '@/lib/utils'
import { KEPEGAWAIAN_LABEL, SERTIFIKAT_LABEL } from '../labels'
import { FormSertifikat } from './form-sertifikat'
import { FormKpi } from './form-kpi'

/** Proyek yang masih boleh dipilih sebagai objek penilaian KPI per-proyek. */
const STATUS_DAPAT_DINILAI = ['PREPARATION', 'RUNNING', 'REPORTING', 'CLOSING', 'CLOSED']

export default async function HalamanRincianPersonel({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const actor = await currentActor()
  if (!actor) return null
  if (!can(actor, 'personnel:read')) notFound()

  const { id } = await params
  const personnel = await db.personnel.findUnique({
    where: { id },
    include: {
      certifications: { orderBy: { expiresAt: 'asc' } },
      assignments: {
        orderBy: { startDate: 'desc' },
        include: { project: { select: { code: true, name: true, documentType: true } } },
      },
      evaluations: {
        orderBy: { evaluatedAt: 'desc' },
        include: { project: { select: { code: true } } },
      },
    },
  })
  if (!personnel) notFound()

  const bolehTulisPersonel = can(actor, 'personnel:write')
  const bolehLihatKpi = can(actor, 'kpi:read')
  const bolehTulisKpi = can(actor, 'kpi:write')
  const now = new Date()

  const periodType = expectedPeriodType(personnel.employmentType as EmploymentType)
  const proyek =
    bolehTulisKpi && periodType === 'PER_PROJECT'
      ? await db.project.findMany({
          where: { status: { in: STATUS_DAPAT_DINILAI } },
          orderBy: { code: 'asc' },
          select: { id: true, code: true, name: true },
        })
      : []

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-gap">
      <div>
        <Link href="/personel" className="text-xs text-muted-foreground hover:underline">
          ← Kembali ke daftar personel
        </Link>
        <h1 className="mt-1 flex items-center gap-2 text-lg font-semibold tracking-tight">
          {personnel.fullName}
          {!personnel.isActive && <Badge varian="netral">Nonaktif</Badge>}
        </h1>
        <p className="text-sm text-muted-foreground">
          {personnel.position} ·{' '}
          {KEPEGAWAIAN_LABEL[personnel.employmentType] ?? personnel.employmentType}
        </p>
      </div>

      <Card>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">Tanggal bergabung</p>
            <p>{tanggal(personnel.joinedAt)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Siklus penilaian</p>
            <p>{periodType === 'ANNUAL' ? 'Tahunan' : 'Per proyek'}</p>
          </div>
          <div className="sm:col-span-3">
            <p className="text-xs text-muted-foreground">Keahlian</p>
            <p>{personnel.expertise ?? '—'}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-3">
          <h2 className="text-sm font-medium">Sertifikat</h2>
          {personnel.certifications.length === 0 ? (
            <Kosong pesan="Belum ada sertifikat tercatat." />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Sertifikat</TH>
                  <TH>Penerbit</TH>
                  <TH>Nomor</TH>
                  <TH>Terbit</TH>
                  <TH>Berlaku sampai</TH>
                  <TH>Status</TH>
                </TR>
              </THead>
              <tbody>
                {personnel.certifications.map((c) => {
                  const sisa = sisaHari(c.expiresAt, now)
                  return (
                    <TR key={c.id}>
                      <TD className="font-medium">{SERTIFIKAT_LABEL[c.name] ?? c.name}</TD>
                      <TD>{c.issuer}</TD>
                      <TD className="text-muted-foreground">{c.number ?? '—'}</TD>
                      <TD className="whitespace-nowrap">{tanggal(c.issuedAt)}</TD>
                      <TD className="whitespace-nowrap">{tanggal(c.expiresAt)}</TD>
                      <TD>
                        {sisa < 0 ? (
                          <Badge varian="bahaya">Kedaluwarsa</Badge>
                        ) : sisa <= 60 ? (
                          <Badge varian="peringatan">Habis dalam {sisa} hari</Badge>
                        ) : (
                          <Badge varian="sukses">Berlaku</Badge>
                        )}
                      </TD>
                    </TR>
                  )
                })}
              </tbody>
            </Table>
          )}
        </CardContent>
      </Card>

      {bolehTulisPersonel && (
        <Card>
          <CardContent className="flex flex-col gap-3">
            <div>
              <h2 className="text-sm font-medium">Tambah sertifikat</h2>
              <p className="text-xs text-muted-foreground">
                Sertifikat yang berlaku menentukan kelayakan personel ditugaskan ke proyek.
              </p>
            </div>
            <FormSertifikat personnelId={personnel.id} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="flex flex-col gap-3">
          <h2 className="text-sm font-medium">Riwayat penugasan</h2>
          {personnel.assignments.length === 0 ? (
            <Kosong pesan="Belum pernah ditugaskan ke proyek." />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Proyek</TH>
                  <TH>Jenis dokumen</TH>
                  <TH>Peran</TH>
                  <TH>Mulai</TH>
                  <TH>Selesai</TH>
                </TR>
              </THead>
              <tbody>
                {personnel.assignments.map((a) => (
                  <TR key={a.id}>
                    <TD className="font-medium whitespace-nowrap">
                      {a.project.code}
                      <span className="block text-xs font-normal text-muted-foreground">
                        {a.project.name}
                      </span>
                    </TD>
                    <TD>{a.project.documentType}</TD>
                    <TD>{a.role}</TD>
                    <TD className="whitespace-nowrap">{tanggal(a.startDate)}</TD>
                    <TD className="whitespace-nowrap">{tanggal(a.endDate)}</TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          )}
        </CardContent>
      </Card>

      {bolehLihatKpi && (
        <Card>
          <CardContent className="flex flex-col gap-3">
            <h2 className="text-sm font-medium">Riwayat penilaian KPI</h2>
            {personnel.evaluations.length === 0 ? (
              <Kosong pesan="Belum ada penilaian." />
            ) : (
              <Table>
                <THead>
                  <TR>
                    <TH>Periode</TH>
                    <TH className="text-right">Ketepatan waktu</TH>
                    <TH className="text-right">Kualitas</TH>
                    <TH className="text-right">Kerjasama</TH>
                    <TH className="text-right">Total</TH>
                    <TH>Dinilai</TH>
                  </TR>
                </THead>
                <tbody>
                  {personnel.evaluations.map((e) => (
                    <TR key={e.id}>
                      <TD className="whitespace-nowrap">
                        {e.periodType === 'ANNUAL'
                          ? `Tahunan ${e.periodYear ?? ''}`
                          : `Proyek ${e.project?.code ?? '—'}`}
                      </TD>
                      <TD className="text-right tabular-nums">{e.punctualityScore}</TD>
                      <TD className="text-right tabular-nums">{e.qualityScore}</TD>
                      <TD className="text-right tabular-nums">{e.teamworkScore}</TD>
                      <TD className="text-right font-medium tabular-nums">
                        {Number(e.totalScore).toFixed(2)}
                      </TD>
                      <TD className="whitespace-nowrap">{tanggal(e.evaluatedAt)}</TD>
                    </TR>
                  ))}
                </tbody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {bolehTulisKpi && (
        <Card>
          <CardContent className="flex flex-col gap-3">
            <div>
              <h2 className="text-sm font-medium">Penilaian KPI baru</h2>
              <p className="text-xs text-muted-foreground">
                Tiga indikator berskala 0–100 dengan bobot 35 / 40 / 25.
              </p>
            </div>
            <FormKpi personnelId={personnel.id} periodType={periodType} proyek={proyek} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
