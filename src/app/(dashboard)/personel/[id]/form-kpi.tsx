'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Field, GalatForm, Input, Select, Textarea } from '@/components/ui/field'
import { kirim } from '@/lib/kirim'

/**
 * Bobot indikator ditampilkan dan dihitung ulang di sini SEMATA sebagai
 * bantuan visual. Skor yang disimpan tetap dihitung ulang oleh lapisan domain
 * dari ketiga indikator mentah, jadi angka di layar tidak pernah jadi acuan.
 */
const INDIKATOR = [
  { nama: 'punctualityScore', label: 'Ketepatan waktu', bobot: 35 },
  { nama: 'qualityScore', label: 'Kualitas pekerjaan', bobot: 40 },
  { nama: 'teamworkScore', label: 'Kerjasama tim', bobot: 25 },
] as const

export function FormKpi({
  personnelId,
  periodType,
  proyek,
}: {
  personnelId: string
  periodType: 'ANNUAL' | 'PER_PROJECT'
  proyek: { id: string; code: string; name: string }[]
}) {
  const router = useRouter()
  const [galat, setGalat] = useState<string | null>(null)
  const [memproses, setMemproses] = useState(false)
  const [skor, setSkor] = useState<Record<string, number>>({
    punctualityScore: 0,
    qualityScore: 0,
    teamworkScore: 0,
  })

  const sementara = INDIKATOR.reduce(
    (jumlah, i) => jumlah + (skor[i.nama] ?? 0) * (i.bobot / 100),
    0,
  )

  async function simpan(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setMemproses(true)
    setGalat(null)

    const form = e.currentTarget
    const f = new FormData(form)
    const catatan = String(f.get('note') ?? '').trim()

    const hasil = await kirim('/api/kpi', 'POST', {
      personnelId,
      periodType,
      periodYear:
        periodType === 'ANNUAL' ? Number(f.get('periodYear')) : undefined,
      projectId: periodType === 'PER_PROJECT' ? String(f.get('projectId')) : undefined,
      punctualityScore: skor.punctualityScore,
      qualityScore: skor.qualityScore,
      teamworkScore: skor.teamworkScore,
      note: catatan === '' ? undefined : catatan,
    })

    if (!hasil.ok) {
      setGalat(hasil.pesan ?? 'Gagal menyimpan penilaian.')
      setMemproses(false)
      return
    }

    form.reset()
    setSkor({ punctualityScore: 0, qualityScore: 0, teamworkScore: 0 })
    setMemproses(false)
    router.refresh()
  }

  return (
    <form onSubmit={simpan} className="flex flex-col gap-4">
      {periodType === 'ANNUAL' ? (
        <Field label="Tahun periode" wajib hint="Karyawan tetap dinilai tahunan.">
          <Input
            name="periodYear"
            type="number"
            min={2000}
            required
            defaultValue={new Date().getFullYear()}
          />
        </Field>
      ) : (
        <Field label="Proyek" wajib hint="Tenaga ahli kontrak dan lepas dinilai per proyek.">
          <Select name="projectId" required defaultValue="">
            <option value="" disabled>
              — pilih proyek —
            </option>
            {proyek.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} · {p.name}
              </option>
            ))}
          </Select>
        </Field>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        {INDIKATOR.map((i) => (
          <Field key={i.nama} label={`${i.label} (bobot ${i.bobot}%)`} wajib>
            <Input
              name={i.nama}
              type="number"
              min={0}
              max={100}
              step={1}
              required
              value={skor[i.nama]}
              onChange={(e) => setSkor((s) => ({ ...s, [i.nama]: Number(e.target.value) }))}
            />
          </Field>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Skor sementara:{' '}
        <span className="font-medium tabular-nums text-foreground">{sementara.toFixed(2)}</span> —
        perhitungan resmi dilakukan server saat disimpan.
      </p>

      <Field label="Catatan penilaian">
        <Textarea name="note" />
      </Field>

      <GalatForm pesan={galat} />

      <div className="flex justify-end">
        <Button type="submit" disabled={memproses}>
          {memproses ? 'Menyimpan…' : 'Simpan penilaian'}
        </Button>
      </div>
    </form>
  )
}
