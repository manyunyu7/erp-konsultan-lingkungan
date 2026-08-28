/**
 * Aturan bisnis siklus hidup tender -> proyek -> penutupan.
 *
 * Semua fungsi di file ini MURNI: tanpa akses database, tanpa `new Date()`.
 * Alasan: aturan SOP harus bisa diuji deterministik dan dipakai ulang di
 * sisi klien (preview tombol/aksi) tanpa menyentuh Prisma.
 */

import {
  BusinessRuleError,
  type ProjectStatus,
  type TenderStatus,
} from '@/server/shared/constants'

// ------------------------------------------------------------------- TENDER

/**
 * Peta transisi status tender yang sah.
 * CANCELLED dibolehkan dari status manapun kecuali status final WON/LOST —
 * karena tender yang sudah diputuskan pemenangnya tidak bisa ditarik lagi.
 */
export const TENDER_TRANSITIONS: Readonly<Record<TenderStatus, readonly TenderStatus[]>> = {
  IDENTIFIED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['SUBMITTED', 'CANCELLED'],
  SUBMITTED: ['WON', 'LOST', 'CANCELLED'],
  WON: [],
  LOST: [],
  CANCELLED: [],
}

export function canTransitionTender(from: TenderStatus, to: TenderStatus): boolean {
  return TENDER_TRANSITIONS[from].includes(to)
}

/**
 * Validasi transisi tender sekaligus gate deadline.
 * `now` diinjeksi supaya pengujian deadline deterministik.
 */
export function assertTenderTransition(input: {
  from: TenderStatus
  to: TenderStatus
  submissionDeadline: Date
  now: Date
}): void {
  const { from, to, submissionDeadline, now } = input

  if (!canTransitionTender(from, to)) {
    throw new BusinessRuleError(
      `Transisi status tender ${from} -> ${to} tidak diizinkan`,
      'TENDER_INVALID_TRANSITION',
    )
  }

  // Penawaran yang lewat batas waktu otomatis gugur di LPSE, jadi ditolak di hulu.
  if (to === 'SUBMITTED' && now.getTime() > submissionDeadline.getTime()) {
    throw new BusinessRuleError(
      'Tender tidak dapat disubmit setelah melewati batas waktu pemasukan',
      'TENDER_DEADLINE_PASSED',
    )
  }
}

export interface TenderConversionSource {
  id: string
  clientId: string
  status: TenderStatus
  bidValue: number | null
  estimatedValue: number | null
}

export interface ProjectDraft {
  code: string
  name: string
  clientId: string
  tenderId: string
  documentType: string
  contractValue: number
  startDate: Date
  endDate: Date
  status: ProjectStatus
}

/**
 * Konversi tender menang menjadi draft job order.
 * Nilai kontrak memakai bidValue (harga penawaran final); estimatedValue hanya
 * cadangan bila bidValue belum diisi saat menang penunjukan langsung.
 */
export function buildProjectDraftFromTender(input: {
  tender: TenderConversionSource
  code: string
  name: string
  documentType: string
  startDate: Date
  endDate: Date
}): ProjectDraft {
  const { tender, code, name, documentType, startDate, endDate } = input

  if (tender.status !== 'WON') {
    throw new BusinessRuleError(
      'Hanya tender berstatus WON yang dapat dikonversi menjadi proyek',
      'TENDER_NOT_WON',
    )
  }

  const contractValue = tender.bidValue ?? tender.estimatedValue
  if (contractValue === null) {
    throw new BusinessRuleError(
      'Tender tidak memiliki nilai penawaran maupun estimasi',
      'TENDER_VALUE_MISSING',
    )
  }

  assertProjectDates(startDate, endDate)

  return {
    code,
    name,
    clientId: tender.clientId,
    tenderId: tender.id,
    documentType,
    contractValue,
    startDate,
    endDate,
    status: 'PREPARATION',
  }
}

// ------------------------------------------------------------------ PROYEK

