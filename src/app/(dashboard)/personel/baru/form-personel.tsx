'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Field, GalatForm, Input, Select, Textarea } from '@/components/ui/field'
import { kirim } from '@/lib/kirim'

const KEPEGAWAIAN = [
  ['TETAP', 'Karyawan tetap — dinilai KPI tahunan'],
  ['PKWT', 'PKWT — dinilai KPI per proyek'],
  ['FREELANCE_EXPERT', 'Tenaga ahli lepas — dinilai KPI per proyek'],
] as const

export function FormPersonel() {
  const router = useRouter()
  const [galat, setGalat] = useState<string | null>(null)
  const [memproses, setMemproses] = useState(false)

  async function simpan(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setMemproses(true)
    setGalat(null)

    const f = new FormData(e.currentTarget)
    const teks = (nama: string) => {
      const nilai = String(f.get(nama) ?? '').trim()
      return nilai === '' ? undefined : nilai
    }
    const bergabung = teks('joinedAt')

    const hasil = await kirim<{ id: string }>('/api/personnel', 'POST', {
      fullName: String(f.get('fullName') ?? '').trim(),
      employmentType: String(f.get('employmentType') ?? ''),
      position: String(f.get('position') ?? '').trim(),
      expertise: teks('expertise'),
      // Isian tanggal memberi tanggal polos; ubah ke ISO agar tidak ambigu.
      joinedAt: bergabung ? new Date(`${bergabung}T00:00:00+07:00`).toISOString() : undefined,
    })

    if (!hasil.ok) {
      setGalat(hasil.pesan ?? 'Gagal menyimpan.')
      setMemproses(false)
      return
    }

    router.push(`/personel/${hasil.data?.id ?? ''}`)
    router.refresh()
  }

  return (
    <form onSubmit={simpan}>
      <Card>
        <CardContent className="flex flex-col gap-4">
          <Field label="Nama lengkap" wajib>
            <Input name="fullName" required minLength={3} />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Jenis kepegawaian" wajib>
              <Select name="employmentType" required defaultValue="TETAP">
                {KEPEGAWAIAN.map(([nilai, label]) => (
                  <option key={nilai} value={nilai}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Jabatan" wajib hint="Contoh: Ahli Kualitas Udara">
              <Input name="position" required minLength={2} />
            </Field>
          </div>

          <Field label="Tanggal bergabung">
            <Input name="joinedAt" type="date" />
          </Field>

          <Field label="Keahlian" hint="Bidang keahlian, pengalaman, atau catatan lain.">
            <Textarea name="expertise" />
          </Field>

          <GalatForm pesan={galat} />

          <div className="flex justify-end gap-2">
            <Button type="button" varian="garis" onClick={() => router.back()} disabled={memproses}>
              Batal
            </Button>
            <Button type="submit" disabled={memproses}>
              {memproses ? 'Menyimpan…' : 'Simpan personel'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  )
}
