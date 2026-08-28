/**
 * SKENARIO 5 — Hak akses (RBAC) per peran dan divisi.
 *
 * Untuk setiap divisi ditegaskan dua sisi: apa yang BOLEH dikerjakan dan apa
 * yang HARUS DITOLAK. Contoh nyata: staf teknis tidak boleh menerbitkan
 * invoice, marketing tidak boleh menyetujui biaya, HR tidak boleh mengubah
 * kontrak, direktur boleh semuanya, dan akun nonaktif tidak boleh apa pun.
 */

import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: { user: { findUnique: vi.fn() } },
}))

import { BusinessRuleError, type Division, type Role } from '@/server/shared/constants'
import { PERMISSIONS, assertCan, can, permissionsFor, type Actor, type Permission } from '@/server/auth'

/** Pembuat aktor ringkas supaya tiap kasus terbaca sebagai satu orang nyata. */
function actor(id: string, role: Role, division: Division, isActive = true): Actor {
  return { id, role, division, isActive }
}

const DIREKTUR = actor('usr-bambang-sutrisno', 'DIREKTUR', 'MANAJEMEN')
const FINANCE_MANAGER = actor('usr-retno-wulandari', 'FINANCE_MANAGER', 'FINANCE')
const STAF_FINANCE = actor('usr-maya-kusuma', 'STAFF', 'FINANCE')
const PM_TEKNIS = actor('usr-andi-prasetyo', 'PROJECT_MANAGER', 'TEKNIS')
const STAF_TEKNIS = actor('usr-yudi-hermawan', 'STAFF', 'TEKNIS')
const STAF_MARKETING = actor('usr-rizky-ramadhan', 'STAFF', 'MARKETING')
const STAF_ADMIN_LEGAL = actor('usr-fajar-nugroho', 'STAFF', 'ADMIN_LEGAL')
const STAF_HR = actor('usr-nur-aisyah', 'STAFF', 'HR')
const MANAJER_MUTU = actor('usr-hendra-gunawan', 'PROJECT_MANAGER', 'MANAJEMEN')
const AKUN_NONAKTIF = actor('usr-bagus-setiawan', 'STAFF', 'TEKNIS', false)

/** Bantu menuliskan tabel BOLEH/DITOLAK sebagai asersi. */
function assertMatrix(
  subject: Actor,
  boleh: readonly Permission[],
  ditolak: readonly Permission[],
) {
  for (const permission of boleh) {
    expect(can(subject, permission), `${subject.id} seharusnya BOLEH ${permission}`).toBe(true)
    expect(() => assertCan(subject, permission)).not.toThrow()
  }
  for (const permission of ditolak) {
    expect(can(subject, permission), `${subject.id} seharusnya DITOLAK ${permission}`).toBe(false)
    expect(() => assertCan(subject, permission)).toThrowError(BusinessRuleError)
  }
}

