/**
 * Aturan bisnis keuangan — FUNGSI MURNI, tanpa akses database.
 *
 * KEPUTUSAN DESAIN UANG:
 * Semua aritmetika uang dilakukan dalam `bigint` satuan minor (sen / 2 desimal).
 * Alasannya: `number` IEEE-754 tidak bisa merepresentasikan pecahan desimal
 * secara eksak sehingga 3 termin yang dijumlah bisa meleset beberapa sen dari
 * nilai kontrak, sedangkan `Decimal` Prisma tidak tersedia sebagai runtime
 * murni di lapisan aturan (kita ingin lapisan ini bebas dependensi DB).
 * Nilai masuk diterima sebagai string/number/Decimal (apa pun yang punya
 * `toString()` desimal) lalu dinormalkan lewat `toMinorUnits`; nilai keluar
 * dikembalikan sebagai string desimal 2 angka lewat `fromMinorUnits` supaya
 * aman dipakai kembali sebagai input `Decimal` Prisma.
 */

import { BusinessRuleError } from '@/server/shared/constants'

// --------------------------------------------------------------------- UANG

/** Apa pun yang bisa dibaca sebagai angka desimal: string, number, Decimal Prisma. */
export type MoneyInput = string | number | { toString(): string }

const MINOR_SCALE = 100n
/** 100% dinyatakan sebagai 10000 (persen dengan 2 desimal, cocok Decimal(5,2)). */
export const PERCENT_BASIS_TOTAL = 10_000n

const DECIMAL_PATTERN = /^(-)?(\d+)(?:\.(\d+))?$/

/**
 * Ubah nilai desimal jadi satuan minor. Pembulatan half-up pada magnitude
 * dipakai karena itu konvensi faktur/pajak di Indonesia, bukan banker's rounding.
 */
export function toMinorUnits(value: MoneyInput): bigint {
  const raw = (typeof value === 'string' ? value : value.toString()).trim()
  const match = DECIMAL_PATTERN.exec(raw)
  if (!match) {
    throw new BusinessRuleError(`Nilai desimal tidak valid: "${raw}"`, 'INVALID_DECIMAL_VALUE')
  }
  const [, sign, whole, fraction] = match
  // digit ke-3 disimpan hanya sebagai penentu pembulatan
  const guarded = `${fraction ?? ''}000`.slice(0, 3)
  const scaled = BigInt(whole) * 1000n + BigInt(guarded)
  const rounded = (scaled + 5n) / 10n
  return sign === '-' ? -rounded : rounded
}

/** Kebalikan `toMinorUnits`: selalu 2 angka desimal agar konsisten di DB dan UI. */
export function fromMinorUnits(minor: bigint): string {
  const negative = minor < 0n
  const absolute = negative ? -minor : minor
  const whole = absolute / MINOR_SCALE
  const fraction = absolute % MINOR_SCALE
  return `${negative ? '-' : ''}${whole}.${fraction.toString().padStart(2, '0')}`
}

/** Bagi dengan pembulatan half-up; dipakai saat menurunkan nominal dari persentase. */
function divideRoundHalfUp(numerator: bigint, denominator: bigint): bigint {
  const negative = numerator < 0n
  const absolute = negative ? -numerator : numerator
  const result = (absolute * 2n + denominator) / (denominator * 2n)
  return negative ? -result : result
}

// ------------------------------------------------------- KATEGORI & COA BIAYA

export const BIDDING_COST_CATEGORIES = [
  'TENDER_DOCUMENT',
  'BID_BOND',
  'ADMIN_LEGAL_NOTARY',
  'TRANSPORT_AUDIENCE',
] as const
export type BiddingCostCategory = (typeof BIDDING_COST_CATEGORIES)[number]

export const PROJECT_COST_CATEGORIES = [
  'EXPERT_HONORARIUM',
  'MOBILIZATION_DEMOBILIZATION',
  'LAB_TEST_KAN',
  'SECONDARY_DATA_IMAGERY',
  'COMMISSION_HEARING',
  'PROJECT_OVERHEAD',
] as const
export type ProjectCostCategory = (typeof PROJECT_COST_CATEGORIES)[number]

/** Pola 1 masuk beban operasional umum (6-xxx), bukan HPP proyek. */
export const BIDDING_COA: Record<BiddingCostCategory, string> = {
  TENDER_DOCUMENT: '6101',
  BID_BOND: '6102',
  ADMIN_LEGAL_NOTARY: '6103',
  TRANSPORT_AUDIENCE: '6104',
}

