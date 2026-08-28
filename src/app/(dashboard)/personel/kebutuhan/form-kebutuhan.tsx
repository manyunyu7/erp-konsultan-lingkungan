'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Field, GalatForm, Input, Select, Textarea } from '@/components/ui/field'
import { kirim } from '@/lib/kirim'

const KEPEGAWAIAN = [
  ['TETAP', 'Karyawan tetap'],
  ['PKWT', 'PKWT'],
  ['FREELANCE_EXPERT', 'Tenaga ahli lepas'],
] as const

export function FormKebutuhan() {
  const router = useRouter()
  const [galat, setGalat] = useState<string | null>(null)
  const [memproses, setMemproses] = useState(false)

  async function simpan(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setMemproses(true)
    setGalat(null)

    const form = e.currentTarget
    const f = new FormData(form)

    const hasil = await kirim('/api/manpower-requests', 'POST', {
      formNumber: String(f.get('formNumber') ?? '').trim(),
      position: String(f.get('position') ?? '').trim(),
      employmentType: String(f.get('employmentType') ?? ''),
      qualification: String(f.get('qualification') ?? '').trim(),
      certifications: String(f.get('certifications') ?? '').trim(),
      quantity: Number(f.get('quantity')),
      // Tanggal kebutuhan diikat ke WIB supaya gate "harus di masa depan"
      // tidak bergeser sehari di batas tengah malam.
      neededBy: new Date(`${String(f.get('neededBy'))}T00:00:00+07:00`).toISOString(),
    })

    if (!hasil.ok) {
      setGalat(hasil.pesan ?? 'Gagal mengajukan kebutuhan personel.')
      setMemproses(false)
      return
    }

    form.reset()
    setMemproses(false)
    router.refresh()
  }

  return (
    <form onSubmit={simpan} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nomor form" wajib hint="Contoh: F-HR-01/2026/004">
          <Input name="formNumber" required minLength={3} />
        </Field>
        <Field label="Posisi yang dibutuhkan" wajib>
          <Input name="position" required minLength={2} />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Jenis kepegawaian" wajib>
          <Select name="employmentType" required defaultValue="PKWT">
            {KEPEGAWAIAN.map(([nilai, label]) => (
              <option key={nilai} value={nilai}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Jumlah orang" wajib>
          <Input name="quantity" type="number" min={1} step={1} required defaultValue={1} />
        </Field>
        <Field label="Dibutuhkan paling lambat" wajib hint="Harus tanggal di masa depan.">
          <Input name="neededBy" type="date" required />
        </Field>
      </div>

      <Field label="Kualifikasi" wajib hint="Pendidikan, pengalaman minimum, dan keahlian.">
        <Textarea name="qualification" required />
      </Field>

      <Field label="Sertifikasi yang dibutuhkan" wajib hint="Contoh: KTPA, K3, pengambil sampel.">
        <Textarea name="certifications" required />
      </Field>

      <GalatForm pesan={galat} />

      <div className="flex justify-end">
        <Button type="submit" disabled={memproses}>
          {memproses ? 'Mengajukan…' : 'Ajukan kebutuhan'}
        </Button>
      </div>
    </form>
  )
}
