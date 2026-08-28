import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BusinessRuleError } from '@/server/shared/constants'

// Prisma di-mock penuh: service diuji sebagai orkestrator, bukan lapisan data.
vi.mock('@/lib/db', () => ({
  db: {
    tender: { findUnique: vi.fn(), update: vi.fn() },
    project: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    contract: { findMany: vi.fn() },
    bast: { findUnique: vi.fn(), create: vi.fn() },
    deliverable: { findUnique: vi.fn(), findMany: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    labSample: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    csatSurvey: { findUnique: vi.fn(), upsert: vi.fn(), update: vi.fn() },
    termin: { findMany: vi.fn() },
  },
}))

import { db } from '@/lib/db'
import {
  changeDeliverableStatus,
  changeLabSampleStatus,
  changeProjectStatus,
  changeTenderStatus,
  collectApprovedStages,
  convertTenderToProject,
  getClosureChecklist,
  issueBast,
  recordCsatResponse,
  rescheduleProject,
  sendCsatSurvey,
  startDeliverableStage,
} from './service'

const m = db as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>

const NOW = new Date('2026-03-01T00:00:00Z')

async function errCode(promise: Promise<unknown>): Promise<string> {
  try {
    await promise
  } catch (error) {
    return (error as BusinessRuleError).code
  }
  throw new Error('diharapkan melempar BusinessRuleError')
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('changeTenderStatus', () => {
  it('menyimpan status baru yang sah', async () => {
    m.tender.findUnique.mockResolvedValue({
      id: 't1',
      status: 'PREPARING',
      submissionDeadline: new Date('2026-03-10T00:00:00Z'),
    })
    m.tender.update.mockResolvedValue({ id: 't1', status: 'SUBMITTED' })

    const result = await changeTenderStatus({ tenderId: 't1', to: 'SUBMITTED', now: NOW })

    expect(result.status).toBe('SUBMITTED')
    expect(m.tender.update).toHaveBeenCalledWith({
      where: { id: 't1' },
      data: { status: 'SUBMITTED' },
    })
  })

  it('menolak tender tidak ditemukan', async () => {
    m.tender.findUnique.mockResolvedValue(null)
    expect(await errCode(changeTenderStatus({ tenderId: 'x', to: 'PREPARING', now: NOW }))).toBe(
      'TENDER_NOT_FOUND',
    )
  })

  it('meneruskan pelanggaran aturan dari rules', async () => {
    m.tender.findUnique.mockResolvedValue({
      id: 't1',
      status: 'IDENTIFIED',
      submissionDeadline: new Date('2026-03-10T00:00:00Z'),
    })
    expect(await errCode(changeTenderStatus({ tenderId: 't1', to: 'WON', now: NOW }))).toBe(
      'TENDER_INVALID_TRANSITION',
    )
    expect(m.tender.update).not.toHaveBeenCalled()
  })
})

describe('convertTenderToProject', () => {
  const args = {
    tenderId: 't1',
    code: 'JO-1',
    name: 'AMDAL',
    documentType: 'AMDAL',
    startDate: new Date('2026-04-01T00:00:00Z'),
    endDate: new Date('2026-09-01T00:00:00Z'),
  }

  it('membuat proyek dari tender menang', async () => {
    m.tender.findUnique.mockResolvedValue({
      id: 't1',
      clientId: 'c1',
      status: 'WON',
      bidValue: '500',
      estimatedValue: '600',
    })
    m.project.findUnique.mockResolvedValue(null)
    m.project.create.mockResolvedValue({ id: 'p1' })

    const result = await convertTenderToProject(args)

    expect(result).toEqual({ id: 'p1' })
    expect(m.project.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ tenderId: 't1', clientId: 'c1', contractValue: 500 }),
    })
  })

  it('menormalkan nilai Decimal yang undefined menjadi null', async () => {
    m.tender.findUnique.mockResolvedValue({
      id: 't1',
      clientId: 'c1',
      status: 'WON',
      bidValue: undefined,
      estimatedValue: undefined,
    })
    m.project.findUnique.mockResolvedValue(null)
    expect(await errCode(convertTenderToProject(args))).toBe('TENDER_VALUE_MISSING')
  })

  it('menolak tender tidak ditemukan', async () => {
    m.tender.findUnique.mockResolvedValue(null)
    expect(await errCode(convertTenderToProject(args))).toBe('TENDER_NOT_FOUND')
  })

  it('menolak konversi ganda', async () => {
    m.tender.findUnique.mockResolvedValue({ id: 't1', clientId: 'c1', status: 'WON', bidValue: 1 })
    m.project.findUnique.mockResolvedValue({ id: 'p-lama' })
    expect(await errCode(convertTenderToProject(args))).toBe('TENDER_ALREADY_CONVERTED')
  })
})