/** Pola 2 masuk direct cost / HPP (5-xxx) dan dibebankan ke Job Order. */
export const PROJECT_COA: Record<ProjectCostCategory, string> = {
  EXPERT_HONORARIUM: '5101',
  MOBILIZATION_DEMOBILIZATION: '5102',
  LAB_TEST_KAN: '5103',
  SECONDARY_DATA_IMAGERY: '5104',
  COMMISSION_HEARING: '5105',
  PROJECT_OVERHEAD: '5106',
}

/** Gate SOP: biaya tender hanya layak bila peluang menang wajar. */
export const MIN_WIN_RATE_PROBABILITY = 60

export interface BiddingCostInput {
  category: string
  tenderId: string | null | undefined
  projectId: string | null | undefined
  amount: MoneyInput
  winRateProbability: number | null | undefined
}

export interface ValidatedBiddingCost {
  pattern: 'BIDDING'
  category: BiddingCostCategory
  coaCode: string
  tenderId: string
  projectId: null
  amountMinor: bigint
  amount: string
}

function assertPositiveAmount(amount: MoneyInput): bigint {
  const minor = toMinorUnits(amount)
  if (minor <= 0n) {
    throw new BusinessRuleError('Nominal biaya harus lebih besar dari nol.', 'COST_AMOUNT_NOT_POSITIVE')
  }
  return minor
}

/** Pola 1: biaya tender non-refundable, tidak pernah menempel ke proyek. */
export function validateBiddingCost(input: BiddingCostInput): ValidatedBiddingCost {
  if (!BIDDING_COST_CATEGORIES.includes(input.category as BiddingCostCategory)) {
    throw new BusinessRuleError(
      `Kategori "${input.category}" bukan kategori biaya tender.`,
      'INVALID_BIDDING_COST_CATEGORY',
    )
  }
  if (!input.tenderId) {
    throw new BusinessRuleError('Biaya tender wajib menyebut tenderId.', 'BIDDING_COST_REQUIRES_TENDER')
  }
  if (input.projectId) {
    throw new BusinessRuleError(
      'Biaya tender tidak boleh dibebankan ke proyek manapun.',
      'BIDDING_COST_FORBIDS_PROJECT',
    )
  }
  if (input.winRateProbability == null || input.winRateProbability < MIN_WIN_RATE_PROBABILITY) {
    throw new BusinessRuleError(
      `Win rate tender minimal ${MIN_WIN_RATE_PROBABILITY}% untuk mengajukan biaya tender.`,
      'WIN_RATE_BELOW_THRESHOLD',
    )
  }
  const category = input.category as BiddingCostCategory
  const amountMinor = assertPositiveAmount(input.amount)
  return {
    pattern: 'BIDDING',
    category,
    coaCode: BIDDING_COA[category],
    tenderId: input.tenderId,
    projectId: null,
    amountMinor,
    amount: fromMinorUnits(amountMinor),
  }
}

export interface ProjectCostInput {
  category: string
  tenderId: string | null | undefined
  projectId: string | null | undefined
  amount: MoneyInput
  hasSignedContract: boolean
}

export interface ValidatedProjectCost {
  pattern: 'PROJECT'
  category: ProjectCostCategory
  coaCode: string
  tenderId: null
  projectId: string
  amountMinor: bigint
  amount: string
}

/** Pola 2: direct cost per Job Order, hanya setelah kontrak/SPK diteken. */
export function validateProjectCost(input: ProjectCostInput): ValidatedProjectCost {
  if (!PROJECT_COST_CATEGORIES.includes(input.category as ProjectCostCategory)) {
    throw new BusinessRuleError(
      `Kategori "${input.category}" bukan kategori biaya proyek.`,
      'INVALID_PROJECT_COST_CATEGORY',
    )
  }
  if (!input.projectId) {
    throw new BusinessRuleError('Biaya proyek wajib menyebut projectId.', 'PROJECT_COST_REQUIRES_PROJECT')
  }
  if (input.tenderId) {
    throw new BusinessRuleError(
      'Biaya proyek tidak boleh menempel ke tender.',
      'PROJECT_COST_FORBIDS_TENDER',
    )
  }
  if (!input.hasSignedContract) {
    throw new BusinessRuleError(
      'Biaya proyek hanya boleh dicatat setelah kontrak/SPK ditandatangani.',
      'PROJECT_COST_REQUIRES_SIGNED_CONTRACT',
    )
  }
  const category = input.category as ProjectCostCategory
  const amountMinor = assertPositiveAmount(input.amount)
  return {
    pattern: 'PROJECT',
    category,
    coaCode: PROJECT_COA[category],
    tenderId: null,
    projectId: input.projectId,
    amountMinor,
    amount: fromMinorUnits(amountMinor),
  }
}

