import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { db } from '@/lib/db'
import { currentActor } from '@/lib/api'
import { can } from '@/server/auth'
import { Card, CardContent } from '@/components/ui/card'
import { Badge, type VarianBadge } from '@/components/ui/badge'
import { Table, TD, TH, THead, TR } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { AksesDitolak, Kosong } from '@/components/ui/notice'
import { rupiah, sisaHari, tanggal } from '@/lib/utils'
import {
  DELIVERABLE_STATUS_LABEL,
  DELIVERABLE_STATUS_VARIAN,
  DELIVERABLE_TYPE_LABEL,
  JENIS_DOKUMEN_LABEL,
  PROYEK_STATUS_LABEL,
  PROYEK_STATUS_VARIAN,
  labelSisaHari,
  varianSisaKontrak,
} from '../labels'

const MATRIKS_LABEL: Record<string, string> = {
  AIR: 'Air',
  UDARA: 'Udara',
  TANAH: 'Tanah',
  FLORA: 'Flora',
  FAUNA: 'Fauna',
  SOSEKBUD: 'Sosekbud',
}

const SAMPEL_STATUS_LABEL: Record<string, string> = {
  COLLECTED: 'Diambil',
  SENT: 'Dikirim ke lab',
  TESTED: 'Selesai diuji',
  REPORTED: 'Hasil terbit',
}

const TERMIN_STATUS_LABEL: Record<string, string> = {
  PENDING: 'Menunggu milestone',
  READY_TO_INVOICE: 'Siap ditagihkan',
  INVOICED: 'Sudah ditagihkan',
  PAID: 'Terbayar',
}

const TERMIN_STATUS_VARIAN: Record<string, VarianBadge> = {
  PENDING: 'netral',
  READY_TO_INVOICE: 'peringatan',
  INVOICED: 'info',
  PAID: 'sukses',
}

const MILESTONE_LABEL: Record<string, string> = {
  CONTRACT_SIGNED: 'Kontrak diteken',
  DRAFT_REPORT: 'Draf laporan',
  BAST: 'BAST',
}

const KONTRAK_TIPE_LABEL: Record<string, string> = {
  SPK: 'SPK',
  LOA: 'LOA',
  PKS: 'PKS',
  ADDENDUM: 'Addendum',
}

/** Bobot CSAT sesuai SOP: teknis 35, ketepatan waktu 25, komunikasi 20, administrasi 20. */
const BOBOT_CSAT = [
  { kunci: 'technicalScore', label: 'Mutu teknis', bobot: 35 },
  { kunci: 'timelinessScore', label: 'Ketepatan waktu', bobot: 25 },
  { kunci: 'responsivenessScore', label: 'Komunikasi', bobot: 20 },
  { kunci: 'complianceScore', label: 'Administrasi', bobot: 20 },
] as const

