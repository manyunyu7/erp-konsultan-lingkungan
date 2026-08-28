'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Field, GalatForm, Input, Select } from '@/components/ui/field'
import { kirim } from '@/lib/kirim'
import { rupiah } from '@/lib/utils'

interface TerminRingkas {
  id: string
  label: string
  amount: number
  milestoneMet: boolean
}

export function FormInvoice({ termins }: { termins: TerminRingkas[] }) {
  const router = useRouter()
  const [terminId, setTerminId] = useState('')
  const [galat, setGalat] = useState<string | null>(null)
  const [memproses, setMemproses] = useState(false)

  const terpilih = termins.find((t) => t.id === terminId)

  async function simpan(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setMemproses(true)
    setGalat(null)

    const f = new FormData(e.currentTarget)
    const teks = (nama: string) => {
      const nilai = String(f.get(nama) ?? '').trim()
      return nilai === '' ? undefined : nilai
    }
    const bapVerifiedAt = teks('bapVerifiedAt')

    const hasil = await kirim('/api/invoices', 'POST', {
      terminId,
      number: String(f.get('number') ?? '').trim(),
      bapNumber: String(f.get('bapNumber') ?? '').trim(),
      // Kosong dikirim sebagai null supaya server yang menolak, bukan tampilan.
      bapVerifiedAt: bapVerifiedAt ? new Date(bapVerifiedAt).toISOString() : null,
      taxInvoiceNo: teks('taxInvoiceNo'),
      issuedAt: new Date(String(f.get('issuedAt'))).toISOString(),
      dueDate: new Date(String(f.get('dueDate'))).toISOString(),
    })

    if (!hasil.ok) {
      setGalat(hasil.pesan ?? 'Gagal menerbitkan invoice.')
      setMemproses(false)
      return
    }

    router.push('/keuangan')
    router.refresh()
  }

  return (
    <form onSubmit={simpan}>
      <Card>
        <CardContent className="flex flex-col gap-4">
          <Field label="Termin yang ditagih" wajib>
            <Select
              name="terminId"
              required
              value={terminId}
              onChange={(e) => setTerminId(e.currentTarget.value)}
            >
              <option value="" disabled>
                — pilih termin —
              </option>
              {termins.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </Select>
          </Field>

          {terpilih && (
            <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
              Nominal tagihan {rupiah(terpilih.amount)}, mengikuti rencana termin.{' '}
              {terpilih.milestoneMet
                ? 'Milestone termin ini sudah tercatat tercapai.'
                : 'Milestone termin ini belum tercatat tercapai, sehingga penerbitan kemungkinan besar ditolak.'}
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nomor invoice" wajib hint="Contoh: INV-2026-014">
              <Input name="number" required minLength={3} />
            </Field>
            <Field label="Nomor faktur pajak">
              <Input name="taxInvoiceNo" />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nomor BAP" wajib>
              <Input name="bapNumber" required />
            </Field>
            <Field
              label="Tanggal verifikasi BAP"
              hint="Selama tanggal ini kosong, invoice belum boleh terbit."
            >
              <Input name="bapVerifiedAt" type="date" />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tanggal terbit" wajib>
              <Input name="issuedAt" type="date" required />
            </Field>
            <Field label="Jatuh tempo" wajib hint="Peringatan otomatis dikirim H-3 dan H+1.">
              <Input name="dueDate" type="date" required />
            </Field>
          </div>

          <GalatForm pesan={galat} />

          <div className="flex justify-end gap-2">
            <Button type="button" varian="garis" onClick={() => router.back()} disabled={memproses}>
              Batal
            </Button>
            <Button type="submit" disabled={memproses}>
              {memproses ? 'Menerbitkan…' : 'Terbitkan invoice'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  )
}
