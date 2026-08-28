import { BusinessRuleError, type Division, type Role } from '@/server/shared/constants'

/**
 * Matriks hak akses.
 *
 * Kunci desain: izin dinyatakan sebagai pasangan "sumber daya:aksi", bukan
 * pengecekan peran yang tersebar di seluruh kode. Dengan begitu penambahan
 * divisi baru cukup mengubah tabel di berkas ini.
 */
export const USER_MANAGEMENT_PERMISSIONS = ['user:read', 'user:write'] as const

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
  'user:read',
  'user:write',
] as const

export type Permission = (typeof PERMISSIONS)[number]

/** Semua orang di perusahaan boleh melihat notifikasi yang ditujukan padanya. */
const BASE_PERMISSIONS: Permission[] = ['notification:read']

/**
 * Pengelolaan akun sengaja dipisahkan dari wewenang bisnis.
 *
 * Yang memegang kunci akun tidak boleh sekaligus memegang kunci uang: bila
 * Direktur dapat membuat akun, ia bisa membuat akun Finance Manager palsu lalu
 * menyetujui pengeluarannya sendiri — persis gate dua-peran yang hendak
 * dijaga pada biaya tender. Karena itu izin user:* hanya milik SUPERADMIN.
 */
const USER_PERMISSIONS: Permission[] = [...USER_MANAGEMENT_PERMISSIONS]

const BUSINESS_PERMISSIONS = PERMISSIONS.filter(
  (permission) => !USER_PERMISSIONS.includes(permission),
)

export const DIVISION_PERMISSIONS: Record<Division, Permission[]> = {
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
  // Divisi manajemen memantau seluruh lini, tetapi memantau bukan berarti
  // boleh bertindak: wewenang menyetujui biaya dan menerbitkan invoice melekat
  // pada jabatan (Direktur, Finance Manager), bukan pada penempatan divisi.
  MANAJEMEN: BUSINESS_PERMISSIONS.filter((p) => p.endsWith(':read')),
  // Administrator sistem tidak ditempatkan pada divisi bisnis manapun, supaya
  // tidak diam-diam mewarisi hak memantau pekerjaan yang bukan urusannya.
  SISTEM: [],
}

/** Tambahan izin yang melekat pada jabatan, terlepas dari divisinya. */
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  // Administrator sistem: mengurus akun, bukan mengurus pekerjaan.
  SUPERADMIN: [...USER_PERMISSIONS],
  DIREKTUR: [...BUSINESS_PERMISSIONS],
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

/** Bentuk matriks hak akses; dipakai baik oleh bawaan maupun hasil suntingan. */
export interface PermissionMatrix {
  roles: Record<Role, Permission[]>
  divisions: Record<Division, Permission[]>
}

/** Matriks bawaan — dipakai bila belum ada suntingan tersimpan. */
export const DEFAULT_MATRIX: PermissionMatrix = {
  roles: ROLE_PERMISSIONS,
  divisions: DIVISION_PERMISSIONS,
}

/**
 * Gabungan izin dasar, izin divisi, dan izin jabatan — tanpa duplikat.
 *
 * `matrix` dapat diisi matriks hasil suntingan administrator; bila tidak
 * diisi, yang berlaku adalah matriks bawaan di berkas ini.
 */
export function permissionsFor(
  actor: Pick<Actor, 'role' | 'division'>,
  matrix: PermissionMatrix = DEFAULT_MATRIX,
): Permission[] {
  return [
    ...new Set([
      ...BASE_PERMISSIONS,
      ...matrix.divisions[actor.division],
      ...matrix.roles[actor.role],
    ]),
  ]
}

export function can(
  actor: Actor,
  permission: Permission,
  matrix: PermissionMatrix = DEFAULT_MATRIX,
): boolean {
  // Akun nonaktif kehilangan seluruh akses, sekalipun perannya direktur.
  if (!actor.isActive) return false
  return permissionsFor(actor, matrix).includes(permission)
}

/** Varian `can` yang melempar — dipakai di lapisan API agar alurnya ringkas. */
export function assertCan(
  actor: Actor,
  permission: Permission,
  matrix: PermissionMatrix = DEFAULT_MATRIX,
): void {
  if (!can(actor, permission, matrix)) {
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