export default async function HalamanRincianProyek({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const actor = await currentActor()
  if (!actor) return null
  if (!can(actor, 'project:read')) return <AksesDitolak />

  const bolehKeuangan = can(actor, 'invoice:read')
  const bolehProyek = can(actor, 'project:write')
  const bolehKontrak = can(actor, 'contract:write')
  const bolehTeknis = can(actor, 'deliverable:write')
  const now = new Date()

  const project = await db.project.findUnique({
    where: { id },
    include: {
      client: true,
      projectManager: { select: { name: true } },
      contracts: { orderBy: { signedAt: 'asc' } },
      deliverables: { orderBy: { dueDate: 'asc' } },
      labSamples: { orderBy: { takenAt: 'asc' } },
      assignments: { include: { personnel: true }, orderBy: { startDate: 'asc' } },
      termins: { orderBy: { sequence: 'asc' }, include: { invoice: true } },
      bast: true,
      csat: true,
    },
  })
  if (!project) notFound()

  const sisaKontrak = sisaHari(project.endDate, now)
  const totalDeliverable = project.deliverables.length
  const deliverableSelesai = project.deliverables.filter((d) => d.status === 'APPROVED').length
  const csat = project.csat

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-gap">
      <div className="flex flex-col gap-1">
        <Link
          href="/proyek"
          className="flex w-fit items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Kembali ke daftar proyek
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-lg font-semibold tracking-tight">{project.name}</h1>
          <Badge varian={PROYEK_STATUS_VARIAN[project.status] ?? 'netral'}>
            {PROYEK_STATUS_LABEL[project.status] ?? project.status}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {project.code} · {project.client.name}
        </p>
        {(bolehKontrak || bolehTeknis || bolehProyek) && (
          <div className="mt-1 flex flex-wrap gap-2">
            {bolehKontrak && (
              <Link href={`/proyek/${project.id}/kontrak`}>
                <Button varian="garis" ukuran="sm">
                  Catat kontrak
                </Button>
              </Link>
            )}
            {bolehTeknis && (
              <Link href={`/proyek/${project.id}/pekerjaan`}>
                <Button varian="garis" ukuran="sm">
                  Kelola tahapan teknis
                </Button>
              </Link>
            )}
            {bolehProyek && (
              <Link href={`/proyek/${project.id}/penutupan`}>
                <Button varian="garis" ukuran="sm">
                  Penutupan proyek
                </Button>
              </Link>
            )}
          </div>
        )}
      </div>

      <Card>
        <CardContent className="grid gap-gap sm:grid-cols-2 lg:grid-cols-4">
          <Info label="Jenis dokumen">
            {JENIS_DOKUMEN_LABEL[project.documentType] ?? project.documentType}
          </Info>
          <Info label="Project Manager">{project.projectManager?.name ?? 'Belum ditunjuk'}</Info>
          <Info label="Mulai">{tanggal(project.startDate)}</Info>
          <Info label="Berakhir">
            <span className="flex items-center gap-2">
              {tanggal(project.endDate)}
              {sisaKontrak <= 30 && (
                <Badge varian={varianSisaKontrak(sisaKontrak)}>
                  {labelSisaHari(sisaKontrak)}
                </Badge>
              )}
            </span>
          </Info>
          {bolehKeuangan && (
            <Info label="Nilai kontrak">{rupiah(Number(project.contractValue))}</Info>
          )}
          <Info label="Narahubung klien">{project.client.contactPerson ?? '—'}</Info>
          <Info label="Kemajuan tahapan teknis">
            {totalDeliverable === 0
              ? 'Belum dirinci'
              : `${deliverableSelesai} dari ${totalDeliverable} disetujui`}
          </Info>
          <Info label="BAST">
            {project.bast
              ? `${project.bast.number} · ${tanggal(project.bast.signedAt)}`
              : 'Belum diteken'}
          </Info>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-3">
          <h2 className="text-sm font-medium">Dokumen kontrak</h2>
          {project.contracts.length === 0 ? (
            <Kosong pesan="Belum ada dokumen kontrak tercatat." />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Jenis</TH>
                  <TH>Nomor</TH>
                  <TH>Diteken</TH>
                  <TH>Berlaku sampai</TH>
                </TR>
              </THead>
              <tbody>
                {project.contracts.map((c) => (
                  <TR key={c.id}>
                    <TD>{KONTRAK_TIPE_LABEL[c.type] ?? c.type}</TD>
                    <TD className="font-medium">{c.number}</TD>
                    <TD className="whitespace-nowrap">{tanggal(c.signedAt)}</TD>
                    <TD className="whitespace-nowrap">{tanggal(c.validUntil)}</TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-3">
          <h2 className="text-sm font-medium">Tahapan teknis</h2>
          {project.deliverables.length === 0 ? (
            <Kosong pesan="Belum ada tahapan teknis tercatat." />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Pekerjaan</TH>
                  <TH>Jenis</TH>
                  <TH>Tenggat</TH>
                  <TH>Diserahkan</TH>
                  <TH>Status</TH>
                </TR>
              </THead>
              <tbody>
                {project.deliverables.map((d) => {
                  const sisa = sisaHari(d.dueDate, now)
                  const belumBeres = d.status !== 'APPROVED'
                  return (
                    <TR key={d.id}>
                      <TD className="font-medium">{d.name}</TD>
                      <TD className="whitespace-nowrap text-muted-foreground">
                        {DELIVERABLE_TYPE_LABEL[d.type] ?? d.type}
                      </TD>
                      <TD className="whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span>{tanggal(d.dueDate)}</span>
                          {belumBeres && (
                            <Badge
                              varian={sisa < 0 ? 'bahaya' : sisa <= 3 ? 'peringatan' : 'netral'}
                            >
                              {labelSisaHari(sisa)}
                            </Badge>
                          )}
                        </div>
                      </TD>
                      <TD className="whitespace-nowrap">{tanggal(d.submittedAt)}</TD>
                      <TD>
                        <Badge varian={DELIVERABLE_STATUS_VARIAN[d.status] ?? 'netral'}>
                          {DELIVERABLE_STATUS_LABEL[d.status] ?? d.status}
                        </Badge>
                      </TD>
                    </TR>
                  )
                })}
              </tbody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-3">
          <h2 className="text-sm font-medium">Sampel laboratorium</h2>
          {project.labSamples.length === 0 ? (
            <Kosong pesan="Belum ada sampel yang diambil." />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Kode sampel</TH>
                  <TH>Matriks</TH>
                  <TH>Lokasi</TH>
                  <TH>Diambil</TH>
                  <TH>Laboratorium</TH>
                  <TH>No. Chain of Custody</TH>
                  <TH>Status</TH>
                </TR>
              </THead>
              <tbody>
                {project.labSamples.map((s) => (
                  <TR key={s.id}>
                    <TD className="font-medium whitespace-nowrap">{s.sampleCode}</TD>
                    <TD>{MATRIKS_LABEL[s.matrix] ?? s.matrix}</TD>
                    <TD className="max-w-48 truncate text-muted-foreground">{s.location}</TD>
                    <TD className="whitespace-nowrap">{tanggal(s.takenAt)}</TD>
                    <TD className="max-w-40 truncate">{s.laboratory}</TD>
                    <TD className="whitespace-nowrap">
                      {s.cocNumber ?? (
                        <span className="text-[var(--warning)]">Belum diisi</span>
                      )}
                    </TD>
                    <TD>
                      <Badge varian={s.status === 'REPORTED' ? 'sukses' : 'netral'}>
                        {SAMPEL_STATUS_LABEL[s.status] ?? s.status}
                      </Badge>
                    </TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-3">
          <h2 className="text-sm font-medium">Personel yang ditugaskan</h2>
          {project.assignments.length === 0 ? (
            <Kosong pesan="Belum ada personel yang ditugaskan." />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Nama</TH>
                  <TH>Peran di proyek</TH>
                  <TH>Keahlian</TH>
                  <TH>Mulai</TH>
                  <TH>Selesai</TH>
                </TR>
              </THead>
              <tbody>
                {project.assignments.map((a) => (
                  <TR key={a.id}>
                    <TD className="font-medium">{a.personnel.fullName}</TD>
                    <TD>{a.role}</TD>
                    <TD className="text-muted-foreground">{a.personnel.expertise ?? '—'}</TD>
                    <TD className="whitespace-nowrap">{tanggal(a.startDate)}</TD>
                    <TD className="whitespace-nowrap">
                      {a.endDate ? tanggal(a.endDate) : 'Masih berjalan'}
                    </TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          )}
        </CardContent>
      </Card>

      {bolehKeuangan && (
        <Card>
          <CardContent className="flex flex-col gap-3">
            <h2 className="text-sm font-medium">Termin &amp; invoice</h2>
            {project.termins.length === 0 ? (
              <Kosong pesan="Belum ada termin yang disusun." />
            ) : (
              <Table>
                <THead>
                  <TR>
                    <TH>Termin</TH>
                    <TH>Milestone</TH>
                    <TH className="text-right">Porsi</TH>
                    <TH className="text-right">Nominal</TH>
                    <TH>Rencana tagih</TH>
                    <TH>Invoice</TH>
                    <TH>Status</TH>
                  </TR>
                </THead>
                <tbody>
                  {project.termins.map((t) => (
                    <TR key={t.id}>
                      <TD className="font-medium whitespace-nowrap">
                        {t.sequence}. {t.name}
                      </TD>
                      <TD className="whitespace-nowrap text-muted-foreground">
                        {MILESTONE_LABEL[t.milestone] ?? t.milestone}
                      </TD>
                      <TD className="text-right tabular-nums">{Number(t.percentage)}%</TD>
                      <TD className="text-right tabular-nums whitespace-nowrap">
                        {rupiah(Number(t.amount))}
                      </TD>
                      <TD className="whitespace-nowrap">{tanggal(t.plannedDate)}</TD>
                      <TD className="whitespace-nowrap">
                        {t.invoice ? t.invoice.number : 'Belum terbit'}
                      </TD>
                      <TD>
                        <Badge varian={TERMIN_STATUS_VARIAN[t.status] ?? 'netral'}>
                          {TERMIN_STATUS_LABEL[t.status] ?? t.status}
                        </Badge>
                      </TD>
                    </TR>
                  ))}
                </tbody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="flex flex-col gap-3">
          <h2 className="text-sm font-medium">Kepuasan pelanggan (CSAT)</h2>
          {!csat || csat.status !== 'COMPLETED' ? (
            <Kosong
              pesan={
                csat
                  ? 'Survei sudah dikirim, jawaban klien belum masuk.'
                  : 'Survei CSAT belum dibuat untuk proyek ini.'
              }
            />
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-semibold tabular-nums">
                  {csat.weightedScore === null ? '—' : Number(csat.weightedScore).toFixed(2)}
                </span>
                <span className="text-sm text-muted-foreground">
                  skor terbobot · dijawab {tanggal(csat.respondedAt)}
                </span>
              </div>
              <Table>
                <THead>
                  <TR>
                    <TH>Aspek</TH>
                    <TH className="text-right">Bobot</TH>
                    <TH className="text-right">Nilai</TH>
                    <TH className="text-right">Kontribusi</TH>
                  </TR>
                </THead>
                <tbody>
                  {BOBOT_CSAT.map((b) => {
                    const nilai = csat[b.kunci]
                    return (
                      <TR key={b.kunci}>
                        <TD>{b.label}</TD>
                        <TD className="text-right tabular-nums text-muted-foreground">
                          {b.bobot}%
                        </TD>
                        <TD className="text-right tabular-nums">{nilai ?? '—'}</TD>
                        <TD className="text-right tabular-nums">
                          {nilai === null ? '—' : ((nilai * b.bobot) / 100).toFixed(2)}
                        </TD>
                      </TR>
                    )
                  })}
                </tbody>
              </Table>
              {csat.comment && (
                <p className="text-sm text-muted-foreground">Catatan klien: {csat.comment}</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
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
