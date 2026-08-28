import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { currentActor, izinkan } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Kosong } from '@/components/ui/notice'
import { rupiah, tanggal } from '@/lib/utils'
import { LABEL_KATEGORI_BIAYA, LABEL_PERAN_PENYETUJU } from '../labels'
import { KeputusanBiaya } from './keputusan-biaya'

export default async function HalamanPersetujuanBiaya() {
  const actor = await currentActor()
  if (!actor) return null
  if (!await izinkan(actor, 'cost:approve')) notFound()

  const biaya = await db.costEntry.findMany({
    where: { pattern: 'BIDDING', status: 'PENDING_APPROVAL' },
    orderBy: { incurredAt: 'asc' },
    include: {
      tender: { select: { code: true, title: true, winRateProbability: true } },
      requestedBy: { select: { name: true } },
      approvals: { include: { approver: { select: { name: true } } } },
    },
  })

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-gap">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Persetujuan biaya tender</h1>
        <p className="text-sm text-muted-foreground">
          Biaya tender baru boleh dibayarkan setelah Direktur dan Finance Manager sama-sama
          menyetujui. Satu penolakan langsung menggugurkan pengajuan.
        </p>
      </div>

      {biaya.length === 0 ? (
        <Card>
          <CardContent>
            <Kosong pesan="Tidak ada biaya tender yang menunggu keputusan." />
          </CardContent>
        </Card>
      ) : (
        biaya.map((c) => {
          // Keputusan hanya ditawarkan bila jatah peran aktor memang belum diputuskan.
          const jatah = c.approvals.find((a) => a.role === actor.role)
          return (
            <Card key={c.id}>
              <CardContent className="flex flex-col gap-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-sm font-medium">
                    {c.tender?.code ?? '—'} — {c.tender?.title ?? 'Tender tidak diketahui'}
                  </h2>
                  <span className="text-sm font-semibold tabular-nums">
                    {rupiah(Number(c.amount))}
                  </span>
                </div>

                <dl className="grid gap-2 text-xs sm:grid-cols-2">
                  <Baris label="Kategori" nilai={LABEL_KATEGORI_BIAYA[c.category] ?? c.category} />
                  <Baris label="COA" nilai={c.coaCode} />
                  <Baris label="Tanggal pengeluaran" nilai={tanggal(c.incurredAt)} />
                  <Baris label="Pengaju" nilai={c.requestedBy.name} />
                  <Baris
                    label="Probabilitas menang"
                    nilai={`${c.tender?.winRateProbability ?? 0}%`}
                  />
                  <Baris label="Uraian" nilai={c.description} />
                </dl>

                <div className="flex flex-wrap gap-2">
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
                      {a.decision === 'PENDING'
                        ? 'menunggu keputusan'
                        : `${a.decision === 'APPROVED' ? 'setuju' : 'tolak'} — ${a.approver.name}${
                            a.decidedAt ? `, ${tanggal(a.decidedAt)}` : ''
                          }`}
                    </Badge>
                  ))}
                </div>

                {jatah && jatah.decision === 'PENDING' ? (
                  <KeputusanBiaya costEntryId={c.id} />
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Anda sudah memberikan keputusan untuk biaya ini; menunggu peran lain.
                  </p>
                )}
              </CardContent>
            </Card>
          )
        })
      )}
    </div>
  )
}

function Baris({ label, nilai }: { label: string; nilai: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{nilai}</dd>
    </div>
  )
}
