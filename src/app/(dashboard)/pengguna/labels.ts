import type { Division, Role } from '@/server/shared/constants'

/**
 * Penjelasan peran dan divisi untuk manusia.
 *
 * Isinya diturunkan dari matriks di `src/server/auth/rules.ts` — bukan
 * ditegakkan di sini. Tujuannya semata memberi tahu pengelola akun apa
 * konsekuensi pilihannya; sumber kebenarannya tetap di server.
 */

export const ROLE_LABEL: Record<Role, string> = {
  SUPERADMIN: 'Superadmin',
  DIREKTUR: 'Direktur',
  FINANCE_MANAGER: 'Manajer Keuangan',
  PROJECT_MANAGER: 'Manajer Proyek',
  STAFF: 'Staf',
}

export const ROLE_PENJELASAN: Record<Role, string> = {
  SUPERADMIN:
    'Mengelola akun saja — membuat pengguna, mengubah peran, dan menyetel kata sandi. Tidak dapat menyetujui biaya, menerbitkan invoice, atau melihat data tender dan proyek.',
  DIREKTUR:
    'Seluruh wewenang bisnis: tender, proyek, biaya beserta persetujuannya, invoice, kontrak, personel, dan KPI. Tidak dapat mengelola akun pengguna.',
  FINANCE_MANAGER:
    'Menyetujui biaya dan menerbitkan invoice, di samping izin yang melekat pada divisinya.',
  PROJECT_MANAGER:
    'Menjalankan proyek dan dokumen serahannya, serta melihat biaya, invoice, personel, KPI, kontrak, dan tender.',
  STAFF:
    'Tidak menambah wewenang apa pun. Yang bisa dikerjakan sepenuhnya mengikuti divisinya.',
}

export const DIVISION_LABEL: Record<Division, string> = {
  MARKETING: 'Marketing',
  ADMIN_LEGAL: 'Admin & Legal',
  FINANCE: 'Keuangan',
  TEKNIS: 'Teknis',
  HR: 'HR',
  MANAJEMEN: 'Manajemen',
  SISTEM: 'Sistem',
}

export const DIVISION_PENJELASAN: Record<Division, string> = {
  MARKETING: 'Mengelola tender dan biaya tender, serta melihat proyek.',
  ADMIN_LEGAL: 'Mengelola kontrak; melihat proyek, tender, dan personel.',
  FINANCE: 'Mencatat biaya dan invoice; melihat proyek, tender, dan kontrak.',
  TEKNIS: 'Mengerjakan dokumen serahan proyek; melihat proyek dan personel.',
  HR: 'Mengelola personel, penilaian KPI, dan kepuasan pelanggan.',
  MANAJEMEN: 'Memantau seluruh lini, tetapi hanya membaca. Wewenang bertindak datang dari perannya.',
  SISTEM: 'Tanpa akses data bisnis sama sekali — dipakai untuk akun administrator.',
}
