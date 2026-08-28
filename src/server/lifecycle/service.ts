/**
 * Orkestrasi siklus hidup: memuat state dari database, mendelegasikan keputusan
 * ke `rules.ts`, lalu menulis perubahan. Tidak ada aturan bisnis yang
 * ditulis ulang di sini supaya sumber kebenarannya tunggal.
 */

import { db } from '@/lib/db'
import { BusinessRuleError, type ProjectStatus, type TenderStatus } from '@/server/shared/constants'
import {
  assertBastIssuable,
  assertCsatSendable,
  assertDeliverableTransition,
  assertLabSampleTransition,
  assertProjectDates,
  assertProjectTransition,
  assertStagePrerequisites,
  assertTenderTransition,
  buildClosureChecklist,
  buildProjectDraftFromTender,
  calculateCsatScore,
  csatCategory,
  isBindingContract,
  type ClosureChecklist,
  type CsatScores,
  type DeliverableStatus,
  type LabSampleStatus,
  type TechnicalStage,
} from './rules'

/** Decimal Prisma tidak selalu number murni; normalisasi sebelum masuk rules. */
function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null
  return Number(value)
}

function notFound(entity: string, id: string): BusinessRuleError {
  return new BusinessRuleError(`${entity} ${id} tidak ditemukan`, `${entity.toUpperCase()}_NOT_FOUND`)
}

// ------------------------------------------------------------------- TENDER

export async function changeTenderStatus(input: {
  tenderId: string
  to: TenderStatus
  now: Date
}) {
  const tender = await db.tender.findUnique({ where: { id: input.tenderId } })
  if (!tender) throw notFound('TENDER', input.tenderId)

  assertTenderTransition({
    from: tender.status as TenderStatus,
    to: input.to,
    submissionDeadline: tender.submissionDeadline,
    now: input.now,
  })

  return db.tender.update({
    where: { id: input.tenderId },
    data: { status: input.to },
  })
}

export async function convertTenderToProject(input: {
  tenderId: string
  code: string
  name: string
  documentType: string
  startDate: Date
  endDate: Date
}) {
  const tender = await db.tender.findUnique({ where: { id: input.tenderId } })
  if (!tender) throw notFound('TENDER', input.tenderId)

  // Relasi Project.tenderId unik — cegah job order ganda dari satu tender.
  const existing = await db.project.findUnique({ where: { tenderId: input.tenderId } })
  if (existing) {
    throw new BusinessRuleError(
      'Tender ini sudah memiliki proyek turunan',
      'TENDER_ALREADY_CONVERTED',
    )
  }

  const draft = buildProjectDraftFromTender({
    tender: {
      id: tender.id,
      clientId: tender.clientId,
      status: tender.status as TenderStatus,
      bidValue: toNumberOrNull(tender.bidValue),
      estimatedValue: toNumberOrNull(tender.estimatedValue),
    },
    code: input.code,
    name: input.name,
    documentType: input.documentType,
    startDate: input.startDate,
    endDate: input.endDate,
  })

  return db.project.create({ data: draft })
}

// ------------------------------------------------------------------ PROYEK

export async function changeProjectStatus(input: {
  projectId: string
  to: ProjectStatus
}) {
  const project = await db.project.findUnique({ where: { id: input.projectId } })
  if (!project) throw notFound('PROJECT', input.projectId)

  const contracts = await db.contract.findMany({ where: { projectId: input.projectId } })
  const bast = await db.bast.findUnique({ where: { projectId: input.projectId } })

  assertProjectTransition({
    from: project.status as ProjectStatus,
    to: input.to,
    hasSignedContract: contracts.some(isBindingContract),
    hasSignedBast: bast?.signedAt != null,
  })

  return db.project.update({ where: { id: input.projectId }, data: { status: input.to } })
}

export async function rescheduleProject(input: {
  projectId: string
  startDate: Date
  endDate: Date
}) {
  assertProjectDates(input.startDate, input.endDate)
  return db.project.update({
    where: { id: input.projectId },
    data: { startDate: input.startDate, endDate: input.endDate },
  })
}

// ------------------------------------------------------------ TAHAP TEKNIS

/**
 * Kumpulkan tahap yang sudah APPROVED. LAB_TEST tidak punya Deliverable
 * tersendiri di skema, jadi diturunkan dari sampel lab: dianggap selesai bila
 * ada sampel dan semuanya sudah REPORTED.
 */
export async function collectApprovedStages(projectId: string): Promise<TechnicalStage[]> {
  const deliverables = await db.deliverable.findMany({ where: { projectId } })
  const samples = await db.labSample.findMany({ where: { projectId } })

  const approved = deliverables
    .filter((d) => d.status === 'APPROVED')
    .map((d) => d.type as TechnicalStage)

  if (samples.length > 0 && samples.every((s) => s.status === 'REPORTED')) {
    approved.push('LAB_TEST')
  }

  return approved
}

