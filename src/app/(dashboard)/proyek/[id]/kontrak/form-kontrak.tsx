'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Field, GalatForm, Input, Select } from '@/components/ui/field'
import { kirim } from '@/lib/kirim'

const TIPE_KONTRAK = [
  ['SPK', 'SPK — Surat Perintah Kerja'],
  ['LOA', 'LOA — Letter of Award'],
  ['PKS', 'PKS — Perjanjian Kerja Sama'],
  ['ADDENDUM', 'Addendum'],
] as const

export function FormKontrak({ projectId }: { projectId: string }) {
  const router = useRouter()
  const [galat, setGalat] = useState<string | null>(null)
  const [memproses, setMemproses] = useState(false)

  async function simpan(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setMemproses(true)
    setGalat(null)

    const form = e.currentTarget
    const f = new FormData(form)
    const dokumen = String(f.get('documentUrl') ?? '').trim()

    const hasil = await kirim('/api/contracts', 'POST', {
      projectId,
      type: String(f.get('type') ?? ''),
      number: String(f.get('number') ?? '').trim(),
      // Input `date` memberi tanggal lokal; ISO menghindari pergeseran zona.
      signedAt: new Date(String(f.get('signedAt'))).toISOString(),
      validUntil: new Date(String(f.get('validUntil'))).toISOString(),
      documentUrl: dokumen === '' ? undefined : dokumen,
    })

    if (!hasil.ok) {
      setGalat(hasil.pesan ?? 'Gagal menyimpan.')
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
          <h2 className="text-sm font-medium">Catat kontrak baru</h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Jenis dokumen"
              wajib
              hint="Hanya SPK, LOA, dan PKS yang menjadi dasar proyek berjalan."
            >
              <Select name="type" required defaultValue="SPK">
                {TIPE_KONTRAK.map(([nilai, label]) => (
                  <option key={nilai} value={nilai}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Nomor kontrak" wajib>
              <Input name="number" required minLength={3} />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tanggal tanda tangan" wajib>
              <Input name="signedAt" type="date" required />
            </Field>
            <Field label="Berlaku sampai" wajib>
              <Input name="validUntil" type="date" required />
            </Field>
          </div>

          <Field label="Tautan dokumen" hint="Opsional — misalnya tautan berkas pindaian.">
            <Input name="documentUrl" type="url" placeholder="https://" />
          </Field>

          <GalatForm pesan={galat} />

          <div className="flex justify-end">
            <Button type="submit" disabled={memproses}>
              {memproses ? 'Menyimpan…' : 'Simpan kontrak'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  )
}
