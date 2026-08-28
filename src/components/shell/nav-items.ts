import type { Permission } from '@/server/auth'

/**
 * Peta menu. Tiap butir menyebut izin yang dibutuhkan, sehingga menu yang tidak
 * berlaku bagi seorang pengguna tidak sekadar disembunyikan di tampilan —
 * endpoint di baliknya pun menolak dengan izin yang sama.
 */
export interface NavItem {
  label: string
  href: string
  permission?: Permission
  icon: string
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Beranda', href: '/', icon: 'LayoutDashboard' },
  { label: 'Tender', href: '/tender', permission: 'tender:read', icon: 'Gavel' },
  { label: 'Proyek', href: '/proyek', permission: 'project:read', icon: 'FolderKanban' },
  { label: 'Keuangan', href: '/keuangan', permission: 'invoice:read', icon: 'Wallet' },
  { label: 'Personel', href: '/personel', permission: 'personnel:read', icon: 'Users' },
  // Ikon "Users" dipakai ulang karena peta ikon di sidebar.tsx hanya mengenal
  // nama yang sudah terdaftar di sana.
  { label: 'Pengguna', href: '/pengguna', permission: 'user:read', icon: 'ShieldCheck' },
  { label: 'Peringatan', href: '/peringatan', permission: 'notification:read', icon: 'Bell' },
  { label: 'Tampilan', href: '/tampilan', icon: 'Palette' },
]