/** CANCELLED hanya sampai REPORTING; setelah CLOSING pekerjaan sudah diserahkan. */
export const PROJECT_TRANSITIONS: Readonly<Record<ProjectStatus, readonly ProjectStatus[]>> = {
  PREPARATION: ['RUNNING', 'CANCELLED'],
  RUNNING: ['REPORTING', 'CANCELLED'],
  REPORTING: ['CLOSING', 'CANCELLED'],
  CLOSING: ['CLOSED'],
  CLOSED: [],
  CANCELLED: [],
}

export function canTransitionProject(from: ProjectStatus, to: ProjectStatus): boolean {
  return PROJECT_TRANSITIONS[from].includes(to)
}

export function assertProjectDates(startDate: Date, endDate: Date): void {
  if (endDate.getTime() <= startDate.getTime()) {
    throw new BusinessRuleError(
      'Tanggal selesai proyek harus setelah tanggal mulai',
      'PROJECT_INVALID_DATE_RANGE',
    )
  }
}

/**
 * Gate transisi proyek beserta prasyarat dokumen:
 * - RUNNING butuh kontrak tertanda tangan (SPK/LOA/PKS) agar pekerjaan punya dasar hukum.
 * - CLOSED butuh BAST tertanda tangan sebagai bukti serah terima.
 */
export function assertProjectTransition(input: {
  from: ProjectStatus
  to: ProjectStatus
  hasSignedContract: boolean
  hasSignedBast: boolean
}): void {
  const { from, to, hasSignedContract, hasSignedBast } = input

  if (!canTransitionProject(from, to)) {
    throw new BusinessRuleError(
      `Transisi status proyek ${from} -> ${to} tidak diizinkan`,
      'PROJECT_INVALID_TRANSITION',
    )
  }

  if (to === 'RUNNING' && !hasSignedContract) {
    throw new BusinessRuleError(
      'Proyek tidak dapat berjalan sebelum ada kontrak (SPK/LOA/PKS) yang ditandatangani',
      'PROJECT_CONTRACT_REQUIRED',
    )
  }

  if (to === 'CLOSED' && !hasSignedBast) {
    throw new BusinessRuleError(
      'Proyek tidak dapat ditutup tanpa BAST yang ditandatangani',
      'PROJECT_BAST_REQUIRED',
    )
  }
}

/** Kontrak dianggap sah bila berjenis SPK/LOA/PKS dan sudah ditandatangani. */
export const BINDING_CONTRACT_TYPES = ['SPK', 'LOA', 'PKS'] as const
export type BindingContractType = (typeof BINDING_CONTRACT_TYPES)[number]

export function isBindingContract(contract: { type: string; signedAt: Date | null }): boolean {
  return (
    contract.signedAt !== null &&
    (BINDING_CONTRACT_TYPES as readonly string[]).includes(contract.type)
  )
}

// -------------------------------------------------------- TAHAPAN TEKNIS

/** Urutan kerja teknis wajib sesuai SOP AMDAL/UKL-UPL. */
export const TECHNICAL_STAGE_ORDER = [
  'DESK_STUDY',
  'SAMPLING_PLAN',
  'LAB_TEST',
  'DRAFT_REPORT',
  'EXPOSE',
  'FINAL_REPORT',
] as const
export type TechnicalStage = (typeof TECHNICAL_STAGE_ORDER)[number]

export const DELIVERABLE_STATUSES = [
  'PENDING',
  'IN_PROGRESS',
  'QC_REVIEW',
  'SUBMITTED',
  'APPROVED',
] as const
export type DeliverableStatus = (typeof DELIVERABLE_STATUSES)[number]

export const DELIVERABLE_TRANSITIONS: Readonly<
  Record<DeliverableStatus, readonly DeliverableStatus[]>
> = {
  PENDING: ['IN_PROGRESS'],
  IN_PROGRESS: ['QC_REVIEW'],
  QC_REVIEW: ['SUBMITTED'],
  SUBMITTED: ['APPROVED'],
  APPROVED: [],
}

export function stageIndex(stage: TechnicalStage): number {
  return TECHNICAL_STAGE_ORDER.indexOf(stage)
}

