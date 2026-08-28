'use client'

import { useState } from 'react'
import { Lock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { GalatForm } from '@/components/ui/field'
import { Table, TD, TH, THead, TR } from '@/components/ui/table'
import { DIVISION_LABEL, ROLE_LABEL } from '../labels'
import { IZIN_PENJELASAN } from './labels-izin'
import type { Division, Role } from '@/server/shared/constants'

type SubjectType = 'ROLE' | 'DIVISION'

interface Subjek {
  subject: string
  terkunci: boolean
  dapatDisunting: string[]
}

export interface Isi {
  permissions: string[]
  roles: Subjek[]
  divisions: Subjek[]
  grants: { subjectType: SubjectType; subject: string; permission: string }[]
}

/** Kunci gabungan supaya peran dan divisi bernama sama tidak bertabrakan. */
function kunci(subjectType: SubjectType, subject: string) {
  return `${subjectType}:${subject}`
}

/** Susun izin yang sedang berlaku per subjek dari daftar grant. */
function petaGrant(isi: Isi): Record<string, Set<string>> {
  const peta: Record<string, Set<string>> = {}
  for (const s of isi.roles) peta[kunci('ROLE', s.subject)] = new Set()
  for (const s of isi.divisions) peta[kunci('DIVISION', s.subject)] = new Set()
  for (const g of isi.grants) peta[kunci(g.subjectType, g.subject)]?.add(g.permission)
  return peta
}

function label(subjectType: SubjectType, subject: string) {
  return subjectType === 'ROLE'
    ? (ROLE_LABEL[subject as Role] ?? subject)
    : (DIVISION_LABEL[subject as Division] ?? subject)
}

/**
 * Alasan sebuah subjek dikunci, dalam satu kalimat.
 *
 * Sengaja tidak dipakai untuk menentukan apa yang dinonaktifkan — itu tetap
 * mengikuti `terkunci` dari server; ini hanya menjelaskan kenapa.
 */
function alasanTerkunci(subjectType: SubjectType, subject: string) {
  const nama = label(subjectType, subject)
  return subjectType === 'ROLE'
    ? `Peran ${nama} dikunci hanya pada pengelolaan akun, supaya yang memegang kunci akun tidak sekaligus memegang kunci uang: ia hanya boleh mengurus akun, bukan mengurus pekerjaan.`
    : `Divisi ${nama} dikunci tanpa wewenang bisnis apa pun, supaya akun administrator tidak diam-diam ikut melihat atau menyetujui pekerjaan yang bukan urusannya.`
}

function samaIsinya(a: Set<string>, b: Set<string>) {
  return a.size === b.size && [...a].every((x) => b.has(x))
}

export function MatriksAkses({ isi, bolehTulis }: { isi: Isi; bolehTulis: boolean }) {
  const awalnya = petaGrant(isi)
  const [awal, setAwal] = useState<Record<string, Set<string>>>(awalnya)
  const [pilihan, setPilihan] = useState<Record<string, Set<string>>>(() =>
    Object.fromEntries(Object.entries(awalnya).map(([k, v]) => [k, new Set(v)])),
  )
  const [galat, setGalat] = useState<string | null>(null)
  const [pesan, setPesan] = useState<string | null>(null)
  const [menyimpan, setMenyimpan] = useState<string | null>(null)

  function alihkan(subjectType: SubjectType, subject: string, permission: string) {
    const k = kunci(subjectType, subject)
    setPesan(null)
    setPilihan((lama) => {
      const set = new Set(lama[k] ?? [])
      if (set.has(permission)) set.delete(permission)
      else set.add(permission)
      return { ...lama, [k]: set }
    })
  }

  async function simpan(subjectType: SubjectType, subject: string) {
    const k = kunci(subjectType, subject)
    setMenyimpan(k)
    setGalat(null)
    setPesan(null)

    let res: Response
    try {
      res = await fetch('/api/permissions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subjectType,
          subject,
          permissions: [...(pilihan[k] ?? [])],
        }),
      })
    } catch {
      setMenyimpan(null)
      setGalat('Tidak dapat menghubungi server. Periksa koneksi Anda.')
      return
    }
    const badan = await res.json().catch(() => null)
    setMenyimpan(null)

    if (!res.ok) {
      // Termasuk SUBJECT_LOCKED dan USER_PERMISSION_RESERVED — apa adanya.
      setGalat(badan?.error?.message ?? 'Perubahan gagal disimpan.')
      return
    }
    setAwal((lama) => ({ ...lama, [k]: new Set(pilihan[k] ?? []) }))
    setPesan(`Hak akses ${label(subjectType, subject)} disimpan.`)
  }

  function tabel(subjectType: SubjectType, subjek: Subjek[], judul: string) {
    return (
      <Card>
        <CardContent className="flex flex-col gap-3">
          <h2 className="text-sm font-medium">{judul}</h2>
          <Table>
            <THead>
              <TR>
                <TH className="min-w-72">Izin</TH>
                {subjek.map((s) => (
                  <TH key={s.subject} className="text-center">
                    <span className="block">{label(subjectType, s.subject)}</span>
                    {s.terkunci && (
                      <span
                        className="mt-1 inline-flex items-center gap-1 text-muted-foreground"
                        title={alasanTerkunci(subjectType, s.subject)}
                      >
                        <Lock className="size-3" />
                        Terkunci
                      </span>
                    )}
                  </TH>
                ))}
              </TR>
            </THead>
            <tbody>
              {isi.permissions.map((izin) => (
                <TR key={izin}>
                  <TD>
                    <span className="flex flex-wrap items-center gap-2">
                      <code className="text-xs font-medium">{izin}</code>
                      {izin.startsWith('user:') && (
                        <Badge varian="peringatan">Tidak dapat dipindahkan</Badge>
                      )}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {IZIN_PENJELASAN[izin as keyof typeof IZIN_PENJELASAN]}
                    </span>
                  </TD>
                  {subjek.map((s) => {
                    const k = kunci(subjectType, s.subject)
                    const dapat = s.dapatDisunting.includes(izin)
                    return (
                      <TD key={s.subject} className="text-center">
                        <input
                          type="checkbox"
                          className="size-4 accent-[var(--primary)] disabled:opacity-40"
                          aria-label={`${izin} untuk ${label(subjectType, s.subject)}`}
                          checked={pilihan[k]?.has(izin) ?? false}
                          disabled={!bolehTulis || !dapat || menyimpan !== null}
                          onChange={() => alihkan(subjectType, s.subject, izin)}
                        />
                      </TD>
                    )
                  })}
                </TR>
              ))}
            </tbody>
            {bolehTulis && (
              <tfoot>
                <TR>
                  <TD className="text-xs text-muted-foreground">
                    Disimpan per kolom — seluruh izin kolom itu diganti sekaligus.
                  </TD>
                  {subjek.map((s) => {
                    const k = kunci(subjectType, s.subject)
                    const berubah = !samaIsinya(
                      pilihan[k] ?? new Set(),
                      awal[k] ?? new Set(),
                    )
                    return (
                      <TD key={s.subject} className="text-center">
                        <Button
                          ukuran="sm"
                          varian={berubah ? 'utama' : 'garis'}
                          disabled={s.terkunci || !berubah || menyimpan !== null}
                          onClick={() => simpan(subjectType, s.subject)}
                        >
                          {menyimpan === k ? 'Menyimpan…' : 'Simpan'}
                        </Button>
                      </TD>
                    )
                  })}
                </TR>
              </tfoot>
            )}
          </Table>
        </CardContent>
      </Card>
    )
  }

  const terkunci = [
    ...isi.roles.map((s) => ({ t: 'ROLE' as SubjectType, s })),
    ...isi.divisions.map((s) => ({ t: 'DIVISION' as SubjectType, s })),
  ].filter((x) => x.s.terkunci)

  return (
    <div className="flex flex-col gap-gap">
      <GalatForm pesan={galat} />
      {pesan && <p className="text-xs text-[var(--success)]">{pesan}</p>}

      {tabel('ROLE', isi.roles, 'Izin menurut peran')}
      {tabel('DIVISION', isi.divisions, 'Izin menurut divisi')}

      <Card>
        <CardContent className="flex flex-col gap-3">
          <h2 className="text-sm font-medium">Yang dikunci dan alasannya</h2>
          <dl className="flex flex-col gap-2.5 text-sm">
            {terkunci.map(({ t, s }) => (
              <div key={kunci(t, s.subject)}>
                <dt className="font-medium">
                  {t === 'ROLE' ? 'Peran' : 'Divisi'} {label(t, s.subject)}
                </dt>
                <dd className="text-muted-foreground">{alasanTerkunci(t, s.subject)}</dd>
              </div>
            ))}
            <div>
              <dt className="font-medium">Izin user:read dan user:write</dt>
              <dd className="text-muted-foreground">
                Melekat mati pada peran Superadmin dan tidak dapat dipindahkan ke peran atau
                divisi lain, supaya tidak ada orang yang bisa memberi dirinya sendiri wewenang
                menyetujui uang.
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  )
}
