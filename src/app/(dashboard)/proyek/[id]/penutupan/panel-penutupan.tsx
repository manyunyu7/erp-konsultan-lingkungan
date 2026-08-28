'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Field, GalatForm, Input, Textarea } from '@/components/ui/field'
import { kirim } from '@/lib/kirim'
import { CSAT_WEIGHTS, calculateCsatScore, type CsatScores } from '@/server/lifecycle/rules'

/** Bobot ditampilkan dari sumber aturan, bukan angka yang diketik ulang di UI. */
const ASPEK_CSAT = [
  { kunci: 'technicalScore', label: 'Mutu teknis', bobot: CSAT_WEIGHTS.technical },
  { kunci: 'timelinessScore', label: 'Ketepatan waktu', bobot: CSAT_WEIGHTS.timeliness },
  { kunci: 'responsivenessScore', label: 'Komunikasi', bobot: CSAT_WEIGHTS.responsiveness },
  { kunci: 'complianceScore', label: 'Administrasi', bobot: CSAT_WEIGHTS.compliance },
] as const satisfies readonly { kunci: keyof CsatScores; label: string; bobot: number }[]

const NILAI_AWAL: CsatScores = {
  technicalScore: 0,
  timelinessScore: 0,
  responsivenessScore: 0,
  complianceScore: 0,
}

const CSAT_STATUS_LABEL: Record<string, string> = {
  SENT: 'Sudah dikirim ke klien',
  COMPLETED: 'Sudah dijawab klien',
}

export function PanelPenutupan({
  projectId,
  bolehCsat,
  bast,
  csatStatus,
}: {
  projectId: string
  bolehCsat: boolean
  bast: { number: string; signedAt: string } | null
  csatStatus: string | null
}) {
  return (
    <div className="flex flex-col gap-gap">
      <FormBast projectId={projectId} bast={bast} />
      {bolehCsat && (
        <>
          <KirimCsat projectId={projectId} csatStatus={csatStatus} />
          <FormJawabanCsat projectId={projectId} />
        </>
      )}
    </div>
  )
}