describe('changeProjectStatus', () => {
  it('mengizinkan RUNNING bila ada kontrak mengikat', async () => {
    m.project.findUnique.mockResolvedValue({ id: 'p1', status: 'PREPARATION' })
    m.contract.findMany.mockResolvedValue([
      { type: 'ADDENDUM', signedAt: new Date() },
      { type: 'SPK', signedAt: new Date() },
    ])
    m.bast.findUnique.mockResolvedValue(null)
    m.project.update.mockResolvedValue({ id: 'p1', status: 'RUNNING' })

    const result = await changeProjectStatus({ projectId: 'p1', to: 'RUNNING' })
    expect(result.status).toBe('RUNNING')
  })

  it('menolak RUNNING tanpa kontrak', async () => {
    m.project.findUnique.mockResolvedValue({ id: 'p1', status: 'PREPARATION' })
    m.contract.findMany.mockResolvedValue([])
    m.bast.findUnique.mockResolvedValue(null)
    expect(await errCode(changeProjectStatus({ projectId: 'p1', to: 'RUNNING' }))).toBe(
      'PROJECT_CONTRACT_REQUIRED',
    )
  })

  it('menolak CLOSED bila BAST belum ditandatangani', async () => {
    m.project.findUnique.mockResolvedValue({ id: 'p1', status: 'CLOSING' })
    m.contract.findMany.mockResolvedValue([{ type: 'PKS', signedAt: new Date() }])
    m.bast.findUnique.mockResolvedValue({ signedAt: null })
    expect(await errCode(changeProjectStatus({ projectId: 'p1', to: 'CLOSED' }))).toBe(
      'PROJECT_BAST_REQUIRED',
    )
  })

  it('mengizinkan CLOSED dengan BAST tertanda tangan', async () => {
    m.project.findUnique.mockResolvedValue({ id: 'p1', status: 'CLOSING' })
    m.contract.findMany.mockResolvedValue([{ type: 'PKS', signedAt: new Date() }])
    m.bast.findUnique.mockResolvedValue({ signedAt: NOW })
    m.project.update.mockResolvedValue({ id: 'p1', status: 'CLOSED' })

    expect((await changeProjectStatus({ projectId: 'p1', to: 'CLOSED' })).status).toBe('CLOSED')
  })

  it('menolak proyek tidak ditemukan', async () => {
    m.project.findUnique.mockResolvedValue(null)
    expect(await errCode(changeProjectStatus({ projectId: 'x', to: 'RUNNING' }))).toBe(
      'PROJECT_NOT_FOUND',
    )
  })
})

describe('rescheduleProject', () => {
  it('memperbarui jadwal yang valid', async () => {
    m.project.update.mockResolvedValue({ id: 'p1' })
    await rescheduleProject({
      projectId: 'p1',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-02-01'),
    })
    expect(m.project.update).toHaveBeenCalled()
  })

  it('menolak endDate sebelum startDate', async () => {
    expect(
      await errCode(
        rescheduleProject({
          projectId: 'p1',
          startDate: new Date('2026-02-01'),
          endDate: new Date('2026-01-01'),
        }),
      ),
    ).toBe('PROJECT_INVALID_DATE_RANGE')
    expect(m.project.update).not.toHaveBeenCalled()
  })
})

