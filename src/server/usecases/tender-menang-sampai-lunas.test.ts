/**
 * SKENARIO 2 — Tender menang sampai proyek lunas dan CSAT terisi.
 *
 * Alur nyata end-to-end: tender WON -> dikonversi jadi Job Order -> kontrak
 * SPK diteken -> rencana termin I/II/III -> biaya Pola 2 keluar -> draft
 * laporan lolos QC -> invoice termin II terbit setelah BAP terverifikasi ->
 * laporan final disetujui -> BAST -> invoice termin III -> CSAT diisi klien.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: {
    tender: { findUnique: vi.fn(), update: vi.fn() },
    project: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    contract: { findMany: vi.fn(), create: vi.fn() },
    costEntry: { create: vi.fn() },
    termin: { findUnique: vi.fn(), findMany: vi.fn(), createManyAndReturn: vi.fn(), update: vi.fn() },
    invoice: { create: vi.fn(), findMany: vi.fn() },
    deliverable: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    labSample: { findMany: vi.fn() },
    bast: { findUnique: vi.fn(), create: vi.fn() },
    csatSurvey: { findUnique: vi.fn(), upsert: vi.fn(), update: vi.fn() },
  },
}))

import { db } from '@/lib/db'
import {
  PROJECT_COA,
  createProjectCost,
  createTerminPlan,
  getProjectCashFlow,
  getProjectCostSummary,
  issueInvoice,
} from '@/server/finance'
import {
  changeDeliverableStatus,
  changeProjectStatus,
  changeTenderStatus,
  convertTenderToProject,
  issueBast,
  recordCsatResponse,
  sendCsatSurvey,
  csatCategory,
} from '@/server/lifecycle'

type Fn = ReturnType<typeof vi.fn>
const mocked = db as unknown as Record<string, Record<string, Fn>>

const at = (iso: string) => new Date(iso)

const CONTRACT_VALUE = '1580000000.00'
const TENDER = {
  id: 'tnd-perluasan-pabrik-baja',
  clientId: 'cli-cipta-karya-baja',
  status: 'SUBMITTED',
  bidValue: CONTRACT_VALUE,
  estimatedValue: '1650000000.00',
  submissionDeadline: at('2026-01-10'),
}
const PROJECT_ID = 'jo-2026-011'
const SIGNED_CONTRACT = { type: 'SPK', signedAt: at('2026-02-20') }

/** State yang berkembang seiring cerita berjalan. */
const ctx: {
  terminIds: string[]
  terminAmounts: string[]
  invoiceNumbers: string[]
} = { terminIds: [], terminAmounts: [], invoiceNumbers: [] }

beforeEach(() => {
  vi.clearAllMocks()
})

