'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Field, GalatForm, Input, Select, Textarea } from '@/components/ui/field'
import { kirim } from '@/lib/kirim'

const SUMBER = [
  ['LPSE', 'LPSE (pengadaan pemerintah)'],
  ['BUMN', 'Portal BUMN'],
  ['SWASTA', 'Swasta'],
  ['PENUNJUKAN_LANGSUNG', 'Penunjukan langsung'],
] as const

export function FormTender({ klien }: { klien: { id: string; name: string }[] }) {
  const router = useRouter()
  const [galat, setGalat] = useState<string | null>(null)
  const [memproses, setMemproses] = useState(false)

  async function simpan(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setMemproses(true)
    setGalat(null)

    const f = new FormData(e.currentTarget)
    const angka = (nama: string) => {
      const nilai = f.get(nama)
      return nilai === null || nilai === '' ? undefined : Number(nilai)
    }
    const teks = (nama: string) => {
      const nilai = String(f.get(nama) ?? '').trim()
      return nilai === '' ? undefined : nilai
    }

    const hasil = await kirim<{ id: string }>('/api/tenders', 'POST', {
      code: String(f.get('code') ?? '').trim(),
      title: String(f.get('title') ?? '').trim(),
      clientId: String(f.get('clientId') ?? ''),
      source: String(f.get('source') ?? ''),
      description: teks('description'),
      torSummary: teks('torSummary'),
      estimatedValue: angka('estimatedValue'),
      bidValue: angka('bidValue'),
      winRateProbability: angka('winRateProbability'),
      // Elemen datetime-local memberi waktu lokal tanpa zona; ubah ke ISO
      // agar server menerima titik waktu yang tidak ambigu.
      submissionDeadline: new Date(String(f.get('submissionDeadline'))).toISOString(),
    })

    if (!hasil.ok) {
      setGalat(hasil.pesan ?? 'Gagal menyimpan.')
      setMemproses(false)
      return
    }

    router.push('/tender')
    router.refresh()
  }

  return (
    <form onSubmit={simpan}>
      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Kode tender" wajib hint="Contoh: TND-2026-007">
              <Input name="code" required minLength={3} />
            </Field>
            <Field label="Sumber" wajib>
              <Select name="source" required defaultValue="LPSE">
                {SUMBER.map(([nilai, label]) => (
                  <option key={nilai} value={nilai}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field label="Judul pekerjaan" wajib>
            <Input name="title" required minLength={3} />
          </Field>

          <Field label="Klien" wajib>
            <Select name="clientId" required defaultValue="">
              <option value="" disabled>
                — pilih klien —
              </option>
              {klien.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Tenggat unggah dokumen"
            wajib
            hint="Peringatan otomatis dikirim H-3 dan H-1 sebelum waktu ini."
          >
            <Input name="submissionDeadline" type="datetime-local" required />
          </Field>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Nilai perkiraan (Rp)">
              <Input name="estimatedValue" type="number" min={0} step={1000} />
            </Field>
            <Field label="Nilai penawaran (Rp)">
              <Input name="bidValue" type="number" min={0} step={1000} />
            </Field>
            <Field
              label="Probabilitas menang (%)"
              hint="Biaya tender hanya dapat diajukan bila minimal 60."
            >
              <Input name="winRateProbability" type="number" min={0} max={100} />
            </Field>
          </div>

          <Field label="Ringkasan KAK / TOR">
            <Textarea name="torSummary" placeholder="Lingkup pekerjaan, keluaran yang diminta…" />
          </Field>

          <Field label="Catatan">
            <Textarea name="description" />
          </Field>

          <GalatForm pesan={galat} />

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              varian="garis"
              onClick={() => router.back()}
              disabled={memproses}
            >
              Batal
            </Button>
            <Button type="submit" disabled={memproses}>
              {memproses ? 'Menyimpan…' : 'Simpan tender'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  )
}