describe('tahapan teknis', () => {
  it('menurunkan LAB_TEST dari sampel yang seluruhnya REPORTED', async () => {
    m.deliverable.findMany.mockResolvedValue([
      { type: 'DESK_STUDY', status: 'APPROVED' },
      { type: 'SAMPLING_PLAN', status: 'APPROVED' },
      { type: 'DRAFT_REPORT', status: 'IN_PROGRESS' },
    ])
    m.labSample.findMany.mockResolvedValue([{ status: 'REPORTED' }, { status: 'REPORTED' }])

    expect(await collectApprovedStages('p1')).toEqual(['DESK_STUDY', 'SAMPLING_PLAN', 'LAB_TEST'])
  })

  it('tidak menganggap LAB_TEST selesai bila ada sampel belum REPORTED', async () => {
    m.deliverable.findMany.mockResolvedValue([])
    m.labSample.findMany.mockResolvedValue([{ status: 'TESTED' }])
    expect(await collectApprovedStages('p1')).toEqual([])
  })

  it('tidak menganggap LAB_TEST selesai bila belum ada sampel sama sekali', async () => {
    m.deliverable.findMany.mockResolvedValue([])
    m.labSample.findMany.mockResolvedValue([])
    expect(await collectApprovedStages('p1')).toEqual([])
  })

  it('mengizinkan memulai tahap dengan prasyarat lengkap', async () => {
    m.deliverable.findMany.mockResolvedValue([
      { type: 'DESK_STUDY', status: 'APPROVED' },
      { type: 'SAMPLING_PLAN', status: 'APPROVED' },
    ])
    m.labSample.findMany.mockResolvedValue([{ status: 'REPORTED' }])

    expect(await startDeliverableStage({ projectId: 'p1', stage: 'DRAFT_REPORT' })).toContain(
      'LAB_TEST',
    )
  })

  it('menolak memulai tahap bila prasyarat belum selesai', async () => {
    m.deliverable.findMany.mockResolvedValue([])
    m.labSample.findMany.mockResolvedValue([])
    expect(
      await errCode(startDeliverableStage({ projectId: 'p1', stage: 'FINAL_REPORT' })),
    ).toBe('STAGE_PREREQUISITE_INCOMPLETE')
  })
})

describe('changeDeliverableStatus', () => {
  it('mengisi qcPassedAt saat masuk QC_REVIEW', async () => {
    m.deliverable.findUnique.mockResolvedValue({ id: 'd1', status: 'IN_PROGRESS', qcPassedAt: null })
    m.deliverable.update.mockResolvedValue({ id: 'd1' })

    await changeDeliverableStatus({ deliverableId: 'd1', to: 'QC_REVIEW', now: NOW })
    expect(m.deliverable.update).toHaveBeenCalledWith({
      where: { id: 'd1' },
      data: { status: 'QC_REVIEW', qcPassedAt: NOW },
    })
  })

  it('mengisi submittedAt saat SUBMITTED', async () => {
    m.deliverable.findUnique.mockResolvedValue({ id: 'd1', status: 'QC_REVIEW', qcPassedAt: NOW })
    m.deliverable.update.mockResolvedValue({ id: 'd1' })

    await changeDeliverableStatus({ deliverableId: 'd1', to: 'SUBMITTED', now: NOW })
    expect(m.deliverable.update).toHaveBeenCalledWith({
      where: { id: 'd1' },
      data: { status: 'SUBMITTED', submittedAt: NOW },
    })
  })

  it('tidak mengisi cap waktu pada transisi lain', async () => {
    m.deliverable.findUnique.mockResolvedValue({ id: 'd1', status: 'SUBMITTED', qcPassedAt: NOW })
    m.deliverable.update.mockResolvedValue({ id: 'd1' })

    await changeDeliverableStatus({ deliverableId: 'd1', to: 'APPROVED', now: NOW })
    expect(m.deliverable.update).toHaveBeenCalledWith({
      where: { id: 'd1' },
      data: { status: 'APPROVED' },
    })
  })

  it('menolak SUBMITTED tanpa QC', async () => {
    m.deliverable.findUnique.mockResolvedValue({ id: 'd1', status: 'QC_REVIEW', qcPassedAt: null })
    expect(
      await errCode(changeDeliverableStatus({ deliverableId: 'd1', to: 'SUBMITTED', now: NOW })),
    ).toBe('DELIVERABLE_QC_REQUIRED')
  })

  it('menolak deliverable tidak ditemukan', async () => {
    m.deliverable.findUnique.mockResolvedValue(null)
    expect(
      await errCode(changeDeliverableStatus({ deliverableId: 'x', to: 'IN_PROGRESS', now: NOW })),
    ).toBe('DELIVERABLE_NOT_FOUND')
  })
})

