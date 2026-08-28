import { db } from '@/lib/db'
import { currentActor } from '@/lib/api'
import { can } from '@/server/auth'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TD, TH, THead, TR } from '@/components/ui/table'
import { AksesDitolak, Kosong } from '@/components/ui/notice'
import { tanggal } from '@/lib/utils'
import { DIVISIONS, ROLES, type Division, type Role } from '@/server/shared/constants'
import {
  DIVISION_LABEL,
  DIVISION_PENJELASAN,
  ROLE_LABEL,
  ROLE_PENJELASAN,
} from './labels'
import { FormPengguna } from './form-pengguna'
import { AksiPengguna } from './aksi-pengguna'

export default async function HalamanPengguna() {
  const actor = await currentActor()
  if (!actor) return null
  if (!can(actor, 'user:read')) return <AksesDitolak />

  const bolehTulis = can(actor, 'user:write')

  // Nonaktif ditempatkan setelah yang aktif supaya daftar kerja sehari-hari
  // tidak tertutup akun lama.
  const users = await db.user.findMany({
    orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      division: true,
      isActive: true,
      createdAt: true,
    },
  })

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-gap">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Pengguna</h1>
        <p className="text-sm text-muted-foreground">
          Akun dan hak aksesnya. Peran menentukan wewenang jabatan, divisi menentukan data yang
          boleh disentuh.
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3">
          <h2 className="text-sm font-medium">Daftar pengguna</h2>
          {users.length === 0 ? (
            <Kosong pesan="Belum ada pengguna terdaftar." />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Nama</TH>
                  <TH>Email</TH>
                  <TH>Peran</TH>
                  <TH>Divisi</TH>
                  <TH>Status</TH>
                  <TH>Dibuat</TH>
                  {bolehTulis && <TH>Aksi</TH>}
                </TR>
              </THead>
              <tbody>
                {users.map((u) => (
                  <TR key={u.id}>
                    <TD className="font-medium whitespace-nowrap">{u.name}</TD>
                    <TD className="text-muted-foreground">{u.email}</TD>
                    <TD className="whitespace-nowrap">{ROLE_LABEL[u.role as Role] ?? u.role}</TD>
                    <TD className="whitespace-nowrap">
                      {DIVISION_LABEL[u.division as Division] ?? u.division}
                    </TD>
                    <TD>
                      {u.isActive ? (
                        <Badge varian="sukses">Aktif</Badge>
                      ) : (
                        <Badge varian="bahaya">Nonaktif</Badge>
                      )}
                    </TD>
                    <TD className="whitespace-nowrap text-muted-foreground">
                      {tanggal(u.createdAt)}
                    </TD>
                    {bolehTulis && (
                      <TD className="min-w-64">
                        <AksiPengguna
                          pengguna={{
                            id: u.id,
                            name: u.name,
                            role: u.role as Role,
                            division: u.division as Division,
                            isActive: u.isActive,
                          }}
                        />
                      </TD>
                    )}
                  </TR>
                ))}
              </tbody>
            </Table>
          )}
        </CardContent>
      </Card>

      {bolehTulis && <FormPengguna />}

      <div className="grid gap-gap md:grid-cols-2">
        <Card>
          <CardContent className="flex flex-col gap-3">
            <h2 className="text-sm font-medium">Arti tiap peran</h2>
            <dl className="flex flex-col gap-2.5 text-sm">
              {ROLES.map((peran) => (
                <div key={peran}>
                  <dt className="font-medium">{ROLE_LABEL[peran]}</dt>
                  <dd className="text-muted-foreground">{ROLE_PENJELASAN[peran]}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-3">
            <h2 className="text-sm font-medium">Arti tiap divisi</h2>
            <dl className="flex flex-col gap-2.5 text-sm">
              {DIVISIONS.map((divisi) => (
                <div key={divisi}>
                  <dt className="font-medium">{DIVISION_LABEL[divisi]}</dt>
                  <dd className="text-muted-foreground">{DIVISION_PENJELASAN[divisi]}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
