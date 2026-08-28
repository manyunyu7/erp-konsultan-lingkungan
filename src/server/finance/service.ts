/**
 * Orkestrasi keuangan: satu-satunya lapisan yang menyentuh database.
 * Semua keputusan bisnis didelegasikan ke `rules.ts` supaya bisa diuji tanpa DB.
 */

import { db } from '@/lib/db'
import { BusinessRuleError } from '@/server/shared/constants'
import {
  assertApprovalRole,
  assertInvoiceIssuable,
  BIDDING_APPROVAL_ROLES,
  buildTerminPlan,
  calculateDirectCostTotal,
  calculateProjectMargin,
  resolveBiddingApprovalStatus,
  summarizeCashFlow,
  validateBiddingCost,
  validateProjectCost,
  type ApprovalDecision,
  type MoneyInput,
} from './rules'

export interface CreateBiddingCostInput {
  tenderId: string
  category: string
  description: string
  amount: MoneyInput
  incurredAt: Date
  requestedById: string
}

/**
 * Pola 1. Approval untuk dua peran dibuat sekaligus dalam status PENDING
 * agar gate dua-peran terlihat eksplisit di data, bukan tersirat di kode.
 */
export async function createBiddingCost(input: CreateBiddingCostInput) {
  const tender = await db.tender.findUnique({ where: { id: input.tenderId } })
  if (!tender) {
    throw new BusinessRuleError(`Tender ${input.tenderId} tidak ditemukan.`, 'TENDER_NOT_FOUND')
  }

  const validated = validateBiddingCost({
    category: input.category,
    tenderId: input.tenderId,
    projectId: null,
    amount: input.amount,
    winRateProbability: tender.winRateProbability,
  })

  return db.costEntry.create({
    data: {
      pattern: validated.pattern,
      tenderId: validated.tenderId,
      projectId: validated.projectId,
      category: validated.category,
      coaCode: validated.coaCode,
      description: input.description,
      amount: validated.amount,
      incurredAt: input.incurredAt,
      requestedById: input.requestedById,
      status: 'PENDING_APPROVAL',
      approvals: {
        create: BIDDING_APPROVAL_ROLES.map((role) => ({
          role,
          decision: 'PENDING',
          approverId: input.requestedById,
        })),
      },
    },
  })
}

export interface DecideBiddingApprovalInput {
  costEntryId: string
  approverId: string
  role: string
  decision: Exclude<ApprovalDecision, 'PENDING'>
  note?: string
  now: Date
}

/** Catat satu keputusan lalu hitung ulang status agregat biaya tender. */
export async function decideBiddingApproval(input: DecideBiddingApprovalInput) {
  const role = assertApprovalRole(input.role)

  const costEntry = await db.costEntry.findUnique({
    where: { id: input.costEntryId },
    include: { approvals: true },
  })
  if (!costEntry) {
    throw new BusinessRuleError(
      `Biaya ${input.costEntryId} tidak ditemukan.`,
      'COST_ENTRY_NOT_FOUND',
    )
  }
  if (costEntry.pattern !== 'BIDDING') {
    throw new BusinessRuleError(
      'Gate dua-peran hanya berlaku untuk biaya tender.',
      'APPROVAL_PATTERN_MISMATCH',
    )
  }

  await db.approval.update({
    where: { costEntryId_role: { costEntryId: input.costEntryId, role } },
    data: { decision: input.decision, note: input.note ?? null, decidedAt: input.now },
  })

  const merged = costEntry.approvals.map((approval) =>
    approval.role === role ? { ...approval, decision: input.decision } : approval,
  )
  const status = resolveBiddingApprovalStatus(merged)

  return db.costEntry.update({
    where: { id: input.costEntryId },
    data: { status },
  })
}

export interface CreateProjectCostInput {
  projectId: string
  category: string
  description: string
  amount: MoneyInput
  incurredAt: Date
  requestedById: string
}

