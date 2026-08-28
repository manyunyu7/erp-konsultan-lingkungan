'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Field, GalatForm, Input, Select } from '@/components/ui/field'
import { kirim } from '@/lib/kirim'
import { DIVISIONS, ROLES } from '@/server/shared/constants'
import { DIVISION_LABEL, ROLE_LABEL } from './labels'

export function FormPengguna() {
  const router = useRouter()
  const [galat, setGalat] = useState<string | null>(null)
  const [memproses, setMemproses] = useState(false)

  async function simpan(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setMemproses(true)
    setGalat(null)

    const f = new FormData(e.currentTarget)
    const formulir = e.currentTarget
    const hasil = await kirim('/api/users', 'POST', {
      name: String(f.get('name') ?? '').trim(),
      email: String(f.get('email') ?? '').trim(),
      role: String(f.get('role') ?? ''),
      division: String(f.get('division') ?? ''),
      password: String(f.get('password') ?? ''),
    })

    setMemproses(false)
    if (!hasil.ok) {
      // Pesan server ditampilkan apa adanya; ia memang ditulis untuk dibaca orang.
      setGalat(hasil.pesan ?? 'Gagal menyimpan.')
      return
    }

    formulir.reset()
    router.refresh()
  }

  return (
    <form onSubmit={simpan}>
      <Card>
        <CardContent className="flex flex-col gap-4">
          <h2 className="text-sm font-medium">Tambah pengguna</h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nama lengkap" wajib>
              <Input name="name" required minLength={3} />
            </Field>
            <Field label="Email" wajib>
              <Input name="email" type="email" required autoComplete="off" />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Peran" wajib>
              <Select name="role" required defaultValue="STAFF">
                {ROLES.map((peran) => (
                  <option key={peran} value={peran}>
                    {ROLE_LABEL[peran]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Divisi" wajib>
              <Select name="division" required defaultValue="MARKETING">
                {DIVISIONS.map((divisi) => (
                  <option key={divisi} value={divisi}>
                    {DIVISION_LABEL[divisi]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field
            label="Kata sandi awal"
            wajib
            hint="Minimal 8 karakter, memuat huruf dan angka. Minta pengguna menggantinya setelah masuk."
          >
            <Input name="password" type="password" required autoComplete="new-password" />
          </Field>

          <GalatForm pesan={galat} />

          <div className="flex justify-end">
            <Button type="submit" disabled={memproses}>
              {memproses ? 'Menyimpan…' : 'Simpan pengguna'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  )
}
