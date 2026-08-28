import Link from 'next/link'
import { db } from '@/lib/db'
import { currentActor } from '@/lib/api'
import { can } from '@/server/auth'
import { Card, CardContent } from '@/components/ui/card'
import { Badge, type VarianBadge } from '@/components/ui/badge'
import { Table, TD, TH, THead, TR } from '@/components/ui/table'
import { AksesDitolak, Kosong } from '@/components/ui/notice'
import { rupiah, sisaHari, tanggal } from '@/lib/utils'
import { LABEL_PERAN_PENYETUJU } from './labels'

const INVOICE_STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Draf',
  ISSUED: 'Terbit',
  PAID: 'Lunas',
  OVERDUE: 'Lewat jatuh tempo',
  CANCELLED: 'Dibatalkan',
}

const BIAYA_STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Draf',
  PENDING_APPROVAL: 'Menunggu persetujuan',
  APPROVED: 'Disetujui',
  REJECTED: 'Ditolak',
  PAID: 'Sudah dibayar',
}

const BIAYA_STATUS_VARIAN: Record<string, VarianBadge> = {
  DRAFT: 'netral',
  PENDING_APPROVAL: 'peringatan',
  APPROVED: 'sukses',
  REJECTED: 'bahaya',
  PAID: 'info',
}


