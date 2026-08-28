/**
 * Aturan bisnis HR (Bab 3 SOP): evaluasi kinerja, sertifikasi tenaga ahli,
 * dan Form Kebutuhan Personel (F-HR-01).
 *
 * File ini SENGAJA murni: tanpa akses database dan tanpa `new Date()`.
 * Alasannya agar aturan dapat diuji deterministik — semua fungsi yang
 * bergantung waktu menerima `now` dari pemanggil.
 */

import { BusinessRuleError } from '@/server/shared/constants'

// ------------------------------------------------------------------ KONSTANTA

export const EMPLOYMENT_TYPES = ['TETAP', 'PKWT', 'FREELANCE_EXPERT'] as const
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number]

export const KPI_PERIOD_TYPES = ['ANNUAL', 'PER_PROJECT'] as const
export type KpiPeriodType = (typeof KPI_PERIOD_TYPES)[number]

export const KPI_PREDICATES = ['SANGAT_BAIK', 'BAIK', 'CUKUP', 'PERLU_PERBAIKAN'] as const
export type KpiPredicate = (typeof KPI_PREDICATES)[number]

/** Bobot indikator KPI; totalnya harus 1. */
export const KPI_WEIGHTS = { punctuality: 0.35, quality: 0.4, teamwork: 0.25 } as const

export const MANPOWER_REQUEST_STATUSES = [
  'SUBMITTED',
  'APPROVED',
  'REJECTED',
  'FULFILLED',
] as const
export type ManpowerRequestStatus = (typeof MANPOWER_REQUEST_STATUSES)[number]

/** Sertifikat wajib untuk penyusunan dokumen AMDAL. */
export const AMDAL_REQUIRED_CERTIFICATIONS = ['KTPA', 'ATPA', 'K3', 'AMBIL_SAMPEL', 'SKK'] as const

/**
 * Sertifikat per jenis dokumen. AMDAL memerlukan ketua/anggota tim penyusun
 * (KTPA atau ATPA) — dimodelkan sebagai alternatif, lihat `requiredCertificationsFor`.
 */
const DOCUMENT_TYPE_CERTIFICATIONS: Record<string, readonly string[][]> = {
  AMDAL: [['KTPA', 'ATPA'], ['K3'], ['AMBIL_SAMPEL'], ['SKK']],
  UKL_UPL: [['K3'], ['AMBIL_SAMPEL']],
  DELH: [['K3']],
  DPLH: [['K3']],
}

/** Ambang peringatan perpanjangan sertifikat: H-60. */
export const CERTIFICATE_WARNING_DAYS = 60

const MS_PER_DAY = 24 * 60 * 60 * 1000

// ------------------------------------------------------------------ TIPE DATA

export interface KpiScores {
  punctualityScore: number
  qualityScore: number
  teamworkScore: number
}

export interface KpiEvaluationInput extends KpiScores {
  personnelId: string
  employmentType: EmploymentType
  periodType: KpiPeriodType
  periodYear?: number | null
  projectId?: string | null
}

export interface CertificationLike {
  name: string
  expiresAt: Date
}

export interface ManpowerRequestFormInput {
  position: string
  employmentType: EmploymentType
  qualification: string
  certifications: string
  quantity: number
  neededBy: Date
}

// ------------------------------------------------------- EVALUASI KINERJA (KPI)

/** Skor indikator wajib bilangan bulat 0–100. */
export function assertValidScore(label: string, score: number): void {
  if (!Number.isInteger(score) || score < 0 || score > 100) {
    throw new BusinessRuleError(
      `Skor ${label} harus bilangan bulat 0-100 (diterima: ${score})`,
      'KPI_SCORE_OUT_OF_RANGE',
    )
  }
}

export function assertValidScores(scores: KpiScores): void {
  assertValidScore('ketepatan waktu', scores.punctualityScore)
  assertValidScore('kualitas', scores.qualityScore)
  assertValidScore('kerjasama tim', scores.teamworkScore)
}