// ------------------------------------------------------------- PERSETUJUAN

export const BIDDING_APPROVAL_ROLES = ['DIREKTUR', 'FINANCE_MANAGER'] as const
export type ApprovalRole = (typeof BIDDING_APPROVAL_ROLES)[number]
export type ApprovalDecision = 'PENDING' | 'APPROVED' | 'REJECTED'
export type CostApprovalStatus = 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED'

export interface ApprovalLike {
  role: string
  decision: string
}

/** Dua peran wajib: satu menolak = tolak, dua-duanya setuju = setuju. */
export function resolveBiddingApprovalStatus(approvals: readonly ApprovalLike[]): CostApprovalStatus {
  const relevant = approvals.filter((a) =>
    BIDDING_APPROVAL_ROLES.includes(a.role as ApprovalRole),
  )
  if (relevant.some((a) => a.decision === 'REJECTED')) return 'REJECTED'
  const approvedRoles = new Set(
    relevant.filter((a) => a.decision === 'APPROVED').map((a) => a.role),
  )
  if (BIDDING_APPROVAL_ROLES.every((role) => approvedRoles.has(role))) return 'APPROVED'
  return 'PENDING_APPROVAL'
}

export function assertApprovalRole(role: string): ApprovalRole {
  if (!BIDDING_APPROVAL_ROLES.includes(role as ApprovalRole)) {
    throw new BusinessRuleError(
      `Peran "${role}" tidak berhak menyetujui biaya tender.`,
      'INVALID_APPROVAL_ROLE',
    )
  }
  return role as ApprovalRole
}

// ----------------------------------------------------------------- TERMIN

export type TerminMilestone = 'CONTRACT_SIGNED' | 'DRAFT_REPORT' | 'BAST'

export interface TerminSpec {
  sequence: 1 | 2 | 3
  name: string
  milestone: TerminMilestone
  /** batas persentase dalam basis 1/100 persen */
  minBasis: bigint
  maxBasis: bigint
}

export const TERMIN_SPECS: readonly TerminSpec[] = [
  { sequence: 1, name: 'Termin I', milestone: 'CONTRACT_SIGNED', minBasis: 2_000n, maxBasis: 3_000n },
  { sequence: 2, name: 'Termin II', milestone: 'DRAFT_REPORT', minBasis: 4_000n, maxBasis: 5_000n },
  { sequence: 3, name: 'Termin III', milestone: 'BAST', minBasis: 2_000n, maxBasis: 3_000n },
]

export interface TerminPlanItem {
  sequence: 1 | 2 | 3
  name: string
  milestone: TerminMilestone
  percentage: string
  amount: string
  amountMinor: bigint
}

/**
 * Validasi rentang tiap termin lalu turunkan nominalnya dari nilai kontrak.
 * Sisa pembulatan dilempar ke termin terakhir supaya penjumlahan tiga termin
 * persis sama dengan contractValue (tidak boleh selisih walau 1 sen).
 */
export function buildTerminPlan(
  contractValue: MoneyInput,
  percentages: readonly MoneyInput[],
): TerminPlanItem[] {
  if (percentages.length !== TERMIN_SPECS.length) {
    throw new BusinessRuleError(
      `Pembagian termin wajib tepat ${TERMIN_SPECS.length} termin.`,
      'TERMIN_COUNT_INVALID',
    )
  }
  const basisList = percentages.map((p) => toMinorUnits(p))
  basisList.forEach((basis, index) => {
    const spec = TERMIN_SPECS[index]
    if (basis < spec.minBasis || basis > spec.maxBasis) {
      throw new BusinessRuleError(
        `${spec.name} harus antara ${Number(spec.minBasis) / 100}% dan ${Number(spec.maxBasis) / 100}%.`,
        `TERMIN_${spec.sequence}_PERCENTAGE_OUT_OF_RANGE`,
      )
    }
  })
  const total = basisList.reduce((sum, basis) => sum + basis, 0n)
  if (total !== PERCENT_BASIS_TOTAL) {
    throw new BusinessRuleError(
      `Total persentase termin harus tepat 100%, saat ini ${Number(total) / 100}%.`,
      'TERMIN_TOTAL_NOT_100',
    )
  }

  const contractMinor = toMinorUnits(contractValue)
  if (contractMinor <= 0n) {
    throw new BusinessRuleError('Nilai kontrak harus lebih besar dari nol.', 'CONTRACT_VALUE_NOT_POSITIVE')
  }

  let allocated = 0n
  return TERMIN_SPECS.map((spec, index) => {
    const isLast = index === TERMIN_SPECS.length - 1
    const amountMinor = isLast
      ? contractMinor - allocated
      : divideRoundHalfUp(contractMinor * basisList[index], PERCENT_BASIS_TOTAL)
    allocated += amountMinor
    return {
      sequence: spec.sequence,
      name: spec.name,
      milestone: spec.milestone,
      percentage: fromMinorUnits(basisList[index]),
      amount: fromMinorUnits(amountMinor),
      amountMinor,
    }
  })
}

