import { db } from '@/lib/db'
import { currentActor } from '@/lib/api'
import { can } from '@/server/auth'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TD, TH, THead, TR } from '@/components/ui/table'
import { AksesDitolak, Kosong } from '@/components/ui/notice'
import { sisaHari, tanggal } from '@/lib/utils'

const KEPEGAWAIAN_LABEL: Record<string, string> = {
  TETAP: 'Karyawan tetap',
  PKWT: 'PKWT',
  FREELANCE_EXPERT: 'Tenaga ahli lepas',
}

const SERTIFIKAT_LABEL: Record<string, string> = {
  KTPA: 'KTPA',
  ATPA: 'ATPA',
  K3: 'K3',
  AMBIL_SAMPEL: 'Pengambil sampel',
  SKK: 'SKK',
  LAINNYA: 'Lainnya',
}

/** Proyek yang penugasannya masih dianggap berjalan. */
const STATUS_BERJALAN = ['PREPARATION', 'RUNNING', 'REPORTING', 'CLOSING']

export default async function HalamanPersonel() {
  const actor = await currentActor()
  if (!actor) return null
  if (!can(actor, 'personnel:read')) return <AksesDitolak />

  const bolehKpi = can(actor, 'kpi:read')
  const now = new Date()

  const personnel = await db.personnel.findMany({
    orderBy: [{ isActive: 'desc' }, { fullName: 'asc' }],
    include: {
      certifications: { orderBy: { expiresAt: 'asc' } },
      assignments: {
        where: { project: { status: { in: STATUS_BERJALAN } } },
        include: { project: { select: { code: true, name: true } } },
        orderBy: { startDate: 'asc' },
      },
      evaluations: { orderBy: { evaluatedAt: 'desc' }, take: 1 },
    },
  })

  const kedaluwarsa = personnel.flatMap((p) =>
    p.certifications.filter((c) => sisaHari(c.expiresAt, now) < 0),
  ).length
  const segeraHabis = personnel.flatMap((p) =>
    p.certifications.filter((c) => {
      const sisa = sisaHari(c.expiresAt, now)
      return sisa >= 0 && sisa <= 60
    }),
  ).length

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-gap">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Personel</h1>
        <p className="text-sm text-muted-foreground">
          Sertifikat yang habis dalam 60 hari ditandai peringatan — per {tanggal(now)}
        </p>
      </div>

      {(kedaluwarsa > 0 || segeraHabis > 0) && (
        <Card>
          <CardContent className="flex flex-wrap items-center gap-3 text-sm">
            {kedaluwarsa > 0 && (
              <Badge varian="bahaya">{kedaluwarsa} sertifikat sudah kedaluwarsa</Badge>
            )}
            {segeraHabis > 0 && (
              <Badge varian="peringatan">{segeraHabis} sertifikat habis dalam 60 hari</Badge>
            )}
            <span className="text-muted-foreground">Perlu diurus perpanjangannya.</span>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="flex flex-col gap-3">
          <h2 className="text-sm font-medium">Daftar personel</h2>
          {personnel.length === 0 ? (
            <Kosong pesan="Belum ada personel tercatat." />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Nama</TH>
                  <TH>Kepegawaian</TH>
                  <TH>Jabatan</TH>
                  <TH>Keahlian</TH>
                  <TH>Sertifikasi</TH>
                  <TH>Penugasan berjalan</TH>
                  {bolehKpi && <TH className="text-right">KPI terakhir</TH>}
                </TR>
              </THead>
              <tbody>
                {personnel.map((p) => {
                  const kpi = p.evaluations[0]
                  return (
                    <TR key={p.id}>
                      <TD className="font-medium whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span>{p.fullName}</span>
                          {!p.isActive && <Badge varian="netral">Nonaktif</Badge>}
                        </div>
                      </TD>
                      <TD className="whitespace-nowrap">
                        {KEPEGAWAIAN_LABEL[p.employmentType] ?? p.employmentType}
                      </TD>
                      <TD>{p.position}</TD>
                      <TD className="max-w-40 truncate text-muted-foreground">
                        {p.expertise ?? '—'}
                      </TD>
                      <TD>
                        {p.certifications.length === 0 ? (
                          <span className="text-muted-foreground">Belum ada</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {p.certifications.map((c) => {
                              const sisa = sisaHari(c.expiresAt, now)
                              const nama = SERTIFIKAT_LABEL[c.name] ?? c.name
                              return (
                                <Badge
                                  key={c.id}
                                  varian={
                                    sisa < 0 ? 'bahaya' : sisa <= 60 ? 'peringatan' : 'netral'
                                  }
                                  title={`Berlaku sampai ${tanggal(c.expiresAt)}`}
                                >
                                  {nama}
                                  {sisa < 0
                                    ? ` · kedaluwarsa ${tanggal(c.expiresAt)}`
                                    : sisa <= 60
                                      ? ` · H-${sisa}`
                                      : ''}
                                </Badge>
                              )
                            })}
                          </div>
                        )}
                      </TD>
                      <TD>
                        {p.assignments.length === 0 ? (
                          <span className="text-muted-foreground">Tidak ada</span>
                        ) : (
                          <div className="flex flex-col gap-0.5">
                            {p.assignments.map((a) => (
                              <span key={a.id} className="whitespace-nowrap">
                                {a.project.code}
                                <span className="text-muted-foreground"> · {a.role}</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </TD>
                      {bolehKpi && (
                        <TD className="text-right tabular-nums whitespace-nowrap">
                          {kpi ? (
                            <span title={`Dinilai ${tanggal(kpi.evaluatedAt)}`}>
                              {Number(kpi.totalScore).toFixed(1)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">Belum dinilai</span>
                          )}
                        </TD>
                      )}
                    </TR>
                  )
                })}
              </tbody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