/** Rata-rata berbobot, dibulatkan 2 desimal agar cocok Decimal(5,2) di Prisma. */
export function calculateKpiTotalScore(scores: KpiScores): number {
  assertValidScores(scores)
  const total =
    scores.punctualityScore * KPI_WEIGHTS.punctuality +
    scores.qualityScore * KPI_WEIGHTS.quality +
    scores.teamworkScore * KPI_WEIGHTS.teamwork
  return Math.round(total * 100) / 100
}

export function resolveKpiPredicate(totalScore: number): KpiPredicate {
  if (totalScore >= 90) return 'SANGAT_BAIK'
  if (totalScore >= 75) return 'BAIK'
  if (totalScore >= 60) return 'CUKUP'
  return 'PERLU_PERBAIKAN'
}

/** Karyawan tetap dinilai tahunan; tenaga ahli kontrak/freelance per proyek. */
export function expectedPeriodType(employmentType: EmploymentType): KpiPeriodType {
  return employmentType === 'TETAP' ? 'ANNUAL' : 'PER_PROJECT'
}

/**
 * Validasi lengkap evaluasi KPI dan hitung hasilnya.
 * Kombinasi employmentType x periodType yang salah ditolak agar riwayat
 * penilaian tetap konsisten dengan siklus kepegawaian.
 */
export function validateKpiEvaluation(input: KpiEvaluationInput): {
  totalScore: number
  predicate: KpiPredicate
} {
  const expected = expectedPeriodType(input.employmentType)
  if (input.periodType !== expected) {
    throw new BusinessRuleError(
      `Karyawan ${input.employmentType} harus dievaluasi dengan periode ${expected}`,
      'KPI_PERIOD_TYPE_MISMATCH',
    )
  }

  if (input.periodType === 'ANNUAL') {
    // Periode tahunan tanpa tahun tidak bisa dipakai untuk rekap tahunan.
    if (input.periodYear === undefined || input.periodYear === null) {
      throw new BusinessRuleError('Evaluasi tahunan wajib mencantumkan periodYear', 'KPI_PERIOD_YEAR_REQUIRED')
    }
    if (!Number.isInteger(input.periodYear) || input.periodYear < 2000) {
      throw new BusinessRuleError('periodYear tidak valid', 'KPI_PERIOD_YEAR_INVALID')
    }
  } else if (!input.projectId) {
    throw new BusinessRuleError('Evaluasi per-proyek wajib mencantumkan projectId', 'KPI_PROJECT_REQUIRED')
  }

  const totalScore = calculateKpiTotalScore(input)
  return { totalScore, predicate: resolveKpiPredicate(totalScore) }
}

// -------------------------------------------------------------- SERTIFIKASI

/** Kelompok sertifikat yang dibutuhkan; tiap kelompok cukup dipenuhi salah satu. */
export function requiredCertificationsFor(documentType: string): readonly string[][] {
  return DOCUMENT_TYPE_CERTIFICATIONS[documentType] ?? []
}

export function isCertificationActive(certification: CertificationLike, now: Date): boolean {
  return certification.expiresAt.getTime() >= now.getTime()
}

export function hasActiveCertification(
  certifications: readonly CertificationLike[],
  name: string,
  now: Date,
): boolean {
  return certifications.some((c) => c.name === name && isCertificationActive(c, now))
}

/** Sisa hari sampai kedaluwarsa; negatif bila sudah lewat. */
export function daysUntilExpiry(expiresAt: Date, now: Date): number {
  return Math.ceil((expiresAt.getTime() - now.getTime()) / MS_PER_DAY)
}

/** Peringatan H-60: sudah masuk ambang tapi belum kedaluwarsa. */
export function isExpiryWarning(expiresAt: Date, now: Date): boolean {
  const days = daysUntilExpiry(expiresAt, now)
  return days >= 0 && days <= CERTIFICATE_WARNING_DAYS
}

