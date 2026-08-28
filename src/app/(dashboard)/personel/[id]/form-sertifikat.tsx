'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Field, GalatForm, Input, Select } from '@/components/ui/field'
import { kirim } from '@/lib/kirim'
import { SERTIFIKAT_LABEL } from '../labels'

const NAMA_SERTIFIKAT = ['KTPA', 'ATPA', 'K3', 'AMBIL_SAMPEL', 'SKK', 'LAINNYA'] as const

/** Tanggal polos dari isian date diikat ke WIB agar hitungan H-60 tidak bergeser. */
function keIsoWib(nilai: string): string {
  return new Date(`${nilai}T00:00:00+07:00`).toISOString()
}

export function FormSertifikat({ personnelId }: { personnelId: string }) {
  const router = useRouter()
  const [galat, setGalat] = useState<string | null>(null)
  const [memproses, setMemproses] = useState(false)

  async function simpan(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setMemproses(true)
    setGalat(null)

    const form = e.currentTarget
    const f = new FormData(form)
    const nomor = String(f.get('number') ?? '').trim()

    const hasil = await kirim('/api/certifications', 'POST', {
      personnelId,
      name: String(f.get('name') ?? ''),
      issuer: String(f.get('issuer') ?? '').trim(),
      number: nomor === '' ? undefined : nomor,
      issuedAt: keIsoWib(String(f.get('issuedAt'))),
      expiresAt: keIsoWib(String(f.get('expiresAt'))),
    })

    if (!hasil.ok) {
      setGalat(hasil.pesan ?? 'Gagal menyimpan sertifikat.')
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
        <Field label="Nama sertifikat" wajib>
          <Select name="name" required defaultValue="K3">
            {NAMA_SERTIFIKAT.map((nilai) => (
              <option key={nilai} value={nilai}>
                {SERTIFIKAT_LABEL[nilai] ?? nilai}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Penerbit" wajib hint="Contoh: LSP Intakindo">
          <Input name="issuer" required minLength={2} />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Nomor sertifikat">
          <Input name="number" />
        </Field>
        <Field label="Tanggal terbit" wajib>
          <Input name="issuedAt" type="date" required />
        </Field>
        <Field label="Tanggal kedaluwarsa" wajib hint="Peringatan terbit H-60.">
          <Input name="expiresAt" type="date" required />
        </Field>
      </div>

      <GalatForm pesan={galat} />

      <div className="flex justify-end">
        <Button type="submit" disabled={memproses}>
          {memproses ? 'Menyimpan…' : 'Tambah sertifikat'}
        </Button>
      </div>
    </form>
  )
}