function FormBast({
  projectId,
  bast,
}: {
  projectId: string
  bast: { number: string; signedAt: string } | null
}) {
  const router = useRouter()
  const [galat, setGalat] = useState<string | null>(null)
  const [memproses, setMemproses] = useState(false)

  async function simpan(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setMemproses(true)
    setGalat(null)

    const f = new FormData(e.currentTarget)
    const izin = String(f.get('permitNumber') ?? '').trim()

    const hasil = await kirim('/api/bast', 'POST', {
      projectId,
      number: String(f.get('number') ?? '').trim(),
      signedAt: new Date(String(f.get('signedAt'))).toISOString(),
      permitNumber: izin === '' ? undefined : izin,
    })

    if (!hasil.ok) {
      setGalat(hasil.pesan ?? 'BAST gagal diterbitkan.')
      setMemproses(false)
      return
    }

    setMemproses(false)
    router.refresh()
  }

  if (bast) {
    return (
      <Card>
        <CardContent className="flex flex-col gap-2">
          <h2 className="text-sm font-medium">Berita Acara Serah Terima</h2>
          <p className="text-sm">
            {bast.number} · diteken {bast.signedAt}
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <form onSubmit={simpan}>
      <Card>
        <CardContent className="flex flex-col gap-4">
          <div>
            <h2 className="text-sm font-medium">Terbitkan BAST</h2>
            <p className="text-xs text-muted-foreground">
              Hanya bisa diterbitkan setelah laporan akhir berstatus disetujui.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nomor BAST" wajib>
              <Input name="number" required minLength={3} />
            </Field>
            <Field label="Tanggal tanda tangan" wajib>
              <Input name="signedAt" type="date" required />
            </Field>
          </div>

          <Field label="Nomor persetujuan lingkungan" hint="Opsional.">
            <Input name="permitNumber" />
          </Field>

          <GalatForm pesan={galat} />

          <div className="flex justify-end">
            <Button type="submit" disabled={memproses}>
              {memproses ? 'Memproses…' : 'Terbitkan BAST'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  )
}

function KirimCsat({ projectId, csatStatus }: { projectId: string; csatStatus: string | null }) {
  const router = useRouter()
  const [galat, setGalat] = useState<string | null>(null)
  const [memproses, setMemproses] = useState(false)

  async function kirimSurvei() {
    setMemproses(true)
    setGalat(null)
    const hasil = await kirim('/api/csat', 'POST', { projectId })
    setMemproses(false)
    if (!hasil.ok) {
      setGalat(hasil.pesan ?? 'Survei gagal dikirim.')
      return
    }
    router.refresh()
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-medium">Survei kepuasan pelanggan</h2>
          {csatStatus && (
            <Badge varian={csatStatus === 'COMPLETED' ? 'sukses' : 'info'}>
              {CSAT_STATUS_LABEL[csatStatus] ?? csatStatus}
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Survei hanya dapat dikirim setelah BAST ditandatangani.
        </p>
        <GalatForm pesan={galat} />
        <div className="flex justify-end">
          <Button varian="garis" onClick={kirimSurvei} disabled={memproses}>
            {memproses ? 'Mengirim…' : csatStatus ? 'Kirim ulang survei' : 'Kirim survei CSAT'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function FormJawabanCsat({ projectId }: { projectId: string }) {
  const router = useRouter()
  const [nilai, setNilai] = useState<CsatScores>(NILAI_AWAL)
  const [galat, setGalat] = useState<string | null>(null)
  const [memproses, setMemproses] = useState(false)

  // Hitungan ini murni bantuan visual; skor yang tersimpan tetap dihitung server.
  const skorSementara = calculateCsatScore(nilai)

  async function simpan(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setMemproses(true)
    setGalat(null)

    const f = new FormData(e.currentTarget)
    const catatan = String(f.get('comment') ?? '').trim()

    const hasil = await kirim(`/api/csat/${projectId}`, 'PATCH', {
      ...nilai,
      comment: catatan === '' ? undefined : catatan,
    })

    if (!hasil.ok) {
      setGalat(hasil.pesan ?? 'Jawaban gagal disimpan.')
      setMemproses(false)
      return
    }

    setMemproses(false)
    router.refresh()
  }

  return (
    <form onSubmit={simpan}>
      <Card>
        <CardContent className="flex flex-col gap-4">
          <div>
            <h2 className="text-sm font-medium">Isi jawaban klien</h2>
            <p className="text-xs text-muted-foreground">
              Nilai 0–100 untuk tiap aspek. Bobotnya tetap: 35 / 25 / 20 / 20.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {ASPEK_CSAT.map((a) => (
              <Field
                key={a.kunci}
                label={`${a.label} (bobot ${Math.round(a.bobot * 100)}%)`}
                wajib
                hint={`Kontribusi: ${(nilai[a.kunci] * a.bobot).toFixed(2)}`}
              >
                <Input
                  type="number"
                  min={0}
                  max={100}
                  required
                  value={nilai[a.kunci]}
                  onChange={(e) =>
                    setNilai((sebelum) => ({
                      ...sebelum,
                      // Dijepit 0-100 supaya pratinjau skor tidak melempar saat salah ketik.
                      [a.kunci]: Math.min(100, Math.max(0, Number(e.target.value || 0))),
                    }))
                  }
                />
              </Field>
            ))}
          </div>

          <div className="flex items-baseline gap-2 rounded-md bg-secondary px-3 py-2">
            <span className="text-lg font-semibold tabular-nums">
              {skorSementara.toFixed(2)}
            </span>
            <span className="text-xs text-muted-foreground">
              skor terbobot sementara — perhitungan resmi dilakukan server saat disimpan
            </span>
          </div>

          <Field label="Catatan klien">
            <Textarea name="comment" />
          </Field>

          <GalatForm pesan={galat} />

          <div className="flex justify-end">
            <Button type="submit" disabled={memproses}>
              {memproses ? 'Menyimpan…' : 'Simpan jawaban'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  )
}