// ---------------------------------------------------------------- INVOICE

export interface InvoiceIssueGate {
  bapVerifiedAt: Date | null | undefined
  milestoneMetAt: Date | null | undefined
}

/** Invoice tidak boleh mendahului verifikasi BAP dan tercapainya milestone. */
export function assertInvoiceIssuable(gate: InvoiceIssueGate): void {
  if (!gate.bapVerifiedAt) {
    throw new BusinessRuleError(
      'Invoice belum boleh terbit: BAP belum terverifikasi.',
      'INVOICE_BAP_NOT_VERIFIED',
    )
  }
  if (!gate.milestoneMetAt) {
    throw new BusinessRuleError(
      'Invoice belum boleh terbit: milestone termin belum tercapai.',
      'INVOICE_MILESTONE_NOT_MET',
    )
  }
}

export interface InvoiceLike {
  amount: MoneyInput
  dueDate: Date
  paidAt?: Date | null
  status?: string
}

/** Waktu selalu di-inject agar deterministik saat dites. */
export function isInvoiceOverdue(invoice: InvoiceLike, now: Date): boolean {
  if (invoice.paidAt) return false
  if (invoice.status === 'CANCELLED') return false
  return now.getTime() > invoice.dueDate.getTime()
}

export function resolveInvoiceStatus(invoice: InvoiceLike, now: Date): string {
  if (invoice.status === 'CANCELLED') return 'CANCELLED'
  if (invoice.paidAt) return 'PAID'
  return isInvoiceOverdue(invoice, now) ? 'OVERDUE' : 'ISSUED'
}

export interface CashFlowSummary {
  billed: string
  paid: string
  outstanding: string
  overdue: string
  overdueCount: number
}

/** Ringkasan arus kas piutang; invoice CANCELLED diabaikan seluruhnya. */
export function summarizeCashFlow(
  invoices: readonly InvoiceLike[],
  now: Date,
): CashFlowSummary {
  let billed = 0n
  let paid = 0n
  let overdue = 0n
  let overdueCount = 0
  for (const invoice of invoices) {
    if (invoice.status === 'CANCELLED') continue
    const amount = toMinorUnits(invoice.amount)
    billed += amount
    if (invoice.paidAt) {
      paid += amount
      continue
    }
    if (isInvoiceOverdue(invoice, now)) {
      overdue += amount
      overdueCount += 1
    }
  }
  return {
    billed: fromMinorUnits(billed),
    paid: fromMinorUnits(paid),
    outstanding: fromMinorUnits(billed - paid),
    overdue: fromMinorUnits(overdue),
    overdueCount,
  }
}

// ------------------------------------------------------- BIAYA & MARGIN HPP

export interface CostLike {
  amount: MoneyInput
  status?: string
}

/** Biaya yang belum disetujui belum jadi HPP, jadi tidak ikut dihitung. */
export const COUNTED_COST_STATUSES = ['APPROVED', 'PAID'] as const

export function calculateDirectCostTotal(costs: readonly CostLike[]): string {
  let total = 0n
  for (const cost of costs) {
    if (!COUNTED_COST_STATUSES.includes(cost.status as (typeof COUNTED_COST_STATUSES)[number])) {
      continue
    }
    total += toMinorUnits(cost.amount)
  }
  return fromMinorUnits(total)
}

export interface ProjectMargin {
  contractValue: string
  directCost: string
  grossProfit: string
  /** persen dengan 2 desimal; null bila nilai kontrak nol (pembagian tak terdefinisi) */
  marginPercentage: string | null
}

export function calculateProjectMargin(
  contractValue: MoneyInput,
  directCostTotal: MoneyInput,
): ProjectMargin {
  const contractMinor = toMinorUnits(contractValue)
  const costMinor = toMinorUnits(directCostTotal)
  const profit = contractMinor - costMinor
  const marginBasis =
    contractMinor === 0n
      ? null
      : divideRoundHalfUp(profit * PERCENT_BASIS_TOTAL, contractMinor)
  return {
    contractValue: fromMinorUnits(contractMinor),
    directCost: fromMinorUnits(costMinor),
    grossProfit: fromMinorUnits(profit),
    marginPercentage: marginBasis === null ? null : fromMinorUnits(marginBasis),
  }
}