export default async function HalamanKeuangan() {
  const actor = await currentActor()
  if (!actor) return null
  if (!can(actor, 'invoice:read')) return <AksesDitolak />

  const now = new Date()

  const [invoices, costs] = await Promise.all([
    db.invoice.findMany({
      orderBy: { dueDate: 'asc' },
      include: {
        termin: {
          select: {
            project: { select: { code: true, name: true, client: { select: { name: true } } } },
          },
        },
      },
    }),
    db.costEntry.findMany({
      orderBy: { incurredAt: 'desc' },
      include: {
        tender: { select: { code: true, title: true } },
        project: { select: { code: true, name: true } },
        requestedBy: { select: { name: true } },
        approvals: { include: { approver: { select: { name: true } } } },
      },
    }),
  ])

  const berlaku = invoices.filter((i) => i.status !== 'CANCELLED')
  const tertagih = berlaku.reduce((n, i) => n + Number(i.amount), 0)
  const terbayar = berlaku
    .filter((i) => i.paidAt !== null)
    .reduce((n, i) => n + Number(i.amount), 0)
  const lewatTempo = berlaku.filter((i) => i.paidAt === null && sisaHari(i.dueDate, now) < 0)
  const nilaiLewatTempo = lewatTempo.reduce((n, i) => n + Number(i.amount), 0)

  const biayaTender = costs.filter((c) => c.pattern === 'BIDDING')
  const biayaProyek = costs.filter((c) => c.pattern === 'PROJECT')

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-gap">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Keuangan</h1>
        <p className="text-sm text-muted-foreground">
          Penagihan dan biaya operasional per {tanggal(now)}
        </p>
      </div>

      {/* Tautan tindakan mengikuti izin yang sama persis dengan endpointnya. */}
      {(can(actor, 'cost:write') || can(actor, 'cost:approve') || can(actor, 'invoice:write')) && (
        <div className="flex flex-wrap gap-2">
          {can(actor, 'cost:write') && <TautanTindakan href="/keuangan/biaya-baru" label="Catat biaya" />}
          {can(actor, 'cost:approve') && (
            <TautanTindakan href="/keuangan/persetujuan" label="Persetujuan biaya tender" />
          )}
          {can(actor, 'invoice:write') && (
            <TautanTindakan href="/keuangan/termin-baru" label="Rencana termin" />
          )}
          {can(actor, 'invoice:write') && (
            <TautanTindakan href="/keuangan/invoice-baru" label="Terbitkan invoice" />
          )}
        </div>
      )}

      <div className="grid gap-gap sm:grid-cols-2 lg:grid-cols-4">
        <KartuNominal label="Total tertagih" nilai={tertagih} />
        <KartuNominal label="Sudah terbayar" nilai={terbayar} />
        <KartuNominal label="Outstanding" nilai={tertagih - terbayar} />
        <KartuNominal
          label={`Lewat jatuh tempo (${lewatTempo.length})`}
          nilai={nilaiLewatTempo}
          menonjol={lewatTempo.length > 0}
        />
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3">
          <h2 className="text-sm font-medium">Invoice</h2>
          {invoices.length === 0 ? (
            <Kosong pesan="Belum ada invoice yang terbit." />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Nomor</TH>
                  <TH>Proyek</TH>
                  <TH>Klien</TH>
                  <TH className="text-right">Nominal</TH>
                  <TH>Terbit</TH>
                  <TH>Jatuh tempo</TH>
                  <TH>Pembayaran</TH>
                  <TH>Status</TH>
                </TR>
              </THead>
              <tbody>
                {invoices.map((i) => {
                  const sisa = sisaHari(i.dueDate, now)
                  const lunas = i.paidAt !== null
                  const dibatalkan = i.status === 'CANCELLED'
                  return (
                    <TR key={i.id}>
                      <TD className="font-medium whitespace-nowrap">{i.number}</TD>
                      <TD className="whitespace-nowrap">{i.termin.project.code}</TD>
                      <TD className="max-w-40 truncate text-muted-foreground">
                        {i.termin.project.client.name}
                      </TD>
                      <TD className="text-right tabular-nums whitespace-nowrap">
                        {rupiah(Number(i.amount))}
                      </TD>
                      <TD className="whitespace-nowrap">{tanggal(i.issuedAt)}</TD>
                      <TD className="whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span>{tanggal(i.dueDate)}</span>
                          {/* Penanda hanya relevan selama tagihan belum lunas. */}
                          {!lunas && !dibatalkan && sisa < 0 && (
                            <Badge varian="bahaya">H+{Math.abs(sisa)} lewat tempo</Badge>
                          )}
                          {!lunas && !dibatalkan && sisa >= 0 && sisa <= 3 && (
                            <Badge varian="peringatan">H-{sisa}</Badge>
                          )}
                        </div>
                      </TD>
                      <TD>
                        {lunas ? (
                          <Badge varian="sukses">Lunas {tanggal(i.paidAt)}</Badge>
                        ) : (
                          <Badge varian="netral">Belum lunas</Badge>
                        )}
                      </TD>
                      <TD>
                        <Badge varian={lunas ? 'sukses' : dibatalkan ? 'netral' : 'info'}>
                          {INVOICE_STATUS_LABEL[i.status] ?? i.status}
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
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-medium">Pola 1 — Biaya Tender</h2>
            <span className="text-sm tabular-nums">
              Total {rupiah(biayaTender.reduce((n, c) => n + Number(c.amount), 0))}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Biaya yang hangus menjadi beban pemasaran bila tender tidak dimenangkan.
          </p>
          {biayaTender.length === 0 ? (
            <Kosong pesan="Belum ada biaya tender tercatat." />
          ) : (
            <TabelBiaya daftar={biayaTender} kolomAcuan="Tender" />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-medium">Pola 2 — Biaya Proyek</h2>
            <span className="text-sm tabular-nums">
              Total {rupiah(biayaProyek.reduce((n, c) => n + Number(c.amount), 0))}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Biaya langsung yang ditanggung anggaran proyek dan masuk perhitungan HPP.
          </p>
          {biayaProyek.length === 0 ? (
            <Kosong pesan="Belum ada biaya proyek tercatat." />
          ) : (
            <TabelBiaya daftar={biayaProyek} kolomAcuan="Proyek" />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function TautanTindakan({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex h-9 items-center rounded-md border px-4 text-sm font-medium transition hover:bg-accent hover:text-accent-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
    >
      {label}
    </Link>
  )
}

interface BarisBiaya {
  id: string
  category: string
  coaCode: string
  description: string
  amount: unknown
  incurredAt: Date
  status: string
  tender: { code: string; title: string } | null
  project: { code: string; name: string } | null
  requestedBy: { name: string }
  approvals: { id: string; role: string; decision: string; approver: { name: string } }[]
}

function TabelBiaya({ daftar, kolomAcuan }: { daftar: BarisBiaya[]; kolomAcuan: string }) {
  return (
    <Table>
      <THead>
        <TR>
          <TH>{kolomAcuan}</TH>
          <TH>Uraian</TH>
          <TH>Kategori</TH>
          <TH>COA</TH>
          <TH className="text-right">Nominal</TH>
          <TH>Tanggal</TH>
          <TH>Pengaju</TH>
          <TH>Persetujuan</TH>
          <TH>Status</TH>
        </TR>
      </THead>
      <tbody>
        {daftar.map((c) => (
          <TR key={c.id}>
            <TD className="font-medium whitespace-nowrap">
              {c.tender?.code ?? c.project?.code ?? '—'}
            </TD>
            <TD className="max-w-56 truncate">{c.description}</TD>
            <TD className="whitespace-nowrap text-muted-foreground">{c.category}</TD>
            <TD className="whitespace-nowrap text-muted-foreground">{c.coaCode}</TD>
            <TD className="text-right tabular-nums whitespace-nowrap">
              {rupiah(Number(c.amount))}
            </TD>
            <TD className="whitespace-nowrap">{tanggal(c.incurredAt)}</TD>
            <TD className="max-w-32 truncate text-muted-foreground">{c.requestedBy.name}</TD>
            <TD>
              {c.approvals.length === 0 ? (
                <span className="text-muted-foreground">Belum diajukan</span>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {c.approvals.map((a) => (
                    <Badge
                      key={a.id}
                      varian={
                        a.decision === 'APPROVED'
                          ? 'sukses'
                          : a.decision === 'REJECTED'
                            ? 'bahaya'
                            : 'peringatan'
                      }
                    >
                      {LABEL_PERAN_PENYETUJU[a.role] ?? a.role}:{' '}
                      {a.decision === 'APPROVED'
                        ? `setuju (${a.approver.name})`
                        : a.decision === 'REJECTED'
                          ? 'tolak'
                          : 'menunggu'}
                    </Badge>
                  ))}
                </div>
              )}
            </TD>
            <TD>
              <Badge varian={BIAYA_STATUS_VARIAN[c.status] ?? 'netral'}>
                {BIAYA_STATUS_LABEL[c.status] ?? c.status}
              </Badge>
            </TD>
          </TR>
        ))}
      </tbody>
    </Table>
  )
}

function KartuNominal({
  label,
  nilai,
  menonjol,
}: {
  label: string
  nilai: number
  menonjol?: boolean
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-2">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <p
          className={
            menonjol
              ? 'text-lg font-semibold tabular-nums text-destructive'
              : 'text-lg font-semibold tabular-nums'
          }
        >
          {rupiah(nilai)}
        </p>
      </CardContent>
    </Card>
  )
}
