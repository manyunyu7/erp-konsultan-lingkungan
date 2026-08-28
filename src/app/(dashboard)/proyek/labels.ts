import type { VarianBadge } from '@/components/ui/badge'

export const PROYEK_STATUS_LABEL: Record<string, string> = {
  PREPARATION: 'Persiapan',
  RUNNING: 'Berjalan',
  REPORTING: 'Pelaporan',
  CLOSING: 'Penutupan',
  CLOSED: 'Selesai',
  CANCELLED: 'Dibatalkan',
}

export const PROYEK_STATUS_VARIAN: Record<string, VarianBadge> = {
  PREPARATION: 'netral',
  RUNNING: 'info',
  REPORTING: 'utama',
  CLOSING: 'peringatan',
  CLOSED: 'sukses',
  CANCELLED: 'bahaya',
}

export const JENIS_DOKUMEN_LABEL: Record<string, string> = {
  AMDAL: 'AMDAL',
  UKL_UPL: 'UKL-UPL',
  DELH: 'DELH',
  DPLH: 'DPLH',
  LAINNYA: 'Lainnya',
}

export const DELIVERABLE_STATUS_LABEL: Record<string, string> = {
  PENDING: 'Belum mulai',
  IN_PROGRESS: 'Dikerjakan',
  QC_REVIEW: 'Pemeriksaan QC',
  SUBMITTED: 'Sudah diserahkan',
  APPROVED: 'Disetujui',
}

export const DELIVERABLE_STATUS_VARIAN: Record<string, VarianBadge> = {
  PENDING: 'netral',
  IN_PROGRESS: 'info',
  QC_REVIEW: 'peringatan',
  SUBMITTED: 'utama',
  APPROVED: 'sukses',
}

export const DELIVERABLE_TYPE_LABEL: Record<string, string> = {
  DESK_STUDY: 'Kajian meja',
  SAMPLING_PLAN: 'Rencana sampling',
  DRAFT_REPORT: 'Draf laporan',
  FINAL_REPORT: 'Laporan akhir',
  EXPOSE: 'Ekspose',
}

/** Penanda kontrak mendekati berakhir: H-30 diwaspadai, H-14 mendesak. */
export function varianSisaKontrak(sisa: number): VarianBadge {
  if (sisa < 0) return 'bahaya'
  if (sisa <= 14) return 'bahaya'
  if (sisa <= 30) return 'peringatan'
  return 'netral'
}

export function labelSisaHari(sisa: number): string {
  return sisa < 0 ? `Lewat ${Math.abs(sisa)} hari` : `H-${sisa}`
}
