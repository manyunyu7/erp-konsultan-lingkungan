import { describe, expect, it } from 'vitest'
import { BusinessRuleError, DIVISIONS, ROLES } from '@/server/shared/constants'
import {
  PERMISSIONS,
  assertCan,
  can,
  normalizeEmail,
  permissionsFor,
  validatePassword,
  type Actor,
} from './rules'

function actor(over: Partial<Actor> = {}): Actor {
  return { id: 'u1', role: 'STAFF', division: 'TEKNIS', isActive: true, ...over }
}

describe('permissionsFor', () => {
  it('memberi izin dasar notifikasi ke setiap kombinasi peran dan divisi', () => {
    for (const role of ROLES) {
      for (const division of DIVISIONS) {
        expect(permissionsFor({ role, division })).toContain('notification:read')
      }
    }
  })

  it('menggabungkan izin divisi dengan izin jabatan tanpa duplikat', () => {
    const result = permissionsFor({ role: 'FINANCE_MANAGER', division: 'FINANCE' })
    expect(result).toContain('cost:approve') // dari jabatan
    expect(result).toContain('invoice:write') // dari divisi dan jabatan
    expect(new Set(result).size).toBe(result.length)
  })

  it('memberi seluruh izin bisnis kepada direktur di divisi manapun', () => {
    const hasil = permissionsFor({ role: 'DIREKTUR', division: 'TEKNIS' })

    expect(hasil).toEqual(
      expect.arrayContaining(PERMISSIONS.filter((p) => !p.startsWith('user:'))),
    )
    expect(hasil).not.toContain('user:write')
  })

  it('memisahkan pengelolaan akun ke superadmin, terlepas dari divisinya', () => {
    const hasil = permissionsFor({ role: 'SUPERADMIN', division: 'SISTEM' })

    expect(hasil).toEqual(
      expect.arrayContaining(['user:read', 'user:write', 'notification:read']),
    )
    expect(hasil).not.toContain('cost:approve')
    expect(hasil).not.toContain('invoice:write')
    expect(hasil).not.toContain('project:read')
  })

  it('memberi divisi manajemen hak memantau saja, bukan hak bertindak', () => {
    const hasil = permissionsFor({ role: 'STAFF', division: 'MANAJEMEN' })

    expect(hasil).toEqual(
      expect.arrayContaining(
        PERMISSIONS.filter((p) => p.endsWith(':read') && !p.startsWith('user:')),
      ),
    )
    // Memantau pekerjaan bukan berarti boleh melihat, apalagi mengubah, akun.
    expect(hasil).not.toContain('user:read')
    expect(hasil).not.toContain('cost:approve')
    expect(hasil).not.toContain('invoice:write')
    expect(hasil).not.toContain('contract:write')
  })

  it('membatasi staf teknis pada urusan teknis saja', () => {
    const result = permissionsFor({ role: 'STAFF', division: 'TEKNIS' })
    expect(result).toContain('deliverable:write')
    expect(result).not.toContain('invoice:write')
    expect(result).not.toContain('cost:approve')
  })

  it('tidak memberi persetujuan biaya kepada divisi marketing', () => {
    expect(permissionsFor({ role: 'STAFF', division: 'MARKETING' })).not.toContain('cost:approve')
  })
})

describe('can', () => {
  it('mengizinkan aksi yang tercakup izin aktor', () => {
    expect(can(actor({ division: 'FINANCE' }), 'invoice:write')).toBe(true)
  })

  it('menolak aksi di luar izin aktor', () => {
    expect(can(actor(), 'invoice:write')).toBe(false)
  })

  it('mencabut seluruh akses akun nonaktif meskipun direktur', () => {
    expect(can(actor({ role: 'DIREKTUR', isActive: false }), 'tender:read')).toBe(false)
  })
})

describe('assertCan', () => {
  it('lolos tanpa melempar bila izin terpenuhi', () => {
    expect(() => assertCan(actor({ division: 'HR' }), 'kpi:write')).not.toThrow()
  })

  it('melempar FORBIDDEN bila izin tidak terpenuhi', () => {
    try {
      assertCan(actor(), 'cost:approve')
      expect.unreachable('seharusnya melempar')
    } catch (error) {
      expect(error).toBeInstanceOf(BusinessRuleError)
      expect((error as BusinessRuleError).code).toBe('FORBIDDEN')
      expect((error as Error).message).toContain('STAFF/TEKNIS')
    }
  })
})

describe('validatePassword', () => {
  it('menerima kata sandi yang memenuhi syarat', () => {
    expect(() => validatePassword('rahasia123')).not.toThrow()
  })

  it('menolak kata sandi kurang dari 8 karakter', () => {
    expect(() => validatePassword('abc1')).toThrowError(/minimal 8 karakter/)
  })

  it('menolak kata sandi tanpa angka', () => {
    expect(() => validatePassword('rahasiabanget')).toThrowError(/huruf dan angka/)
  })

  it('menolak kata sandi tanpa huruf', () => {
    expect(() => validatePassword('12345678')).toThrowError(/huruf dan angka/)
  })
})

describe('normalizeEmail', () => {
  it('menghapus spasi dan menyeragamkan ke huruf kecil', () => {
    expect(normalizeEmail('  Budi@Contoh.CO.ID ')).toBe('budi@contoh.co.id')
  })
})