describe('changeLabSampleStatus', () => {
  it('mengirim sampel dengan CoC valid', async () => {
    m.labSample.findUnique.mockResolvedValue({
      id: 's1',
      status: 'COLLECTED',
      cocNumber: 'COC-1',
      laboratory: 'Sucofindo',
    })
    m.labSample.update.mockResolvedValue({ id: 's1', status: 'SENT' })

    expect((await changeLabSampleStatus({ labSampleId: 's1', to: 'SENT' })).status).toBe('SENT')
  })

  it('menolak pengiriman tanpa CoC', async () => {
    m.labSample.findUnique.mockResolvedValue({
      id: 's1',
      status: 'COLLECTED',
      cocNumber: null,
      laboratory: 'Sucofindo',
    })
    expect(await errCode(changeLabSampleStatus({ labSampleId: 's1', to: 'SENT' }))).toBe(
      'LAB_SAMPLE_COC_REQUIRED',
    )
  })

  it('menolak sampel tidak ditemukan', async () => {
    m.labSample.findUnique.mockResolvedValue(null)
    expect(await errCode(changeLabSampleStatus({ labSampleId: 'x', to: 'SENT' }))).toBe(
      'LABSAMPLE_NOT_FOUND',
    )
  })
})

describe('issueBast', () => {
  it('menerbitkan BAST setelah FINAL_REPORT APPROVED', async () => {
    m.deliverable.findFirst.mockResolvedValue({ status: 'APPROVED' })
    m.bast.create.mockResolvedValue({ id: 'b1' })

    await issueBast({ projectId: 'p1', number: 'BAST-1', signedAt: NOW, permitNumber: 'PL-9' })
    expect(m.bast.create).toHaveBeenCalledWith({
      data: { projectId: 'p1', number: 'BAST-1', signedAt: NOW, permitNumber: 'PL-9' },
    })
  })

  it('menormalkan permitNumber kosong menjadi null', async () => {
    m.deliverable.findFirst.mockResolvedValue({ status: 'APPROVED' })
    m.bast.create.mockResolvedValue({ id: 'b1' })

    await issueBast({ projectId: 'p1', number: 'BAST-1', signedAt: NOW })
    expect(m.bast.create).toHaveBeenCalledWith({
      data: { projectId: 'p1', number: 'BAST-1', signedAt: NOW, permitNumber: null },
    })
  })

  it('menolak bila FINAL_REPORT belum ada', async () => {
    m.deliverable.findFirst.mockResolvedValue(null)
    expect(
      await errCode(issueBast({ projectId: 'p1', number: 'BAST-1', signedAt: NOW })),
    ).toBe('BAST_FINAL_REPORT_REQUIRED')
  })

  it('menolak bila FINAL_REPORT belum APPROVED', async () => {
    m.deliverable.findFirst.mockResolvedValue({ status: 'SUBMITTED' })
    expect(
      await errCode(issueBast({ projectId: 'p1', number: 'BAST-1', signedAt: NOW })),
    ).toBe('BAST_FINAL_REPORT_REQUIRED')
  })
})

