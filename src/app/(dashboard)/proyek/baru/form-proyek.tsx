'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Field, GalatForm, Input, Select } from '@/components/ui/field'
import { kirim } from '@/lib/kirim'

const JENIS_DOKUMEN = [
  ['AMDAL', 'AMDAL'],
  ['UKL_UPL', 'UKL-UPL'],
  ['DELH', 'DELH'],
  ['DPLH', 'DPLH'],
] as const

interface PilihanTender {
  id: string
  code: string
  title: string
  client: { name: string }
}

/** Tanggal dari input `date` bersifat lokal; ISO dipakai agar server tidak menebak zona. */
function keIso(nilai: FormDataEntryValue | null): string {
  return new Date(String(nilai)).toISOString()
}

export function FormProyek({ tender }: { tender: PilihanTender[] }) {
  const router = useRouter()
  const [galat, setGalat] = useState<string | null>(null)
  const [memproses, setMemproses] = useState(false)

  async function simpan(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setMemproses(true)
    setGalat(null)

    const f = new FormData(e.currentTarget)
    const hasil = await kirim<{ id: string }>('/api/projects', 'POST', {
      tenderId: String(f.get('tenderId') ?? ''),
      code: String(f.get('code') ?? '').trim(),
      name: String(f.get('name') ?? '').trim(),
      documentType: String(f.get('documentType') ?? ''),
      startDate: keIso(f.get('startDate')),
      endDate: keIso(f.get('endDate')),
    })

    if (!hasil.ok) {
      setGalat(hasil.pesan ?? 'Gagal menyimpan.')
      setMemproses(false)
      return
    }

    router.push(`/proyek/${hasil.data?.id}`)
    router.refresh()
  }

  return (
    <form onSubmit={simpan}>
      <Card>
        <CardContent className="flex flex-col gap-4">
          <Field label="Tender yang dimenangkan" wajib>
            <Select name="tenderId" required defaultValue="">
              <option value="" disabled>
                — pilih tender —
              </option>
              {tender.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.code} · {t.title} ({t.client.name})
                </option>
              ))}
            </Select>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Kode Job Order" wajib hint="Contoh: JO-2026-014">
              <Input name="code" required minLength={3} />
            </Field>
            <Field label="Jenis dokumen" wajib>
              <Select name="documentType" required defaultValue="UKL_UPL">
                {JENIS_DOKUMEN.map(([nilai, label]) => (
                  <option key={nilai} value={nilai}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field label="Nama proyek" wajib>
            <Input name="name" required minLength={3} />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tanggal mulai" wajib>
              <Input name="startDate" type="date" required />
            </Field>
            <Field
              label="Tanggal berakhir"
              wajib
              hint="Peringatan masa kontrak dikirim H-30 dan H-14."
            >
              <Input name="endDate" type="date" required />
            </Field>
          </div>

          <GalatForm pesan={galat} />

          <div className="flex justify-end gap-2">
            <Button type="button" varian="garis" onClick={() => router.back()} disabled={memproses}>
              Batal
            </Button>
            <Button type="submit" disabled={memproses}>
              {memproses ? 'Menyimpan…' : 'Buat proyek'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  )
}
