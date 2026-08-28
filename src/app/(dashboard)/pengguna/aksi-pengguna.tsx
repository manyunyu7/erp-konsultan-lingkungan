'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Field, GalatForm, Input, Select } from '@/components/ui/field'
import { kirim } from '@/lib/kirim'
import { DIVISIONS, ROLES, type Division, type Role } from '@/server/shared/constants'
import { DIVISION_LABEL, ROLE_LABEL } from './labels'

interface Pengguna {
  id: string
  name: string
  role: Role
  division: Division
  isActive: boolean
}

/**
 * Aksi per baris dalam panel yang bisa dibuka.
 *
 * Sengaja tanpa modal: pengelolaan akun jarang dilakukan dan panel terbuka
 * membuat konteks barisnya tetap terlihat saat mengubah peran.
 */
export function AksiPengguna({ pengguna }: { pengguna: Pengguna }) {
  const router = useRouter()
  const [galat, setGalat] = useState<string | null>(null)
  const [pesan, setPesan] = useState<string | null>(null)
  const [memproses, setMemproses] = useState(false)

  async function ubah(perubahan: Record<string, unknown>, sukses: string) {
    setMemproses(true)
    setGalat(null)
    setPesan(null)

    const hasil = await kirim(`/api/users/${pengguna.id}`, 'PATCH', perubahan)
    setMemproses(false)

    if (!hasil.ok) {
      // Termasuk CANNOT_DEMOTE_SELF dan LAST_SUPERADMIN — diteruskan apa adanya.
      setGalat(hasil.pesan ?? 'Perubahan gagal disimpan.')
      return
    }
    setPesan(sukses)
    router.refresh()
  }

  async function simpanPeran(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    await ubah(
      { role: String(f.get('role') ?? ''), division: String(f.get('division') ?? '') },
      'Peran dan divisi diperbarui.',
    )
  }

  async function simpanKataSandi(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formulir = e.currentTarget
    const f = new FormData(formulir)

    setMemproses(true)
    setGalat(null)
    setPesan(null)
    const hasil = await kirim(`/api/users/${pengguna.id}/password`, 'PATCH', {
      password: String(f.get('password') ?? ''),
    })
    setMemproses(false)

    if (!hasil.ok) {
      setGalat(hasil.pesan ?? 'Kata sandi gagal disetel.')
      return
    }
    formulir.reset()
    setPesan('Kata sandi baru sudah berlaku.')
  }

  return (
    <details className="text-xs">
      <summary className="cursor-pointer text-primary select-none">Kelola</summary>

      <div className="mt-3 flex flex-col gap-4 rounded-md border p-pad">
        <form onSubmit={simpanPeran} className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Peran">
              <Select name="role" defaultValue={pengguna.role}>
                {ROLES.map((peran) => (
                  <option key={peran} value={peran}>
                    {ROLE_LABEL[peran]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Divisi">
              <Select name="division" defaultValue={pengguna.division}>
                {DIVISIONS.map((divisi) => (
                  <option key={divisi} value={divisi}>
                    {DIVISION_LABEL[divisi]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" ukuran="sm" disabled={memproses}>
              Simpan peran &amp; divisi
            </Button>
            <Button
              type="button"
              ukuran="sm"
              varian={pengguna.isActive ? 'bahaya' : 'garis'}
              disabled={memproses}
              onClick={() =>
                ubah(
                  { isActive: !pengguna.isActive },
                  pengguna.isActive ? 'Akun dinonaktifkan.' : 'Akun diaktifkan kembali.',
                )
              }
            >
              {pengguna.isActive ? 'Nonaktifkan akun' : 'Aktifkan akun'}
            </Button>
          </div>
        </form>

        <form onSubmit={simpanKataSandi} className="flex flex-col gap-3 border-t pt-3">
          <Field label="Kata sandi baru" hint="Minimal 8 karakter, memuat huruf dan angka.">
            <Input name="password" type="password" required autoComplete="new-password" />
          </Field>
          <div>
            <Button type="submit" ukuran="sm" varian="garis" disabled={memproses}>
              Setel kata sandi
            </Button>
          </div>
        </form>

        <GalatForm pesan={galat} />
        {pesan && <p className="text-xs text-[var(--success)]">{pesan}</p>}
      </div>
    </details>
  )
}