describe('CSAT', () => {
  it('mengirim survei setelah BAST ditandatangani', async () => {
    m.bast.findUnique.mockResolvedValue({ signedAt: NOW })
    m.csatSurvey.upsert.mockResolvedValue({ id: 'cs1', status: 'SENT' })

    expect((await sendCsatSurvey({ projectId: 'p1', now: NOW })).status).toBe('SENT')
  })

  it('menolak pengiriman bila BAST belum ada', async () => {
    m.bast.findUnique.mockResolvedValue(null)
    expect(await errCode(sendCsatSurvey({ projectId: 'p1', now: NOW }))).toBe('CSAT_BAST_REQUIRED')
  })

  it('menolak pengiriman bila BAST belum ditandatangani', async () => {
    m.bast.findUnique.mockResolvedValue({ signedAt: null })
    expect(await errCode(sendCsatSurvey({ projectId: 'p1', now: NOW }))).toBe('CSAT_BAST_REQUIRED')
  })

  const scores = {
    technicalScore: 90,
    timelinessScore: 80,
    responsivenessScore: 70,
    complianceScore: 85,
  }

  it('menyimpan jawaban dan mengembalikan kategori', async () => {
    m.csatSurvey.findUnique.mockResolvedValue({ status: 'SENT' })
    m.csatSurvey.update.mockResolvedValue({ id: 'cs1' })

    const result = await recordCsatResponse({
      projectId: 'p1',
      scores,
      comment: 'Baik',
      now: NOW,
    })

    expect(result.weightedScore).toBe(82.5)
    expect(result.category).toBe('PUAS')
    expect(m.csatSurvey.update).toHaveBeenCalledWith({
      where: { projectId: 'p1' },
      data: expect.objectContaining({
        weightedScore: 82.5,
        comment: 'Baik',
        status: 'COMPLETED',
        respondedAt: NOW,
      }),
    })
  })

  it('menormalkan komentar kosong menjadi null', async () => {
    m.csatSurvey.findUnique.mockResolvedValue({ status: 'SENT' })
    m.csatSurvey.update.mockResolvedValue({ id: 'cs1' })

    await recordCsatResponse({ projectId: 'p1', scores, now: NOW })
    expect(m.csatSurvey.update).toHaveBeenCalledWith({
      where: { projectId: 'p1' },
      data: expect.objectContaining({ comment: null }),
    })
  })

  it('menolak bila survei belum dibuat', async () => {
    m.csatSurvey.findUnique.mockResolvedValue(null)
    expect(await errCode(recordCsatResponse({ projectId: 'p1', scores, now: NOW }))).toBe(
      'CSATSURVEY_NOT_FOUND',
    )
  })

  it('menolak bila survei belum dikirim', async () => {
    m.csatSurvey.findUnique.mockResolvedValue({ status: 'PENDING' })
    expect(await errCode(recordCsatResponse({ projectId: 'p1', scores, now: NOW }))).toBe(
      'CSAT_NOT_SENT',
    )
  })
})

describe('getClosureChecklist', () => {
  const archive = {
    reports: true,
    rawSurveyData: true,
    baselinePhotos: true,
    gisMaps: true,
  }

  it('lengkap bila BAST ada dan termin terakhir lunas', async () => {
    m.bast.findUnique.mockResolvedValue({ id: 'b1' })
    m.termin.findMany.mockResolvedValue([
      { sequence: 1, status: 'PAID' },
      { sequence: 3, status: 'PAID' },
      { sequence: 2, status: 'PAID' },
    ])

    const result = await getClosureChecklist({
      projectId: 'p1',
      performanceBondReturned: true,
      archive,
    })
    expect(result.complete).toBe(true)
  })

  it('belum lengkap bila termin terakhir belum lunas dan BAST belum terbit', async () => {
    m.bast.findUnique.mockResolvedValue(null)
    m.termin.findMany.mockResolvedValue([
      { sequence: 1, status: 'PAID' },
      { sequence: 2, status: 'INVOICED' },
    ])

    const result = await getClosureChecklist({
      projectId: 'p1',
      performanceBondReturned: false,
      archive,
    })
    expect(result.complete).toBe(false)
    expect(result.items[0].fulfilled).toBe(false)
    expect(result.items[1].fulfilled).toBe(false)
  })

  it('menangani proyek tanpa termin sama sekali', async () => {
    m.bast.findUnique.mockResolvedValue({ id: 'b1' })
    m.termin.findMany.mockResolvedValue([])

    const result = await getClosureChecklist({
      projectId: 'p1',
      performanceBondReturned: true,
      archive,
    })
    expect(result.items[1].fulfilled).toBe(false)
  })
})

describe('helper pengujian service', () => {
  it('gagal bila promise tidak menolak', async () => {
    await expect(errCode(Promise.resolve(1))).rejects.toThrow(
      'diharapkan melempar BusinessRuleError',
    )
  })
})
