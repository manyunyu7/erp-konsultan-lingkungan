import { BusinessRuleError, type Division, type Role } from '@/server/shared/constants'

/**
 * Matriks hak akses.
 *
 * Kunci desain: izin dinyatakan sebagai pasangan "sumber daya:aksi", bukan
 * pengecekan peran yang tersebar di seluruh kode. Dengan begitu penambahan
 * divisi baru cukup mengubah tabel di berkas ini.
 */
export const PERMISSIONS = [
  'tender:read',
  'tender:write',
  'project:read',
  'project:write',
  'cost:read',
  'cost:write',
  'cost:approve',
  'invoice:read',
  'invoice:write',
  'deliverable:read',
  'deliverable:write',
  'personnel:read',
  'personnel:write',
  'kpi:read',
  'kpi:write',
  'contract:read',
  'contract:write',
  'csat:read',
  'csat:write',
  'notification:read',
] as const

export type Permission = (typeof PERMISSIONS)[number]

/** Semua orang di perusahaan boleh melihat notifikasi yang ditujukan padanya. */
const BASE_PERMISSIONS: Permission[] = ['notification:read']

const DIVISION_PERMISSIONS: Record<Division, Permission[]> = {
  MARKETING: ['tender:read', 'tender:write', 'project:read', 'cost:read', 'cost:write'],
  ADMIN_LEGAL: [
    'project:read',
    'contract:read',
    'contract:write',
    'tender:read',
    'personnel:read',
  ],
  FINANCE: [
    'cost:read',
    'cost:write',
    'invoice:read',
    'invoice:write',
    'project:read',
    'tender:read',
    'contract:read',
  ],
  TEKNIS: ['project:read', 'deliverable:read', 'deliverable:write', 'personnel:read'],
  HR: ['personnel:read', 'personnel:write', 'kpi:read', 'kpi:write', 'csat:read', 'csat:write'],
  MANAJEMEN: [...PERMISSIONS],
}

/** Tambahan izin yang melekat pada jabatan, terlepas dari divisinya. */
const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  DIREKTUR: [...PERMISSIONS],
  FINANCE_MANAGER: ['cost:approve', 'invoice:write', 'invoice:read', 'cost:read', 'cost:write'],
  PROJECT_MANAGER: [
    'project:read',
    'project:write',
    'deliverable:read',
    'deliverable:write',
    'cost:read',
    'invoice:read',
    'personnel:read',
    'kpi:read',
    'csat:read',
    'contract:read',
    'tender:read',
  ],
  STAFF: [],
}

export interface Actor {
  id: string
  role: Role
  division: Division
  isActive: boolean
}

/** Gabungan izin dasar, izin divisi, dan izin jabatan — tanpa duplikat. */
export function permissionsFor(actor: Pick<Actor, 'role' | 'division'>): Permission[] {
  return [
    ...new Set([
      ...BASE_PERMISSIONS,
      ...DIVISION_PERMISSIONS[actor.division],
      ...ROLE_PERMISSIONS[actor.role],
    ]),
  ]
}

export function can(actor: Actor, permission: Permission): boolean {
  // Akun nonaktif kehilangan seluruh akses, sekalipun perannya direktur.
  if (!actor.isActive) return false
  return permissionsFor(actor).includes(permission)
}

/** Varian `can` yang melempar — dipakai di lapisan API agar alurnya ringkas. */
export function assertCan(actor: Actor, permission: Permission): void {
  if (!can(actor, permission)) {
    throw new BusinessRuleError(
      `Akses ditolak: ${permission} tidak tersedia untuk ${actor.role}/${actor.division}.`,
      'FORBIDDEN',
    )
  }
}

const MIN_PASSWORD_LENGTH = 8

/** Aturan kata sandi minimal: panjang, ada huruf, ada angka. */
export function validatePassword(password: string): void {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new BusinessRuleError(
      `Kata sandi minimal ${MIN_PASSWORD_LENGTH} karakter.`,
      'PASSWORD_TOO_SHORT',
    )
  }
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    throw new BusinessRuleError(
      'Kata sandi harus memuat huruf dan angka.',
      'PASSWORD_TOO_WEAK',
    )
  }
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}