/** Tahap prasyarat = seluruh tahap sebelum tahap target pada urutan wajib. */
export function prerequisiteStages(stage: TechnicalStage): TechnicalStage[] {
  return TECHNICAL_STAGE_ORDER.slice(0, stageIndex(stage))
}

/**
 * Tahap berikutnya baru boleh dimulai bila seluruh prasyaratnya APPROVED —
 * mis. uji lab tidak boleh jalan sebelum rencana sampling disetujui.
 */
export function assertStagePrerequisites(input: {
  stage: TechnicalStage
  approvedStages: readonly TechnicalStage[]
}): void {
  const missing = prerequisiteStages(input.stage).filter(
    (prereq) => !input.approvedStages.includes(prereq),
  )

  if (missing.length > 0) {
    throw new BusinessRuleError(
      `Tahap ${input.stage} tidak dapat dimulai; tahap prasyarat belum disetujui: ${missing.join(', ')}`,
      'STAGE_PREREQUISITE_INCOMPLETE',
    )
  }
}

export function assertDeliverableTransition(input: {
  from: DeliverableStatus
  to: DeliverableStatus
  qcPassedAt: Date | null
}): void {
  const { from, to, qcPassedAt } = input

  if (!DELIVERABLE_TRANSITIONS[from].includes(to)) {
    throw new BusinessRuleError(
      `Transisi status deliverable ${from} -> ${to} tidak diizinkan`,
      'DELIVERABLE_INVALID_TRANSITION',
    )
  }

  // QC internal adalah gerbang mutu terakhir sebelum dokumen keluar ke klien.
  if (to === 'SUBMITTED' && qcPassedAt === null) {
    throw new BusinessRuleError(
      'Deliverable tidak dapat disubmit sebelum lolos QC (qcPassedAt kosong)',
      'DELIVERABLE_QC_REQUIRED',
    )
  }
}

// --------------------------------------------------------------- LAB SAMPLE

export const LAB_SAMPLE_STATUSES = ['COLLECTED', 'SENT', 'TESTED', 'REPORTED'] as const
export type LabSampleStatus = (typeof LAB_SAMPLE_STATUSES)[number]

export const LAB_SAMPLE_TRANSITIONS: Readonly<
  Record<LabSampleStatus, readonly LabSampleStatus[]>
> = {
  COLLECTED: ['SENT'],
  SENT: ['TESTED'],
  TESTED: ['REPORTED'],
  REPORTED: [],
}

/** Laboratorium wajib terakreditasi KAN; minimal namanya harus terisi. */
export function assertLaboratoryName(laboratory: string): void {
  if (laboratory.trim().length === 0) {
    throw new BusinessRuleError(
      'Nama laboratorium wajib diisi (harus terakreditasi KAN)',
      'LAB_NAME_REQUIRED',
    )
  }
}

export function assertLabSampleTransition(input: {
  from: LabSampleStatus
  to: LabSampleStatus
  cocNumber: string | null
  laboratory: string
}): void {
  const { from, to, cocNumber, laboratory } = input

  if (!LAB_SAMPLE_TRANSITIONS[from].includes(to)) {
    throw new BusinessRuleError(
      `Transisi status sampel ${from} -> ${to} tidak diizinkan`,
      'LAB_SAMPLE_INVALID_TRANSITION',
    )
  }

  if (to === 'SENT') {
    assertLaboratoryName(laboratory)
    // Tanpa CoC, hasil uji tidak dapat dipertanggungjawabkan secara legal.
    if (cocNumber === null || cocNumber.trim().length === 0) {
      throw new BusinessRuleError(
        'Sampel tidak dapat dikirim tanpa nomor Chain of Custody',
        'LAB_SAMPLE_COC_REQUIRED',
      )
    }
  }
}

// --------------------------------------------------------- PENUTUPAN & CSAT