describe('Skenario: AMDAL Perluasan Pabrik Baja — dari menang tender sampai pembayaran lunas', () => {
  it('langkah 1 — pengumuman LPSE keluar dan tender berubah dari SUBMITTED menjadi WON', async () => {
    mocked.tender.findUnique.mockResolvedValue(TENDER)
    mocked.tender.update.mockImplementation(async (a: { data: { status: string } }) => ({
      ...TENDER,
      ...a.data,
    }))

    const tender = await changeTenderStatus({
      tenderId: TENDER.id,
      to: 'WON',
      now: at('2026-02-01'),
    })

    expect(tender.status).toBe('WON')
  })

  it('langkah 2 — tender yang menang dikonversi menjadi Job Order dengan nilai kontrak dari bidValue', async () => {
    mocked.tender.findUnique.mockResolvedValue({ ...TENDER, status: 'WON' })
    mocked.project.findUnique.mockResolvedValue(null)
    mocked.project.create.mockImplementation(async (a: { data: unknown }) => ({
      id: PROJECT_ID,
      ...(a.data as object),
    }))

    const project = await convertTenderToProject({
      tenderId: TENDER.id,
      code: 'JO-2026-011',
      name: 'AMDAL Perluasan Pabrik Baja Lembaran Panas — PT Cipta Karya Baja Semesta',
      documentType: 'AMDAL',
      startDate: at('2026-02-20'),
      endDate: at('2026-10-20'),
    })

    expect(project).toMatchObject({
      code: 'JO-2026-011',
      clientId: TENDER.clientId,
      tenderId: TENDER.id,
      documentType: 'AMDAL',
      status: 'PREPARATION',
    })
    // bidValue (penawaran final) dipakai, bukan estimatedValue.
    expect(project.contractValue).toBe(1_580_000_000)
  })

  it('langkah 3 — setelah SPK ditandatangani, proyek boleh berpindah dari PREPARATION ke RUNNING', async () => {
    mocked.project.findUnique.mockResolvedValue({ id: PROJECT_ID, status: 'PREPARATION' })
    mocked.contract.findMany.mockResolvedValue([SIGNED_CONTRACT])
    mocked.bast.findUnique.mockResolvedValue(null)
    mocked.project.update.mockImplementation(async (a: { data: { status: string } }) => ({
      id: PROJECT_ID,
      ...a.data,
    }))

    const project = await changeProjectStatus({ projectId: PROJECT_ID, to: 'RUNNING' })

    expect(project.status).toBe('RUNNING')
  })

  it('langkah 4 — rencana termin I/II/III 25%-50%-25% dibuat dan totalnya persis nilai kontrak', async () => {
    mocked.project.findUnique.mockResolvedValue({
      id: PROJECT_ID,
      contractValue: CONTRACT_VALUE,
      termins: [],
    })
    mocked.termin.createManyAndReturn.mockImplementation(
      async (a: { data: { sequence: number }[] }) =>
        a.data.map((row, index) => ({ id: `termin-${index + 1}`, ...row })),
    )

    const termins = await createTerminPlan({
      projectId: PROJECT_ID,
      percentages: ['25', '50', '25'],
      plannedDates: [at('2026-03-01'), at('2026-07-01'), at('2026-10-25')],
    })

    expect(termins.map((t) => t.milestone)).toEqual([
      'CONTRACT_SIGNED',
      'DRAFT_REPORT',
      'BAST',
    ])
    expect(termins.map((t) => t.amount)).toEqual([
      '395000000.00',
      '790000000.00',
      '395000000.00',
    ])

    ctx.terminIds = termins.map((t) => t.id)
    ctx.terminAmounts = termins.map((t) => String(t.amount))
  })

  it('langkah 5 — biaya Pola 2 (uji lab KAN) dicatat sebagai direct cost Job Order', async () => {
    mocked.project.findUnique.mockResolvedValue({
      id: PROJECT_ID,
      contracts: [SIGNED_CONTRACT],
    })
    mocked.costEntry.create.mockImplementation(async (a: { data: unknown }) => ({
      id: 'cost-lab-kan',
      ...(a.data as object),
    }))

    const cost = await createProjectCost({
      projectId: PROJECT_ID,
      category: 'LAB_TEST_KAN',
      description: 'Uji emisi cerobong dan udara ambien di laboratorium terakreditasi KAN',
      amount: '64200000',
      incurredAt: at('2026-04-10'),
      requestedById: 'usr-andi-prasetyo',
    })

    expect(cost.pattern).toBe('PROJECT')
    expect(cost.tenderId).toBeNull() // Pola 2 tidak pernah menempel ke tender
    expect(cost.projectId).toBe(PROJECT_ID)
    expect(cost.coaCode).toBe(PROJECT_COA.LAB_TEST_KAN)
    expect(cost.coaCode.startsWith('5')).toBe(true) // HPP, bukan beban operasional
  })

  it('langkah 6 — draft laporan lolos QC internal lalu diserahkan ke pemrakarsa', async () => {
    mocked.deliverable.findUnique.mockResolvedValue({
      id: 'dlv-draft-andal',
      status: 'IN_PROGRESS',
      qcPassedAt: null,
    })
    mocked.deliverable.update.mockImplementation(
      async (a: { data: Record<string, unknown> }) => ({ id: 'dlv-draft-andal', ...a.data }),
    )

    const qcReview = await changeDeliverableStatus({
      deliverableId: 'dlv-draft-andal',
      to: 'QC_REVIEW',
      now: at('2026-06-20'),
    })
    expect(qcReview.status).toBe('QC_REVIEW')
    expect(qcReview.qcPassedAt).toEqual(at('2026-06-20'))

    mocked.deliverable.findUnique.mockResolvedValue({
      id: 'dlv-draft-andal',
      status: 'QC_REVIEW',
      qcPassedAt: at('2026-06-20'),
    })

    const submitted = await changeDeliverableStatus({
      deliverableId: 'dlv-draft-andal',
      to: 'SUBMITTED',
      now: at('2026-06-25'),
    })
    expect(submitted.status).toBe('SUBMITTED')
    expect(submitted.submittedAt).toEqual(at('2026-06-25'))
  })

  it('langkah 7 — invoice termin II terbit setelah BAP diverifikasi dan milestone draft laporan tercapai', async () => {
    mocked.termin.findUnique.mockResolvedValue({
      id: ctx.terminIds[1],
      amount: ctx.terminAmounts[1],
      milestoneMetAt: at('2026-06-25'),
      invoice: null,
    })
    mocked.invoice.create.mockImplementation(async (a: { data: unknown }) => ({
      id: 'inv-termin-2',
      ...(a.data as object),
    }))
    mocked.termin.update.mockResolvedValue({})

    const invoice = await issueInvoice({
      terminId: ctx.terminIds[1],
      number: 'INV/2026/0063',
      bapNumber: 'BAP/CKBS/2026/0142-2',
      bapVerifiedAt: at('2026-06-28'),
      issuedAt: at('2026-06-30'),
      dueDate: at('2026-07-30'),
    })

    expect(invoice.status).toBe('ISSUED')
    expect(invoice.amount).toBe('790000000.00')
    // Termin ikut berubah menjadi INVOICED agar tidak tertagih dua kali.
    expect(mocked.termin.update.mock.calls[0][0].data).toEqual({ status: 'INVOICED' })

    ctx.invoiceNumbers.push(invoice.number)
  })

  it('langkah 8 — BAST terbit setelah laporan final berstatus APPROVED', async () => {
    mocked.deliverable.findFirst.mockResolvedValue({
      id: 'dlv-final-andal',
      type: 'FINAL_REPORT',
      status: 'APPROVED',
    })
    mocked.bast.create.mockImplementation(async (a: { data: unknown }) => ({
      id: 'bast-ckbs-011',
      ...(a.data as object),
    }))

    const bast = await issueBast({
      projectId: PROJECT_ID,
      number: 'BAST/CKBS/2026/011',
      signedAt: at('2026-10-10'),
      permitNumber: 'SK.660.1/2026/DLH-BANTEN/0451',
    })

    expect(bast).toMatchObject({
      projectId: PROJECT_ID,
      number: 'BAST/CKBS/2026/011',
      permitNumber: 'SK.660.1/2026/DLH-BANTEN/0451',
    })
  })

  it('langkah 9 — invoice termin III terbit dengan milestone BAST', async () => {
    mocked.termin.findUnique.mockResolvedValue({
      id: ctx.terminIds[2],
      amount: ctx.terminAmounts[2],
      milestoneMetAt: at('2026-10-10'),
      invoice: null,
    })
    mocked.invoice.create.mockImplementation(async (a: { data: unknown }) => ({
      id: 'inv-termin-3',
      ...(a.data as object),
    }))
    mocked.termin.update.mockResolvedValue({})

    const invoice = await issueInvoice({
      terminId: ctx.terminIds[2],
      number: 'INV/2026/0091',
      bapNumber: 'BAP/CKBS/2026/0142-3',
      bapVerifiedAt: at('2026-10-12'),
      issuedAt: at('2026-10-13'),
      dueDate: at('2026-11-12'),
    })

    expect(invoice.amount).toBe('395000000.00')
    ctx.invoiceNumbers.push(invoice.number)
  })

  it('langkah 10 — seluruh termin lunas sehingga arus kas proyek tidak menyisakan piutang', async () => {
    mocked.invoice.findMany.mockResolvedValue([
      { amount: ctx.terminAmounts[0], dueDate: at('2026-04-01'), paidAt: at('2026-03-28'), status: 'PAID' },
      { amount: ctx.terminAmounts[1], dueDate: at('2026-07-30'), paidAt: at('2026-07-25'), status: 'PAID' },
      { amount: ctx.terminAmounts[2], dueDate: at('2026-11-12'), paidAt: at('2026-11-05'), status: 'PAID' },
    ])

    const cashFlow = await getProjectCashFlow(PROJECT_ID, at('2026-11-20'))

    expect(cashFlow.billed).toBe('1580000000.00')
    expect(cashFlow.paid).toBe('1580000000.00')
    expect(cashFlow.outstanding).toBe('0.00')
    expect(cashFlow.overdueCount).toBe(0)
  })

  it('langkah 11 — margin proyek dihitung dari biaya Pola 2 yang sudah disetujui saja', async () => {
    mocked.project.findUnique.mockResolvedValue({
      id: PROJECT_ID,
      code: 'JO-2026-011',
      contractValue: CONTRACT_VALUE,
      costs: [
        { pattern: 'PROJECT', amount: '64200000.00', status: 'APPROVED' },
        { pattern: 'PROJECT', amount: '395800000.00', status: 'PAID' },
        { pattern: 'PROJECT', amount: '25000000.00', status: 'PENDING_APPROVAL' }, // belum jadi HPP
      ],
    })

    const summary = await getProjectCostSummary(PROJECT_ID)

    expect(summary.directCost).toBe('460000000.00')
    expect(summary.grossProfit).toBe('1120000000.00')
    expect(summary.marginPercentage).toBe('70.89')
  })

  it('langkah 12 — survei CSAT dikirim setelah BAST ditandatangani', async () => {
    mocked.bast.findUnique.mockResolvedValue({ signedAt: at('2026-10-10') })
    mocked.csatSurvey.upsert.mockImplementation(async (a: { create: unknown }) => ({
      id: 'csat-011',
      ...(a.create as object),
    }))

    const survey = await sendCsatSurvey({ projectId: PROJECT_ID, now: at('2026-10-15') })

    expect(survey.status).toBe('SENT')
  })

  it('langkah 13 — klien mengisi CSAT dan skor berbobotnya dihitung 35/25/20/20', async () => {
    mocked.csatSurvey.findUnique.mockResolvedValue({ projectId: PROJECT_ID, status: 'SENT' })
    mocked.csatSurvey.update.mockImplementation(async (a: { data: unknown }) => ({
      id: 'csat-011',
      ...(a.data as object),
    }))

    const result = await recordCsatResponse({
      projectId: PROJECT_ID,
      scores: {
        technicalScore: 92,
        timelinessScore: 84,
        responsivenessScore: 90,
        complianceScore: 88,
      },
      comment: 'Dokumen AMDAL lolos sidang komisi tanpa revisi mayor.',
      now: at('2026-10-22'),
    })

    // 92*0,35 + 84*0,25 + 90*0,20 + 88*0,20 = 32,2 + 21 + 18 + 17,6 = 88,8
    expect(result.weightedScore).toBe(88.8)
    expect(result.category).toBe('PUAS')
    expect(csatCategory(result.weightedScore)).toBe('PUAS')
    expect(result.survey.status).toBe('COMPLETED')
  })
})
