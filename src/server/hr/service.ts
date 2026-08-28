/**
 * Orkestrasi HR: mengambil data lewat Prisma lalu menerapkan aturan murni
 * dari `rules.ts`. Tidak ada aturan bisnis baru yang ditulis di sini.
 */

import { db } from '@/lib/db'
import { BusinessRuleError } from '@/server/shared/constants'
import {
  assertAssignmentEligibility,
  assertManpowerTransition,
  daysUntilExpiry,
  isExpiryWarning,
  selectionStagesFor,
  validateKpiEvaluation,
  validateManpowerRequestForm,
  type EmploymentType,
  type KpiPeriodType,
  type KpiScores,
  type ManpowerRequestFormInput,
  type ManpowerRequestStatus,
} from './rules'

export interface CreateKpiEvaluationInput extends KpiScores {
  personnelId: string
  periodType: KpiPeriodType
  periodYear?: number | null
  projectId?: string | null
  note?: string | null
  evaluatedAt: Date
}

/** Buat evaluasi KPI. employmentType diambil dari DB, bukan dari input klien. */
export async function createKpiEvaluation(input: CreateKpiEvaluationInput) {
  const personnel = await db.personnel.findUnique({ where: { id: input.personnelId } })
  if (!personnel) {
    throw new BusinessRuleError('Personel tidak ditemukan', 'PERSONNEL_NOT_FOUND')
  }
  if (!personnel.isActive) {
    throw new BusinessRuleError('Personel non-aktif tidak dapat dievaluasi', 'PERSONNEL_INACTIVE')
  }

  const { totalScore, predicate } = validateKpiEvaluation({
    personnelId: input.personnelId,
    employmentType: personnel.employmentType as EmploymentType,
    periodType: input.periodType,
    periodYear: input.periodYear,
    projectId: input.projectId,
    punctualityScore: input.punctualityScore,
    qualityScore: input.qualityScore,
    teamworkScore: input.teamworkScore,
  })

  const evaluation = await db.kpiEvaluation.create({
    data: {
      personnelId: input.personnelId,
      projectId: input.projectId ?? null,
      periodType: input.periodType,
      periodYear: input.periodYear ?? null,
      punctualityScore: input.punctualityScore,
      qualityScore: input.qualityScore,
      teamworkScore: input.teamworkScore,
      totalScore,
      note: input.note ?? null,
      evaluatedAt: input.evaluatedAt,
    },
  })

  return { ...evaluation, predicate }
}

export interface AssignPersonnelInput {
  projectId: string
  personnelId: string
  role: string
  startDate: Date
  endDate?: Date | null
}

/** Penugasan hanya boleh terjadi bila sertifikat wajib aktif di tanggal mulai. */
export async function assignPersonnelToProject(input: AssignPersonnelInput) {
  const [project, personnel] = await Promise.all([
    db.project.findUnique({ where: { id: input.projectId } }),
    db.personnel.findUnique({ where: { id: input.personnelId } }),
  ])
  if (!project) throw new BusinessRuleError('Proyek tidak ditemukan', 'PROJECT_NOT_FOUND')
  if (!personnel) throw new BusinessRuleError('Personel tidak ditemukan', 'PERSONNEL_NOT_FOUND')
  if (!personnel.isActive) {
    throw new BusinessRuleError('Personel non-aktif tidak dapat ditugaskan', 'PERSONNEL_INACTIVE')
  }

  const certifications = await db.certification.findMany({
    where: { personnelId: input.personnelId },
  })
  assertAssignmentEligibility(certifications, project.documentType, input.startDate)

  return db.assignment.create({
    data: {
      projectId: input.projectId,
      personnelId: input.personnelId,
      role: input.role,
      startDate: input.startDate,
      endDate: input.endDate ?? null,
    },
  })
}

interface ExpiringCertificationRow {
  id: string
  name: string
  personnelId: string
  expiresAt: Date
}

/** Daftar sertifikat yang masuk ambang peringatan H-60 pada `now`. */
export async function listExpiringCertifications(now: Date) {
  // Tipe eksplisit: Prisma client di-generate saat build sehingga inferensi
  // tidak selalu tersedia di lingkungan pengujian.
  const certifications: ExpiringCertificationRow[] = await db.certification.findMany({
    include: { personnel: true },
  })
  return certifications
    .filter((c) => isExpiryWarning(c.expiresAt, now))
    .map((c) => ({
      id: c.id,
      name: c.name,
      personnelId: c.personnelId,
      expiresAt: c.expiresAt,
      daysRemaining: daysUntilExpiry(c.expiresAt, now),
    }))
    .sort((a: { daysRemaining: number }, b: { daysRemaining: number }) => a.daysRemaining - b.daysRemaining)
}

export interface CreateManpowerRequestInput extends ManpowerRequestFormInput {
  formNumber: string
  requestedById: string
}

export async function createManpowerRequest(input: CreateManpowerRequestInput, now: Date) {
  validateManpowerRequestForm(input, now)

  const existing = await db.manpowerRequest.findUnique({ where: { formNumber: input.formNumber } })
  if (existing) {
    throw new BusinessRuleError('Nomor form F-HR-01 sudah dipakai', 'MANPOWER_DUPLICATE_FORM_NUMBER')
  }

  const request = await db.manpowerRequest.create({
    data: {
      formNumber: input.formNumber,
      requestedById: input.requestedById,
      position: input.position,
      employmentType: input.employmentType,
      qualification: input.qualification,
      certifications: input.certifications,
      quantity: input.quantity,
      neededBy: input.neededBy,
      status: 'SUBMITTED',
    },
  })

  return { ...request, selectionStages: selectionStagesFor(input.employmentType) }
}

export async function transitionManpowerRequest(id: string, to: ManpowerRequestStatus) {
  const request = await db.manpowerRequest.findUnique({ where: { id } })
  if (!request) {
    throw new BusinessRuleError('Form kebutuhan personel tidak ditemukan', 'MANPOWER_REQUEST_NOT_FOUND')
  }
  assertManpowerTransition(request.status as ManpowerRequestStatus, to)
  return db.manpowerRequest.update({ where: { id }, data: { status: to } })
}

/** Tahapan seleksi untuk satu form; dipakai UI rekrutmen. */
export async function getSelectionStages(requestId: string) {
  const request = await db.manpowerRequest.findUnique({ where: { id: requestId } })
  if (!request) {
    throw new BusinessRuleError('Form kebutuhan personel tidak ditemukan', 'MANPOWER_REQUEST_NOT_FOUND')
  }
  return selectionStagesFor(request.employmentType as EmploymentType)
}