/** BAST hanya sah bila laporan final sudah disetujui pemrakarsa/komisi. */
export function assertBastIssuable(input: { finalReportStatus: DeliverableStatus | null }): void {
  if (input.finalReportStatus !== 'APPROVED') {
    throw new BusinessRuleError(
      'BAST hanya dapat diterbitkan setelah FINAL_REPORT berstatus APPROVED',
      'BAST_FINAL_REPORT_REQUIRED',
    )
  }
}

export function assertCsatSendable(input: { bastSignedAt: Date | null }): void {
  if (input.bastSignedAt === null) {
    throw new BusinessRuleError(
      'Survei CSAT hanya dapat dikirim setelah BAST ditandatangani',
      'CSAT_BAST_REQUIRED',
    )
  }
}

/** Bobot CSAT sesuai SOP; totalnya persis 100. */
export const CSAT_WEIGHTS = {
  technical: 0.35,
  timeliness: 0.25,
  responsiveness: 0.2,
  compliance: 0.2,
} as const

export interface CsatScores {
  technicalScore: number
  timelinessScore: number
  responsivenessScore: number
  complianceScore: number
}

export const CSAT_CATEGORIES = ['SANGAT_PUAS', 'PUAS', 'CUKUP', 'TIDAK_PUAS'] as const
export type CsatCategory = (typeof CSAT_CATEGORIES)[number]

function assertScoreRange(label: string, value: number): void {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new BusinessRuleError(
      `Skor ${label} harus berada pada rentang 0-100`,
      'CSAT_SCORE_OUT_OF_RANGE',
    )
  }
}

/** Bulatkan 2 desimal; nilai disimpan di kolom Decimal(5,2). */
export function calculateCsatScore(scores: CsatScores): number {
  assertScoreRange('teknis', scores.technicalScore)
  assertScoreRange('ketepatan waktu', scores.timelinessScore)
  assertScoreRange('komunikasi', scores.responsivenessScore)
  assertScoreRange('administrasi', scores.complianceScore)

  const weighted =
    scores.technicalScore * CSAT_WEIGHTS.technical +
    scores.timelinessScore * CSAT_WEIGHTS.timeliness +
    scores.responsivenessScore * CSAT_WEIGHTS.responsiveness +
    scores.complianceScore * CSAT_WEIGHTS.compliance

  return Math.round(weighted * 100) / 100
}

export function csatCategory(score: number): CsatCategory {
  if (score >= 90) return 'SANGAT_PUAS'
  if (score >= 75) return 'PUAS'
  if (score >= 60) return 'CUKUP'
  return 'TIDAK_PUAS'
}

export interface ClosureChecklistInput {
  bastIssued: boolean
  finalTerminPaid: boolean
  performanceBondReturned: boolean
  archive: {
    reports: boolean
    rawSurveyData: boolean
    baselinePhotos: boolean
    gisMaps: boolean
  }
}

export interface ClosureChecklistItem {
  key: string
  label: string
  fulfilled: boolean
}

export interface ClosureChecklist {
  items: ClosureChecklistItem[]
  complete: boolean
}

/** Checklist administratif penutupan proyek (BAB 6 SOP). */
export function buildClosureChecklist(input: ClosureChecklistInput): ClosureChecklist {
  const archiveComplete =
    input.archive.reports &&
    input.archive.rawSurveyData &&
    input.archive.baselinePhotos &&
    input.archive.gisMaps

  const items: ClosureChecklistItem[] = [
    { key: 'BAST_ISSUED', label: 'BAST terbit', fulfilled: input.bastIssued },
    { key: 'FINAL_TERMIN_PAID', label: 'Termin final lunas', fulfilled: input.finalTerminPaid },
    {
      key: 'PERFORMANCE_BOND_RETURNED',
      label: 'Jaminan pelaksanaan dikembalikan',
      fulfilled: input.performanceBondReturned,
    },
    {
      key: 'ARCHIVE_COMPLETE',
      label: 'Arsip digital lengkap (laporan, raw data survey, foto rona awal, peta GIS)',
      fulfilled: archiveComplete,
    },
  ]

  return { items, complete: items.every((item) => item.fulfilled) }
}
