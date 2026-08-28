import { AlertTriangle, Bell, FileClock, FolderKanban, Gavel, Receipt } from 'lucide-react'
import { db } from '@/lib/db'
import { currentActor, izinkan } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TD, TH, THead, TR } from '@/components/ui/table'
import { rupiah, sisaHari, tanggal } from '@/lib/utils'

/**
 * Beranda membaca database secara langsung karena ini komponen server —
 * memanggil API sendiri lewat HTTP hanya akan menambah satu lompatan jaringan.
 * Endpoint di /api tetap tersedia untuk antarmuka lain (mis. template beli).
 */
export default async function Beranda() {
  const actor = await currentActor()
  if (!actor) return null
  const now = new Date()

  const [tenderAktif, proyekBerjalan, tenggat, belumDibaca, proyek] = await Promise.all([
    db.tender.count({ where: { status: { in: ['IDENTIFIED', 'PREPARING', 'SUBMITTED'] } } }),
    db.project.count({ where: { status: { in: ['PREPARATION', 'RUNNING', 'REPORTING'] } } }),
    db.deliverable.findMany({
      where: { status: { not: 'APPROVED' } },
      orderBy: { dueDate: 'asc' },
      take: 6,
      include: { project: { select: { code: true, name: true } } },
    }),
    db.notificationRecipient.count({ where: { userId: actor.id, readAt: null } }),
    db.project.findMany({
      where: { status: { in: ['PREPARATION', 'RUNNING', 'REPORTING', 'CLOSING'] } },
      orderBy: { endDate: 'asc' },
      take: 6,
      include: { client: { select: { name: true } } },
    }),
  ])

  const bolehKeuangan = await izinkan(actor, 'invoice:read')
  const invoiceJatuhTempo = bolehKeuangan
    ? await db.invoice.count({
        where: { paidAt: null, dueDate: { lt: now }, status: { not: 'CANCELLED' } },
      })
    : 0

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-gap">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Beranda</h1>
        <p className="text-sm text-muted-foreground">
          Ringkasan operasional per {tanggal(now)}
        </p>
      </div>

      <div className="grid gap-gap sm:grid-cols-2 lg:grid-cols-4">
        <KartuAngka ikon={<Gavel className="size-4" />} label="Tender aktif" nilai={tenderAktif} />
        <KartuAngka
          ikon={<FolderKanban className="size-4" />}
          label="Proyek berjalan"
          nilai={proyekBerjalan}
        />
        <KartuAngka
          ikon={<Bell className="size-4" />}
          label="Peringatan belum dibaca"
          nilai={belumDibaca}
          menonjol={belumDibaca > 0}
        />
        {bolehKeuangan && (
          <KartuAngka
            ikon={<Receipt className="size-4" />}
            label="Invoice lewat jatuh tempo"
            nilai={invoiceJatuhTempo}
            menonjol={invoiceJatuhTempo > 0}
          />
        )}
      </div>

      <div className="grid gap-gap lg:grid-cols-2">
        <Card>
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <FileClock className="size-4 text-muted-foreground" />
              <h2 className="text-sm font-medium">Tenggat pekerjaan terdekat</h2>
            </div>
            {tenggat.length === 0 ? (
              <p className="text-sm text-muted-foreground">Tidak ada tenggat tertunda.</p>
            ) : (
              <Table>
                <THead>
                  <TR>
                    <TH>Pekerjaan</TH>
                    <TH>Proyek</TH>
                    <TH>Tenggat</TH>
                  </TR>
                </THead>
                <tbody>
                  {tenggat.map((d) => {
                    const sisa = sisaHari(d.dueDate, now)
                    return (
                      <TR key={d.id}>
                        <TD className="font-medium">{d.name}</TD>
                        <TD className="text-muted-foreground">{d.project.code}</TD>
                        <TD>
                          <Badge
                            varian={sisa < 0 ? 'bahaya' : sisa <= 3 ? 'peringatan' : 'netral'}
                          >
                            {sisa < 0 ? `Lewat ${Math.abs(sisa)} hari` : `H-${sisa}`}
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
            <div className="flex items-center gap-2">
              <FolderKanban className="size-4 text-muted-foreground" />
              <h2 className="text-sm font-medium">Proyek berjalan</h2>
            </div>
            {proyek.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada proyek berjalan.</p>
            ) : (
              <Table>
                <THead>
                  <TR>
                    <TH>Kode</TH>
                    <TH>Klien</TH>
                    {bolehKeuangan && <TH className="text-right">Nilai</TH>}
                    <TH>Berakhir</TH>
                  </TR>
                </THead>
                <tbody>
                  {proyek.map((p) => (
                    <TR key={p.id}>
                      <TD className="font-medium">{p.code}</TD>
                      <TD className="max-w-40 truncate text-muted-foreground">{p.client.name}</TD>
                      {bolehKeuangan && (
                        <TD className="text-right tabular-nums">
                          {rupiah(Number(p.contractValue))}
                        </TD>
                      )}
                      <TD className="whitespace-nowrap">{tanggal(p.endDate)}</TD>
                    </TR>
                  ))}
                </tbody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function KartuAngka({
  ikon,
  label,
  nilai,
  menonjol,
}: {
  ikon: React.ReactNode
  label: string
  nilai: number
  menonjol?: boolean
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-muted-foreground">
          {menonjol ? <AlertTriangle className="size-4 text-[var(--warning)]" /> : ikon}
          <span className="text-xs font-medium">{label}</span>
        </div>
        <p className="text-2xl font-semibold tabular-nums">{nilai}</p>
      </CardContent>
    </Card>
  )
}
