import {
  DEFAULT_MATRIX,
  PERMISSIONS,
  USER_MANAGEMENT_PERMISSIONS,
  type Permission,
  type PermissionMatrix,
} from '@/server/auth/rules'
import {
  BusinessRuleError,
  DIVISIONS,
  ROLES,
  type Division,
  type Role,
} from '@/server/shared/constants'

export const SUBJECT_TYPES = ['ROLE', 'DIVISION'] as const
export type SubjectType = (typeof SUBJECT_TYPES)[number]

export interface Grant {
  subjectType: SubjectType
  subject: string
  permission: string
}

/**
 * Batasan yang tidak boleh dilanggar sekalipun oleh administrator.
 *
 * Membiarkan matriks disunting bebas berarti administrator dapat memberi
 * dirinya sendiri wewenang menyetujui biaya, lalu mengajukan sekaligus
 * menyetujui pengeluarannya sendiri. Dua kunci karena itu dilas mati:
 *
 * 1. Izin pengelolaan akun hanya boleh melekat pada peran SUPERADMIN.
 * 2. SUPERADMIN dan divisi SISTEM tidak boleh menerima wewenang bisnis.
 *
 * Sisanya bebas diatur.
 */
const PROTECTED_ROLE: Role = 'SUPERADMIN'
const PROTECTED_DIVISION: Division = 'SISTEM'

const USER_PERMS: readonly string[] = USER_MANAGEMENT_PERMISSIONS

export function isUserManagementPermission(permission: string): boolean {
  return USER_PERMS.includes(permission)
}

/** Daftar izin yang boleh disunting untuk satu subjek; kosong berarti terkunci. */
export function editablePermissionsFor(
  subjectType: SubjectType,
  subject: string,
): Permission[] {
  if (subjectType === 'ROLE' && subject === PROTECTED_ROLE) return []
  if (subjectType === 'DIVISION' && subject === PROTECTED_DIVISION) return []
  return PERMISSIONS.filter((permission) => !isUserManagementPermission(permission))
}

export function isSubjectLocked(subjectType: SubjectType, subject: string): boolean {
  return editablePermissionsFor(subjectType, subject).length === 0
}

function knownSubject(subjectType: SubjectType, subject: string): boolean {
  return subjectType === 'ROLE'
    ? (ROLES as readonly string[]).includes(subject)
    : (DIVISIONS as readonly string[]).includes(subject)
}

/** Memastikan satu pemberian izin sah sebelum disimpan. */
export function assertGrantAllowed(grant: Grant): void {
  if (!knownSubject(grant.subjectType, grant.subject)) {
    throw new BusinessRuleError(
      `Subjek "${grant.subject}" tidak dikenal.`,
      'UNKNOWN_SUBJECT',
    )
  }
  if (!(PERMISSIONS as readonly string[]).includes(grant.permission)) {
    throw new BusinessRuleError(
      `Izin "${grant.permission}" tidak dikenal.`,
      'UNKNOWN_PERMISSION',
    )
  }
  if (isSubjectLocked(grant.subjectType, grant.subject)) {
    throw new BusinessRuleError(
      `Hak akses "${grant.subject}" dikunci dan tidak dapat diubah dari aplikasi.`,
      'SUBJECT_LOCKED',
    )
  }
  if (isUserManagementPermission(grant.permission)) {
    throw new BusinessRuleError(
      'Izin pengelolaan akun hanya boleh melekat pada peran Superadmin.',
      'USER_PERMISSION_RESERVED',
    )
  }
}

/**
 * Menyusun matriks dari data tersimpan.
 *
 * Batasan di atas diterapkan ulang di sini, bukan hanya saat menyimpan, supaya
 * data yang rusak atau disunting langsung di basis data pun tidak dapat
 * meruntuhkan pemisahan tugas.
 */
export function buildMatrix(grants: Grant[]): PermissionMatrix {
  if (grants.length === 0) return DEFAULT_MATRIX

  const roles = Object.fromEntries(ROLES.map((r) => [r, [] as Permission[]])) as Record<
    Role,
    Permission[]
  >
  const divisions = Object.fromEntries(
    DIVISIONS.map((d) => [d, [] as Permission[]]),
  ) as Record<Division, Permission[]>

  for (const grant of grants) {
    if (!knownSubject(grant.subjectType, grant.subject)) continue
    if (!(PERMISSIONS as readonly string[]).includes(grant.permission)) continue
    if (isSubjectLocked(grant.subjectType, grant.subject)) continue
    if (isUserManagementPermission(grant.permission)) continue

    const permission = grant.permission as Permission
    if (grant.subjectType === 'ROLE') roles[grant.subject as Role].push(permission)
    else divisions[grant.subject as Division].push(permission)
  }

  // Kunci yang dilas mati dipasang kembali, apa pun isi basis data.
  roles[PROTECTED_ROLE] = [...USER_MANAGEMENT_PERMISSIONS]
  divisions[PROTECTED_DIVISION] = []

  return { roles, divisions }
}

/** Bentuk daftar pemberian izin dari matriks bawaan, untuk pengisian awal. */
export function grantsFromDefaults(): Grant[] {
  const grants: Grant[] = []
  for (const role of ROLES) {
    for (const permission of DEFAULT_MATRIX.roles[role]) {
      grants.push({ subjectType: 'ROLE', subject: role, permission })
    }
  }
  for (const division of DIVISIONS) {
    for (const permission of DEFAULT_MATRIX.divisions[division]) {
      grants.push({ subjectType: 'DIVISION', subject: division, permission })
    }
  }
  return grants
}
