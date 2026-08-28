'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TD, TH, THead, TR } from '@/components/ui/table'
import { Kosong } from '@/components/ui/notice'
import { Field, GalatForm, Input, Select } from '@/components/ui/field'
import { kirim } from '@/lib/kirim'
import { tanggal } from '@/lib/utils'
import {
  TECHNICAL_STAGE_ORDER,
  prerequisiteStages,
  type DeliverableStatus,
  type LabSampleStatus,
  type TechnicalStage,
} from '@/server/lifecycle/rules'
import {
  DELIVERABLE_STATUS_LABEL,
  DELIVERABLE_STATUS_VARIAN,
  DELIVERABLE_TYPE_LABEL,
} from '../../labels'

const TAHAP_LABEL: Record<TechnicalStage, string> = {
  DESK_STUDY: 'Kajian meja',
  SAMPLING_PLAN: 'Rencana sampling',
  LAB_TEST: 'Uji laboratorium',
  DRAFT_REPORT: 'Draf laporan',
  EXPOSE: 'Ekspose',
  FINAL_REPORT: 'Laporan akhir',
}

/** Tahap yang punya Deliverable sendiri; LAB_TEST diwakili sampel laboratorium. */
const TAHAP_DELIVERABLE = TECHNICAL_STAGE_ORDER.filter((s) => s !== 'LAB_TEST')

const AKSI_DELIVERABLE: { dari: DeliverableStatus; ke: DeliverableStatus; label: string }[] = [
  { dari: 'PENDING', ke: 'IN_PROGRESS', label: 'Mulai kerjakan' },
  { dari: 'IN_PROGRESS', ke: 'QC_REVIEW', label: 'Ajukan ke QC' },
  { dari: 'QC_REVIEW', ke: 'SUBMITTED', label: 'Serahkan ke klien' },
  { dari: 'SUBMITTED', ke: 'APPROVED', label: 'Tandai disetujui' },
]

const MATRIKS = [
  ['AIR', 'Air'],
  ['UDARA', 'Udara'],
  ['TANAH', 'Tanah'],
  ['FLORA', 'Flora'],
  ['FAUNA', 'Fauna'],
  ['SOSEKBUD', 'Sosekbud'],
] as const

const SAMPEL_STATUS_LABEL: Record<string, string> = {
  COLLECTED: 'Diambil',
  SENT: 'Dikirim ke lab',
  TESTED: 'Selesai diuji',
  REPORTED: 'Hasil terbit',
}

const AKSI_SAMPEL: { dari: LabSampleStatus; ke: LabSampleStatus; label: string }[] = [
  { dari: 'COLLECTED', ke: 'SENT', label: 'Kirim ke lab' },
  { dari: 'SENT', ke: 'TESTED', label: 'Tandai selesai diuji' },
  { dari: 'TESTED', ke: 'REPORTED', label: 'Hasil terbit' },
]

interface BarisDeliverable {
  id: string
  type: string
  name: string
  status: string
  dueDate: string
}

interface BarisSampel {
  id: string
  sampleCode: string
  matrix: string
  location: string
  laboratory: string
  cocNumber: string | null
  status: string
  takenAt: string
}

