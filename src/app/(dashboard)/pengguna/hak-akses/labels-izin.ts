import type { Permission } from '@/server/auth'

/**
 * Penjelasan tiap izin untuk manusia.
 *
 * Kalimatnya diturunkan dari pemakaian izin itu di route handler dan halaman —
 * bukan karangan. Sumber kebenarannya tetap `src/server/auth/rules.ts`; di sini
 * hanya diterjemahkan supaya administrator tahu akibat centangnya.
 */
export const IZIN_PENJELASAN: Record<Permission, string> = {
  'tender:read': 'Melihat daftar tender beserta tenggat dan statusnya.',
  'tender:write': 'Membuat tender baru dan mengubah tahapannya.',
  'project:read': 'Melihat daftar proyek dan rinciannya.',
  'project:write': 'Membuat proyek, mengubah datanya, dan menutup proyek.',
  'cost:read': 'Melihat catatan biaya tender dan biaya proyek.',
  'cost:write': 'Mencatat pengajuan biaya baru.',
  'cost:approve': 'Menyetujui atau menolak pengajuan biaya tender.',
  'invoice:read': 'Membuka halaman Keuangan: invoice, penagihan, dan biaya.',
  'invoice:write': 'Merencanakan termin dan menerbitkan invoice.',
  'deliverable:read': 'Melihat dokumen serahan dan progres pekerjaan proyek.',
  'deliverable:write': 'Memperbarui status pekerjaan dan dokumen serahan proyek.',
  'personnel:read': 'Melihat data personel dan kebutuhan tenaga ahli.',
  'personnel:write': 'Menambah dan menyunting data personel.',
  'kpi:read': 'Melihat penilaian KPI personel.',
  'kpi:write': 'Memberi dan mengubah penilaian KPI personel.',
  'contract:read': 'Melihat kontrak proyek.',
  'contract:write': 'Mencatat dan memperbarui kontrak proyek.',
  'csat:read': 'Melihat hasil survei kepuasan pelanggan.',
  'csat:write': 'Mencatat hasil survei kepuasan pelanggan saat penutupan proyek.',
  'notification:read': 'Melihat halaman Peringatan berisi tenggat yang mendekat.',
  'user:read': 'Melihat daftar akun pengguna dan matriks hak akses ini.',
  'user:write': 'Membuat akun, mengubah peran, dan menyetel kata sandi.',
}