export async function startDeliverableStage(input: { projectId: string; stage: TechnicalStage }) {
  const approvedStages = await collectApprovedStages(input.projectId)
  assertStagePrerequisites({ stage: input.stage, approvedStages })
  return approvedStages
}

export async function changeDeliverableStatus(input: {
  deliverableId: string
  to: DeliverableStatus
  now: Date
}) {
  const deliverable = await db.deliverable.findUnique({ where: { id: input.deliverableId } })
  if (!deliverable) throw notFound('DELIVERABLE', input.deliverableId)

  assertDeliverableTransition({
    from: deliverable.status as DeliverableStatus,
    to: input.to,
    qcPassedAt: deliverable.qcPassedAt,
  })

  // Cap waktu diisi di transisi yang relevan agar audit trail lengkap.
  const data: Record<string, unknown> = { status: input.to }
  if (input.to === 'QC_REVIEW') data.qcPassedAt = input.now
  if (input.to === 'SUBMITTED') data.submittedAt = input.now

  return db.deliverable.update({ where: { id: input.deliverableId }, data })
}

export async function changeLabSampleStatus(input: {
  labSampleId: string
  to: LabSampleStatus
}) {
  const sample = await db.labSample.findUnique({ where: { id: input.labSampleId } })
  if (!sample) throw notFound('LABSAMPLE', input.labSampleId)

  assertLabSampleTransition({
    from: sample.status as LabSampleStatus,
    to: input.to,
    cocNumber: sample.cocNumber,
    laboratory: sample.laboratory,
  })

  return db.labSample.update({ where: { id: input.labSampleId }, data: { status: input.to } })
}

// -------------------------------------------------------- PENUTUPAN & CSAT

export async function issueBast(input: {
  projectId: string
  number: string
  signedAt: Date
  permitNumber?: string
}) {
  const finalReport = await db.deliverable.findFirst({
    where: { projectId: input.projectId, type: 'FINAL_REPORT' },
  })

  assertBastIssuable({
    finalReportStatus: (finalReport?.status as DeliverableStatus | undefined) ?? null,
  })

  return db.bast.create({
    data: {
      projectId: input.projectId,
      number: input.number,
      signedAt: input.signedAt,
      permitNumber: input.permitNumber ?? null,
    },
  })
}

export async function sendCsatSurvey(input: { projectId: string; now: Date }) {
  const bast = await db.bast.findUnique({ where: { projectId: input.projectId } })
  assertCsatSendable({ bastSignedAt: bast?.signedAt ?? null })

  return db.csatSurvey.upsert({
    where: { projectId: input.projectId },
    create: { projectId: input.projectId, status: 'SENT', sentAt: input.now },
    update: { status: 'SENT', sentAt: input.now },
  })
}

export async function recordCsatResponse(input: {
  projectId: string
  scores: CsatScores
  comment?: string
  now: Date
}) {
  const survey = await db.csatSurvey.findUnique({ where: { projectId: input.projectId } })
  if (!survey) throw notFound('CSATSURVEY', input.projectId)

  if (survey.status !== 'SENT') {
    throw new BusinessRuleError(
      'Survei CSAT belum dikirim ke klien',
      'CSAT_NOT_SENT',
    )
  }

  const weightedScore = calculateCsatScore(input.scores)

  const updated = await db.csatSurvey.update({
    where: { projectId: input.projectId },
    data: {
      ...input.scores,
      weightedScore,
      comment: input.comment ?? null,
      respondedAt: input.now,
      status: 'COMPLETED',
    },
  })

  return { survey: updated, weightedScore, category: csatCategory(weightedScore) }
}

export async function getClosureChecklist(input: {
  projectId: string
  performanceBondReturned: boolean
  archive: {
    reports: boolean
    rawSurveyData: boolean
    baselinePhotos: boolean
    gisMaps: boolean
  }
}): Promise<ClosureChecklist> {
  const bast = await db.bast.findUnique({ where: { projectId: input.projectId } })
  const termins = await db.termin.findMany({ where: { projectId: input.projectId } })

  // Termin final = sequence terbesar; lunas bila statusnya PAID.
  const finalTermin = termins.reduce<(typeof termins)[number] | null>(
    (acc, t) => (acc === null || t.sequence > acc.sequence ? t : acc),
    null,
  )

  return buildClosureChecklist({
    bastIssued: bast !== null,
    finalTerminPaid: finalTermin?.status === 'PAID',
    performanceBondReturned: input.performanceBondReturned,
    archive: input.archive,
  })
}