export function PanelPekerjaan({
  projectId,
  approvedStages,
  deliverables,
  samples,
}: {
  projectId: string
  approvedStages: TechnicalStage[]
  deliverables: BarisDeliverable[]
  samples: BarisSampel[]
}) {
  const router = useRouter()
  const [galat, setGalat] = useState<string | null>(null)
  const [sibuk, setSibuk] = useState<string | null>(null)

  async function ubah(url: string, status: string, kunci: string) {
    setSibuk(kunci)
    setGalat(null)
    const hasil = await kirim(url, 'PATCH', { status })
    setSibuk(null)
    if (!hasil.ok) {
      setGalat(hasil.pesan ?? 'Perubahan status ditolak.')
      return
    }
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-gap">
      <GalatForm pesan={galat} />

      <Card>
        <CardContent className="flex flex-col gap-3">
          <div>
            <h2 className="text-sm font-medium">Urutan tahapan wajib</h2>
            <p className="text-xs text-muted-foreground">
              Sebuah tahap baru boleh dimulai bila seluruh tahap sebelumnya sudah disetujui.
              Server yang memutuskan; daftar ini hanya petunjuk.
            </p>
          </div>
          <ol className="flex flex-col gap-1.5">
            {TECHNICAL_STAGE_ORDER.map((stage, urutan) => {
              const selesai = approvedStages.includes(stage)
              const kurang = prerequisiteStages(stage).filter((p) => !approvedStages.includes(p))
              return (
                <li key={stage} className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="w-5 tabular-nums text-muted-foreground">{urutan + 1}.</span>
                  <span>{TAHAP_LABEL[stage]}</span>
                  {selesai ? (
                    <Badge varian="sukses">Disetujui</Badge>
                  ) : kurang.length > 0 ? (
                    <Badge varian="netral">
                      Menunggu {kurang.map((k) => TAHAP_LABEL[k]).join(', ')}
                    </Badge>
                  ) : (
                    <Badge varian="info">Siap dimulai</Badge>
                  )}
                </li>
              )
            })}
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-3">
          <h2 className="text-sm font-medium">Deliverable</h2>
          {deliverables.length === 0 ? (
            <Kosong pesan="Belum ada tahapan teknis yang dimulai." />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Pekerjaan</TH>
                  <TH>Jenis</TH>
                  <TH>Tenggat</TH>
                  <TH>Status</TH>
                  <TH>Tindakan</TH>
                </TR>
              </THead>
              <tbody>
                {deliverables.map((d) => {
                  const aksi = AKSI_DELIVERABLE.find((a) => a.dari === d.status)
                  return (
                    <TR key={d.id}>
                      <TD className="font-medium">{d.name}</TD>
                      <TD className="whitespace-nowrap text-muted-foreground">
                        {DELIVERABLE_TYPE_LABEL[d.type] ?? d.type}
                      </TD>
                      <TD className="whitespace-nowrap">{tanggal(d.dueDate)}</TD>
                      <TD>
                        <Badge varian={DELIVERABLE_STATUS_VARIAN[d.status] ?? 'netral'}>
                          {DELIVERABLE_STATUS_LABEL[d.status] ?? d.status}
                        </Badge>
                      </TD>
                      <TD>
                        {aksi ? (
                          <Button
                            ukuran="sm"
                            varian="garis"
                            disabled={sibuk === d.id}
                            onClick={() =>
                              ubah(`/api/deliverables/${d.id}/status`, aksi.ke, d.id)
                            }
                          >
                            {sibuk === d.id ? 'Memproses…' : aksi.label}
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">Selesai</span>
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

      <FormTahap projectId={projectId} approvedStages={approvedStages} />

      <Card>
        <CardContent className="flex flex-col gap-3">
          <h2 className="text-sm font-medium">Sampel laboratorium</h2>
          {samples.length === 0 ? (
            <Kosong pesan="Belum ada sampel yang diambil." />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Kode</TH>
                  <TH>Matriks</TH>
                  <TH>Lokasi</TH>
                  <TH>Diambil</TH>
                  <TH>Laboratorium</TH>
                  <TH>No. CoC</TH>
                  <TH>Status</TH>
                  <TH>Tindakan</TH>
                </TR>
              </THead>
              <tbody>
                {samples.map((s) => {
                  const aksi = AKSI_SAMPEL.find((a) => a.dari === s.status)
                  return (
                    <TR key={s.id}>
                      <TD className="font-medium whitespace-nowrap">{s.sampleCode}</TD>
                      <TD>{MATRIKS.find(([n]) => n === s.matrix)?.[1] ?? s.matrix}</TD>
                      <TD className="max-w-40 truncate text-muted-foreground">{s.location}</TD>
                      <TD className="whitespace-nowrap">{tanggal(s.takenAt)}</TD>
                      <TD className="max-w-36 truncate">{s.laboratory}</TD>
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
                      <TD>
                        {aksi ? (
                          <Button
                            ukuran="sm"
                            varian="garis"
                            disabled={sibuk === s.id}
                            onClick={() =>
                              ubah(`/api/lab-samples/${s.id}/status`, aksi.ke, s.id)
                            }
                          >
                            {sibuk === s.id ? 'Memproses…' : aksi.label}
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">Selesai</span>
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

      <FormSampel projectId={projectId} />
    </div>
  )
}

function FormTahap({
  projectId,
  approvedStages,
}: {
  projectId: string
  approvedStages: TechnicalStage[]
}) {
  const router = useRouter()
  const [galat, setGalat] = useState<string | null>(null)
  const [memproses, setMemproses] = useState(false)

  async function simpan(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setMemproses(true)
    setGalat(null)

    const form = e.currentTarget
    const f = new FormData(form)
    const hasil = await kirim('/api/deliverables', 'POST', {
      projectId,
      type: String(f.get('type') ?? ''),
      name: String(f.get('name') ?? '').trim(),
      dueDate: new Date(String(f.get('dueDate'))).toISOString(),
    })

    if (!hasil.ok) {
      setGalat(hasil.pesan ?? 'Tahap tidak dapat dimulai.')
      setMemproses(false)
      return
    }

    form.reset()
    setMemproses(false)
    router.refresh()
  }

  return (
    <form onSubmit={simpan}>
      <Card>
        <CardContent className="flex flex-col gap-4">
          <div>
            <h2 className="text-sm font-medium">Mulai tahap berikutnya</h2>
            <p className="text-xs text-muted-foreground">
              Tahap yang prasyaratnya belum lengkap ditandai, tetapi tetap boleh dicoba —
              penolakan datang dari server.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tahap" wajib>
              <Select name="type" required defaultValue="">
                <option value="" disabled>
                  — pilih tahap —
                </option>
                {TAHAP_DELIVERABLE.map((stage) => {
                  const kurang = prerequisiteStages(stage).filter(
                    (p) => !approvedStages.includes(p),
                  )
                  return (
                    <option key={stage} value={stage}>
                      {TAHAP_LABEL[stage]}
                      {kurang.length > 0 ? ' (prasyarat belum lengkap)' : ''}
                    </option>
                  )
                })}
              </Select>
            </Field>
            <Field label="Tenggat" wajib hint="Peringatan dikirim H-14, H-7, dan H-3.">
              <Input name="dueDate" type="date" required />
            </Field>
          </div>

          <Field label="Nama pekerjaan" wajib>
            <Input name="name" required minLength={3} />
          </Field>

          <GalatForm pesan={galat} />

          <div className="flex justify-end">
            <Button type="submit" disabled={memproses}>
              {memproses ? 'Memproses…' : 'Mulai tahap'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  )
}

function FormSampel({ projectId }: { projectId: string }) {
  const router = useRouter()
  const [galat, setGalat] = useState<string | null>(null)
  const [memproses, setMemproses] = useState(false)

  async function simpan(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setMemproses(true)
    setGalat(null)

    const form = e.currentTarget
    const f = new FormData(form)
    const coc = String(f.get('cocNumber') ?? '').trim()

    const hasil = await kirim('/api/lab-samples', 'POST', {
      projectId,
      sampleCode: String(f.get('sampleCode') ?? '').trim(),
      matrix: String(f.get('matrix') ?? ''),
      location: String(f.get('location') ?? '').trim(),
      takenAt: new Date(String(f.get('takenAt'))).toISOString(),
      laboratory: String(f.get('laboratory') ?? '').trim(),
      cocNumber: coc === '' ? undefined : coc,
    })

    if (!hasil.ok) {
      setGalat(hasil.pesan ?? 'Gagal menyimpan sampel.')
      setMemproses(false)
      return
    }

    form.reset()
    setMemproses(false)
    router.refresh()
  }

  return (
    <form onSubmit={simpan}>
      <Card>
        <CardContent className="flex flex-col gap-4">
          <h2 className="text-sm font-medium">Tambah sampel</h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Kode sampel" wajib>
              <Input name="sampleCode" required />
            </Field>
            <Field label="Matriks" wajib>
              <Select name="matrix" required defaultValue="AIR">
                {MATRIKS.map(([nilai, label]) => (
                  <option key={nilai} value={nilai}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field label="Lokasi pengambilan" wajib>
            <Input name="location" required minLength={3} />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Waktu pengambilan" wajib>
              <Input name="takenAt" type="datetime-local" required />
            </Field>
            <Field label="Laboratorium" wajib hint="Wajib terakreditasi KAN.">
              <Input name="laboratory" required />
            </Field>
          </div>

          <Field
            label="Nomor Chain of Custody"
            hint="Boleh menyusul, tetapi sampel tidak dapat dikirim ke lab tanpa nomor ini."
          >
            <Input name="cocNumber" />
          </Field>

          <GalatForm pesan={galat} />

          <div className="flex justify-end">
            <Button type="submit" disabled={memproses}>
              {memproses ? 'Menyimpan…' : 'Simpan sampel'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  )
}