export function isExpired(expiresAt: Date, now: Date): boolean {
  return daysUntilExpiry(expiresAt, now) < 0
}

/** Kelompok sertifikat yang belum terpenuhi pada tanggal acuan. */
export function missingCertifications(
  certifications: readonly CertificationLike[],
  documentType: string,
  at: Date,
): string[] {
  return requiredCertificationsFor(documentType)
    .filter((group) => !group.some((name) => hasActiveCertification(certifications, name, at)))
    .map((group) => group.join('/'))
}

/**
 * Penugasan ditolak bila sertifikat wajib tidak dimiliki atau sudah
 * kedaluwarsa pada tanggal mulai penugasan (bukan tanggal hari ini).
 */
export function assertAssignmentEligibility(
  certifications: readonly CertificationLike[],
  documentType: string,
  startDate: Date,
): void {
  const missing = missingCertifications(certifications, documentType, startDate)
  if (missing.length > 0) {
    throw new BusinessRuleError(
      `Sertifikat wajib belum aktif untuk proyek ${documentType}: ${missing.join(', ')}`,
      'ASSIGNMENT_CERTIFICATION_MISSING',
    )
  }
}

// -------------------------------------------------- REKRUTMEN & F-HR-01

const MANPOWER_TRANSITIONS: Record<ManpowerRequestStatus, readonly ManpowerRequestStatus[]> = {
  SUBMITTED: ['APPROVED', 'REJECTED'],
  APPROVED: ['FULFILLED'],
  REJECTED: [],
  FULFILLED: [],
}

export function canTransitionManpowerRequest(
  from: ManpowerRequestStatus,
  to: ManpowerRequestStatus,
): boolean {
  return MANPOWER_TRANSITIONS[from].includes(to)
}

export function assertManpowerTransition(
  from: ManpowerRequestStatus,
  to: ManpowerRequestStatus,
): void {
  if (!canTransitionManpowerRequest(from, to)) {
    throw new BusinessRuleError(
      `Transisi status F-HR-01 dari ${from} ke ${to} tidak diizinkan`,
      'MANPOWER_INVALID_TRANSITION',
    )
  }
}

/** Tahapan seleksi berbeda: tenaga ahli lepas dinilai dari portofolio. */
export function selectionStagesFor(employmentType: EmploymentType): string[] {
  if (employmentType === 'FREELANCE_EXPERT') {
    return ['SELEKSI_PORTOFOLIO', 'VERIFIKASI_CV', 'VERIFIKASI_IJAZAH', 'VERIFIKASI_SERTIFIKAT_KOMPETENSI']
  }
  return ['SELEKSI_BERKAS', 'WAWANCARA_HR', 'WAWANCARA_TEKNIS', 'USER_TEST']
}

export function validateManpowerRequestForm(input: ManpowerRequestFormInput, now: Date): void {
  if (!Number.isInteger(input.quantity) || input.quantity < 1) {
    throw new BusinessRuleError('Jumlah kebutuhan personel minimal 1', 'MANPOWER_INVALID_QUANTITY')
  }
  if (input.neededBy.getTime() <= now.getTime()) {
    throw new BusinessRuleError('Tanggal kebutuhan harus di masa depan', 'MANPOWER_NEEDED_BY_IN_PAST')
  }
  if (input.qualification.trim() === '') {
    throw new BusinessRuleError('Kualifikasi wajib diisi', 'MANPOWER_QUALIFICATION_REQUIRED')
  }
  if (input.certifications.trim() === '') {
    throw new BusinessRuleError('Sertifikasi yang dibutuhkan wajib diisi', 'MANPOWER_CERTIFICATIONS_REQUIRED')
  }
  if (input.position.trim() === '') {
    throw new BusinessRuleError('Posisi wajib diisi', 'MANPOWER_POSITION_REQUIRED')
  }
}
