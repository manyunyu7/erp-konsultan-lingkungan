import Link from 'next/link'
import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { currentActor } from '@/lib/api'
import { can } from '@/server/auth'
import {
  MANPOWER_REQUEST_STATUSES,
  canTransitionManpowerRequest,
  getSelectionStages,
  type ManpowerRequestStatus,
} from '@/server/hr'
import { Card, CardContent } from '@/components/ui/card'
import { Badge, type VarianBadge } from '@/components/ui/badge'
import { Kosong } from '@/components/ui/notice'
import { tanggal } from '@/lib/utils'
import { KEPEGAWAIAN_LABEL, STATUS_KEBUTUHAN_LABEL, TAHAPAN_LABEL } from '../labels'
import { FormKebutuhan } from './form-kebutuhan'
import { TombolTransisi } from './tombol-transisi'

const STATUS_VARIAN: Record<string, VarianBadge> = {
  SUBMITTED: 'info',
  APPROVED: 'sukses',
  REJECTED: 'bahaya',
  FULFILLED: 'netral',
}

export default async function HalamanKebutuhanPersonel() {
  const actor = await currentActor()
  if (!actor) return null
  if (!can(actor, 'personnel:read')) notFound()

  const bolehTulis = can(actor, 'personnel:write')

  const requests = await db.manpowerRequest.findMany({
    orderBy: { createdAt: 'desc' },
    include: { requestedBy: { select: { name: true } } },
  })

  // Tahapan seleksi diambil dari domain per form, bukan disalin ke tampilan.
  const tahapan = await Promise.all(requests.map((r) => getSelectionStages(r.id)))

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-gap">
      <div>
        <Link href="/personel" className="text-xs text-muted-foreground hover:underline">
          ← Kembali ke daftar personel
        </Link>
        <h1 className="mt-1 text-lg font-semibold tracking-tight">Kebutuhan personel (F-HR-01)</h1>
        <p className="text-sm text-muted-foreground">
          Pengajuan penambahan personel beserta tahapan seleksi yang berlaku.
        </p>
      </div>

      {bolehTulis && (
        <Card>
          <CardContent className="flex flex-col gap-3">
            <h2 className="text-sm font-medium">Ajukan kebutuhan baru</h2>
            <FormKebutuhan />
          </CardContent>
        </Card>
      )}

      {requests.length === 0 ? (
        <Card>
          <CardContent>
            <Kosong pesan="Belum ada Form Kebutuhan Personel." />
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-gap">
          {requests.map((r, i) => {
            const status = r.status as ManpowerRequestStatus
            const tersedia = MANPOWER_REQUEST_STATUSES.filter((tujuan) =>
              canTransitionManpowerRequest(status, tujuan),
            )
            return (
              <Card key={r.id}>
                <CardContent className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge varian={STATUS_VARIAN[r.status] ?? 'netral'}>
                      {STATUS_KEBUTUHAN_LABEL[r.status] ?? r.status}
                    </Badge>
                    <span className="text-sm font-medium">{r.formNumber}</span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      Diajukan {r.requestedBy.name} · {tanggal(r.createdAt)}
                    </span>
                  </div>

                  <div className="grid gap-3 text-sm sm:grid-cols-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Posisi</p>
                      <p className="font-medium">{r.position}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Kepegawaian</p>
                      <p>{KEPEGAWAIAN_LABEL[r.employmentType] ?? r.employmentType}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Jumlah</p>
                      <p className="tabular-nums">{r.quantity} orang</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Dibutuhkan</p>
                      <p>{tanggal(r.neededBy)}</p>
                    </div>
                    <div className="sm:col-span-2">
                      <p className="text-xs text-muted-foreground">Kualifikasi</p>
                      <p>{r.qualification}</p>
                    </div>
                    <div className="sm:col-span-2">
                      <p className="text-xs text-muted-foreground">Sertifikasi dibutuhkan</p>
                      <p>{r.certifications}</p>
                    </div>
                  </div>

                  <div>
                    <p className="mb-1 text-xs text-muted-foreground">Tahapan seleksi</p>
                    <div className="flex flex-wrap gap-1">
                      {tahapan[i].map((t, urutan) => (
                        <Badge key={t} varian="netral">
                          {urutan + 1}. {TAHAPAN_LABEL[t] ?? t}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {bolehTulis && <TombolTransisi id={r.id} tersedia={tersedia} />}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