describe('Skenario: matriks hak akses per divisi', () => {
  it('divisi TEKNIS — staf teknis boleh mengurus deliverable tetapi TIDAK boleh menerbitkan invoice', () => {
    assertMatrix(
      STAF_TEKNIS,
      ['project:read', 'deliverable:read', 'deliverable:write', 'personnel:read', 'notification:read'],
      ['invoice:write', 'invoice:read', 'cost:write', 'cost:approve', 'contract:write', 'tender:write', 'project:write'],
    )
  })

  it('divisi TEKNIS — project manager boleh mengubah proyek dan melihat invoice, tetapi tetap tidak boleh menerbitkannya', () => {
    assertMatrix(
      PM_TEKNIS,
      ['project:write', 'deliverable:write', 'invoice:read', 'kpi:read', 'csat:read', 'contract:read'],
      ['invoice:write', 'cost:approve', 'cost:write', 'contract:write', 'kpi:write', 'csat:write'],
    )
  })

  it('divisi MARKETING — boleh menyiapkan tender dan mengajukan biaya, tetapi TIDAK boleh menyetujui biaya', () => {
    assertMatrix(
      STAF_MARKETING,
      ['tender:read', 'tender:write', 'project:read', 'cost:read', 'cost:write'],
      ['cost:approve', 'invoice:write', 'contract:write', 'deliverable:write', 'personnel:write', 'project:write'],
    )
  })

  it('divisi HR — boleh mengelola personel, KPI, dan CSAT, tetapi TIDAK boleh mengubah kontrak', () => {
    assertMatrix(
      STAF_HR,
      ['personnel:read', 'personnel:write', 'kpi:read', 'kpi:write', 'csat:read', 'csat:write'],
      ['contract:write', 'contract:read', 'invoice:write', 'cost:approve', 'tender:write', 'project:write'],
    )
  })

  it('divisi ADMIN_LEGAL — boleh mengubah kontrak, tetapi TIDAK boleh menerbitkan invoice maupun menyetujui biaya', () => {
    assertMatrix(
      STAF_ADMIN_LEGAL,
      ['contract:read', 'contract:write', 'project:read', 'tender:read', 'personnel:read'],
      ['invoice:write', 'cost:approve', 'cost:write', 'deliverable:write', 'kpi:write'],
    )
  })

  it('divisi FINANCE — staf finance boleh menerbitkan invoice, tetapi persetujuan biaya tetap milik Finance Manager', () => {
    assertMatrix(
      STAF_FINANCE,
      ['invoice:read', 'invoice:write', 'cost:read', 'cost:write', 'contract:read'],
      ['cost:approve', 'contract:write', 'deliverable:write', 'personnel:write', 'project:write'],
    )
  })

  it('peran FINANCE_MANAGER — boleh menyetujui biaya tender dan menerbitkan invoice, tetapi TIDAK boleh mengubah kontrak', () => {
    assertMatrix(
      FINANCE_MANAGER,
      ['cost:approve', 'cost:write', 'invoice:write', 'invoice:read', 'contract:read'],
      ['contract:write', 'deliverable:write', 'personnel:write', 'kpi:write', 'project:write'],
    )
  })

  it('peran DIREKTUR — boleh melakukan seluruh aksi tanpa kecuali', () => {
    for (const permission of PERMISSIONS) {
      expect(can(DIREKTUR, permission), `Direktur seharusnya boleh ${permission}`).toBe(true)
    }
    expect(permissionsFor(DIREKTUR)).toHaveLength(PERMISSIONS.length)
  })

  it('akun NONAKTIF — kehilangan seluruh akses, termasuk izin dasar notifikasi', () => {
    for (const permission of PERMISSIONS) {
      expect(can(AKUN_NONAKTIF, permission), `Akun nonaktif tidak boleh ${permission}`).toBe(false)
    }
    expect(() => assertCan(AKUN_NONAKTIF, 'notification:read')).toThrowError(BusinessRuleError)
  })

  it('akun NONAKTIF berperan direktur pun tetap ditolak seluruhnya', () => {
    const direkturNonaktif = { ...DIREKTUR, isActive: false }
    for (const permission of PERMISSIONS) {
      expect(can(direkturNonaktif, permission)).toBe(false)
    }
  })
})

describe('Skenario: pemisahan tugas pada satu berkas biaya tender', () => {
  it('pengaju (marketing) tidak dapat sekaligus menjadi penyetuju', () => {
    expect(can(STAF_MARKETING, 'cost:write')).toBe(true)
    expect(can(STAF_MARKETING, 'cost:approve')).toBe(false)
  })

  it('penyetuju biaya tender hanya Direktur dan Finance Manager', () => {
    const kandidat: Array<[string, Actor]> = [
      ['Direktur', DIREKTUR],
      ['Finance Manager', FINANCE_MANAGER],
      ['Staf Finance', STAF_FINANCE],
      ['Project Manager Teknis', PM_TEKNIS],
      ['Staf Marketing', STAF_MARKETING],
      ['Staf Admin & Legal', STAF_ADMIN_LEGAL],
      ['Staf HR', STAF_HR],
    ]
    const berhak = kandidat.filter(([, subject]) => can(subject, 'cost:approve')).map(([label]) => label)

    expect(berhak).toEqual(['Direktur', 'Finance Manager'])
  })

  it('staf divisi MANAJEMEN boleh memantau seluruh lini tetapi tidak boleh bertindak', () => {
    // Penempatan di divisi manajemen tidak menggantikan wewenang jabatan:
    // Manajer Mutu perlu melihat semuanya untuk mengawasi, namun menyetujui
    // biaya dan menerbitkan invoice tetap milik Direktur dan Finance Manager.
    // Seluruh hak memantau tersedia; hak menulis yang dimilikinya murni berasal
    // dari jabatan Project Manager, bukan dari penempatan di divisi manajemen.
    for (const permission of PERMISSIONS.filter((p) => p.endsWith(':read'))) {
      expect(can(MANAJER_MUTU, permission)).toBe(true)
    }

    expect(can(MANAJER_MUTU, 'cost:approve')).toBe(false)
    expect(can(MANAJER_MUTU, 'invoice:write')).toBe(false)
    expect(can(MANAJER_MUTU, 'contract:write')).toBe(false)
  })
})
