import { describe, expect, it } from 'vitest'
import { DEFAULT_MATRIX, PERMISSIONS } from '@/server/auth/rules'
import { BusinessRuleError } from '@/server/shared/constants'
import {
  assertGrantAllowed,
  buildMatrix,
  editablePermissionsFor,
  grantsFromDefaults,
  isSubjectLocked,
  isUserManagementPermission,
  type Grant,
} from './rules'

describe('izin yang boleh disunting', () => {
  it('mengunci peran superadmin sepenuhnya', () => {
    expect(editablePermissionsFor('ROLE', 'SUPERADMIN')).toEqual([])
    expect(isSubjectLocked('ROLE', 'SUPERADMIN')).toBe(true)
  })

  it('mengunci divisi sistem sepenuhnya', () => {
    expect(isSubjectLocked('DIVISION', 'SISTEM')).toBe(true)
  })

  it('membuka seluruh izin bisnis untuk subjek lain', () => {
    const hasil = editablePermissionsFor('ROLE', 'DIREKTUR')
    expect(hasil).toContain('cost:approve')
    expect(hasil).not.toContain('user:write')
    expect(isSubjectLocked('DIVISION', 'FINANCE')).toBe(false)
  })

  it('mengenali izin pengelolaan akun', () => {
    expect(isUserManagementPermission('user:read')).toBe(true)
    expect(isUserManagementPermission('cost:approve')).toBe(false)
  })
})

describe('assertGrantAllowed', () => {
  const sah: Grant = { subjectType: 'ROLE', subject: 'DIREKTUR', permission: 'cost:approve' }

  it('menerima pemberian izin yang wajar', () => {
    expect(() => assertGrantAllowed(sah)).not.toThrow()
    expect(() =>
      assertGrantAllowed({
        subjectType: 'DIVISION',
        subject: 'FINANCE',
        permission: 'invoice:write',
      }),
    ).not.toThrow()
  })

  it('menolak subjek yang tidak dikenal', () => {
    expect(() => assertGrantAllowed({ ...sah, subject: 'RAJA' })).toThrowError(
      /tidak dikenal/,
    )
    expect(() =>
      assertGrantAllowed({ subjectType: 'DIVISION', subject: 'DAPUR', permission: 'cost:read' }),
    ).toThrowError(/tidak dikenal/)
  })

  it('menolak izin yang tidak dikenal', () => {
    try {
      assertGrantAllowed({ ...sah, permission: 'uang:ambil' })
      expect.unreachable('seharusnya melempar')
    } catch (error) {
      expect(error).toBeInstanceOf(BusinessRuleError)
      expect((error as BusinessRuleError).code).toBe('UNKNOWN_PERMISSION')
    }
  })

  it('menolak penyuntingan pada subjek yang dikunci', () => {
    expect(() =>
      assertGrantAllowed({
        subjectType: 'ROLE',
        subject: 'SUPERADMIN',
        permission: 'cost:approve',
      }),
    ).toThrowError(/dikunci/)
    expect(() =>
      assertGrantAllowed({
        subjectType: 'DIVISION',
        subject: 'SISTEM',
        permission: 'project:read',
      }),
    ).toThrowError(/dikunci/)
  })

  it('menolak pemberian izin pengelolaan akun kepada siapa pun', () => {
    // Inilah yang mencegah administrator memberi wewenang akun ke peran lain.
    try {
      assertGrantAllowed({ ...sah, permission: 'user:write' })
      expect.unreachable('seharusnya melempar')
    } catch (error) {
      expect((error as BusinessRuleError).code).toBe('USER_PERMISSION_RESERVED')
    }
  })
})

describe('buildMatrix', () => {
  it('memakai matriks bawaan bila belum ada suntingan', () => {
    expect(buildMatrix([])).toBe(DEFAULT_MATRIX)
  })

  it('menyusun matriks dari pemberian izin tersimpan', () => {
    const matrix = buildMatrix([
      { subjectType: 'ROLE', subject: 'STAFF', permission: 'tender:read' },
      { subjectType: 'DIVISION', subject: 'TEKNIS', permission: 'project:read' },
    ])

    expect(matrix.roles.STAFF).toEqual(['tender:read'])
    expect(matrix.divisions.TEKNIS).toEqual(['project:read'])
    expect(matrix.roles.DIREKTUR).toEqual([])
  })

  it('memasang kembali kunci meski basis data disunting langsung', () => {
    // Data yang mencoba memberi superadmin wewenang uang harus diabaikan.
    const matrix = buildMatrix([
      { subjectType: 'ROLE', subject: 'SUPERADMIN', permission: 'cost:approve' },
      { subjectType: 'DIVISION', subject: 'SISTEM', permission: 'invoice:write' },
      { subjectType: 'ROLE', subject: 'STAFF', permission: 'user:write' },
    ])

    expect(matrix.roles.SUPERADMIN).toEqual(['user:read', 'user:write'])
    expect(matrix.divisions.SISTEM).toEqual([])
    expect(matrix.roles.STAFF).toEqual([])
  })

  it('mengabaikan baris yang subjek atau izinnya tidak dikenal', () => {
    const matrix = buildMatrix([
      { subjectType: 'ROLE', subject: 'RAJA', permission: 'cost:read' },
      { subjectType: 'DIVISION', subject: 'DAPUR', permission: 'cost:read' },
      { subjectType: 'ROLE', subject: 'STAFF', permission: 'uang:ambil' },
      { subjectType: 'ROLE', subject: 'STAFF', permission: 'cost:read' },
    ])

    expect(matrix.roles.STAFF).toEqual(['cost:read'])
  })
})

describe('grantsFromDefaults', () => {
  it('memindahkan seluruh matriks bawaan menjadi daftar pemberian izin', () => {
    const grants = grantsFromDefaults()

    const jumlahBawaan =
      Object.values(DEFAULT_MATRIX.roles).reduce((n, p) => n + p.length, 0) +
      Object.values(DEFAULT_MATRIX.divisions).reduce((n, p) => n + p.length, 0)

    expect(grants).toHaveLength(jumlahBawaan)
    expect(grants).toContainEqual({
      subjectType: 'ROLE',
      subject: 'FINANCE_MANAGER',
      permission: 'cost:approve',
    })
  })

  it('menghasilkan matriks yang setara bila dibangun ulang', () => {
    const matrix = buildMatrix(grantsFromDefaults())

    // Superadmin tetap terkunci; sisanya harus sama persis dengan bawaan.
    expect(matrix.roles.SUPERADMIN).toEqual(['user:read', 'user:write'])
    for (const permission of PERMISSIONS.filter((p) => !p.startsWith('user:'))) {
      expect(matrix.roles.DIREKTUR.includes(permission)).toBe(
        DEFAULT_MATRIX.roles.DIREKTUR.includes(permission),
      )
    }
  })
})