/** Pola 2. Keberadaan kontrak ditandatangani adalah syarat mutlak. */
export async function createProjectCost(input: CreateProjectCostInput) {
  const project = await db.project.findUnique({
    where: { id: input.projectId },
    include: { contracts: true },
  })
  if (!project) {
    throw new BusinessRuleError(`Proyek ${input.projectId} tidak ditemukan.`, 'PROJECT_NOT_FOUND')
  }

  const validated = validateProjectCost({
    category: input.category,
    tenderId: null,
    projectId: input.projectId,
    amount: input.amount,
    hasSignedContract: project.contracts.some((contract) => Boolean(contract.signedAt)),
  })

  return db.costEntry.create({
    data: {
      pattern: validated.pattern,
      tenderId: validated.tenderId,
      projectId: validated.projectId,
      category: validated.category,
      coaCode: validated.coaCode,
      description: input.description,
      amount: validated.amount,
      incurredAt: input.incurredAt,
      requestedById: input.requestedById,
      status: 'PENDING_APPROVAL',
    },
  })
}

/** Total direct cost + margin terhadap nilai kontrak, per Job Order. */
export async function getProjectCostSummary(projectId: string) {
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: { costs: true },
  })
  if (!project) {
    throw new BusinessRuleError(`Proyek ${projectId} tidak ditemukan.`, 'PROJECT_NOT_FOUND')
  }

  const projectCosts = project.costs.filter((cost) => cost.pattern === 'PROJECT')
  const directCost = calculateDirectCostTotal(projectCosts)

  return {
    projectId: project.id,
    jobOrderId: project.code,
    ...calculateProjectMargin(project.contractValue, directCost),
  }
}

export interface CreateTerminPlanInput {
  projectId: string
  percentages: readonly MoneyInput[]
  plannedDates: readonly Date[]
}

/** Rencana termijn dibuat sekali; menimpa rencana lama ditolak agar audit trail utuh. */
export async function createTerminPlan(input: CreateTerminPlanInput) {
  const project = await db.project.findUnique({
    where: { id: input.projectId },
    include: { termins: true },
  })
  if (!project) {
    throw new BusinessRuleError(`Proyek ${input.projectId} tidak ditemukan.`, 'PROJECT_NOT_FOUND')
  }
  if (project.termins.length > 0) {
    throw new BusinessRuleError(
      'Rencana termijn untuk proyek ini sudah ada.',
      'TERMIN_PLAN_ALREADY_EXISTS',
    )
  }
  if (input.plannedDates.length !== input.percentages.length) {
    throw new BusinessRuleError(
      'Jumlah tanggal rencana harus sama dengan jumlah termin.',
      'TERMIN_PLANNED_DATE_COUNT_MISMATCH',
    )
  }

  const plan = buildTerminPlan(project.contractValue, input.percentages)

  return db.termin.createManyAndReturn({
    data: plan.map((item, index) => ({
      projectId: project.id,
      sequence: item.sequence,
      name: item.name,
      percentage: item.percentage,
      amount: item.amount,
      milestone: item.milestone,
      plannedDate: input.plannedDates[index],
    })),
  })
}

export interface IssueInvoiceInput {
  terminId: string
  number: string
  bapNumber: string
  bapVerifiedAt: Date | null
  issuedAt: Date
  dueDate: Date
}

/** Gate ganda: BAP terverifikasi DAN milestone termin tercapai. */
export async function issueInvoice(input: IssueInvoiceInput) {
  const termin = await db.termin.findUnique({
    where: { id: input.terminId },
    include: { invoice: true },
  })
  if (!termin) {
    throw new BusinessRuleError(`Termin ${input.terminId} tidak ditemukan.`, 'TERMIN_NOT_FOUND')
  }
  if (termin.invoice) {
    throw new BusinessRuleError(
      'Termin ini sudah memiliki invoice.',
      'INVOICE_ALREADY_EXISTS',
    )
  }

  assertInvoiceIssuable({
    bapVerifiedAt: input.bapVerifiedAt,
    milestoneMetAt: termin.milestoneMetAt,
  })

  const invoice = await db.invoice.create({
    data: {
      number: input.number,
      terminId: termin.id,
      bapNumber: input.bapNumber,
      bapVerifiedAt: input.bapVerifiedAt,
      amount: termin.amount,
      issuedAt: input.issuedAt,
      dueDate: input.dueDate,
      status: 'ISSUED',
    },
  })

  await db.termin.update({ where: { id: termin.id }, data: { status: 'INVOICED' } })

  return invoice
}

/** Ringkasan arus kas satu proyek; `now` di-inject supaya deterministik. */
export async function getProjectCashFlow(projectId: string, now: Date) {
  const invoices = await db.invoice.findMany({ where: { termin: { projectId } } })
  return { projectId, ...summarizeCashFlow(invoices, now) }
}
