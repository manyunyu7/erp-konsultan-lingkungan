import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: {
    tender: { findUnique: vi.fn() },
    project: { findUnique: vi.fn() },
    costEntry: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    approval: { update: vi.fn() },
    termin: { findUnique: vi.fn(), createManyAndReturn: vi.fn(), update: vi.fn() },
    invoice: { create: vi.fn(), findMany: vi.fn() },
  },
}))

import { db } from '@/lib/db'
import {
  createBiddingCost,
  createProjectCost,
  createTerminPlan,
  decideBiddingApproval,
  getProjectCashFlow,
  getProjectCostSummary,
  issueInvoice,
} from './service'

const mocked = db as unknown as {
  tender: { findUnique: ReturnType<typeof vi.fn> }
  project: { findUnique: ReturnType<typeof vi.fn> }
  costEntry: {
    findUnique: ReturnType<typeof vi.fn>
    create: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
  }
  approval: { update: ReturnType<typeof vi.fn> }
  termin: {
    findUnique: ReturnType<typeof vi.fn>
    createManyAndReturn: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
  }
  invoice: { create: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> }
}

const at = (iso: string) => new Date(iso)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('createBiddingCost', () => {
  const input = {
    tenderId: 'tender-1',
    category: 'TENDER_DOCUMENT',
    description: 'Pembelian dokumen tender',
    amount: '750000',
    incurredAt: at('2026-02-01'),
    requestedById: 'user-1',
  }

  it('membuat biaya tender beserta dua approval PENDING', async () => {
    mocked.tender.findUnique.mockResolvedValue({ id: 'tender-1', winRateProbability: 80 })
    mocked.costEntry.create.mockResolvedValue({ id: 'cost-1' })

    const result = await createBiddingCost(input)

    expect(result).toEqual({ id: 'cost-1' })
    const data = mocked.costEntry.create.mock.calls[0][0].data
    expect(data).toMatchObject({
      pattern: 'BIDDING',
      coaCode: '6101',
      projectId: null,
      tenderId: 'tender-1',
      amount: '750000.00',
      status: 'PENDING_APPROVAL',
    })
    expect(data.approvals.create).toEqual([
      { role: 'DIREKTUR', decision: 'PENDING', approverId: 'user-1' },
      { role: 'FINANCE_MANAGER', decision: 'PENDING', approverId: 'user-1' },
    ])
  })

  it('menolak bila tender tidak ada', async () => {
    mocked.tender.findUnique.mockResolvedValue(null)
    await expect(createBiddingCost(input)).rejects.toThrowError(
      expect.objectContaining({ code: 'TENDER_NOT_FOUND' }),
    )
  })

  it('menolak bila win rate di bawah 60', async () => {
    mocked.tender.findUnique.mockResolvedValue({ id: 'tender-1', winRateProbability: 40 })
    await expect(createBiddingCost(input)).rejects.toThrowError(
      expect.objectContaining({ code: 'WIN_RATE_BELOW_THRESHOLD' }),
    )
    expect(mocked.costEntry.create).not.toHaveBeenCalled()
  })
})

describe('decideBiddingApproval', () => {
  const base = {
    costEntryId: 'cost-1',
    approverId: 'user-2',
    role: 'FINANCE_MANAGER',
    decision: 'APPROVED' as const,
    now: at('2026-02-05'),
  }

  it('menyimpan keputusan dan menaikkan status jadi APPROVED', async () => {
    mocked.costEntry.findUnique.mockResolvedValue({
      id: 'cost-1',
      pattern: 'BIDDING',
      approvals: [
        { role: 'DIREKTUR', decision: 'APPROVED' },
        { role: 'FINANCE_MANAGER', decision: 'PENDING' },
      ],
    })
    mocked.costEntry.update.mockResolvedValue({ id: 'cost-1', status: 'APPROVED' })

    const result = await decideBiddingApproval({ ...base, note: 'ok' })

    expect(mocked.approval.update).toHaveBeenCalledWith({
      where: { costEntryId_role: { costEntryId: 'cost-1', role: 'FINANCE_MANAGER' } },
      data: { decision: 'APPROVED', note: 'ok', decidedAt: base.now },
    })
    expect(mocked.costEntry.update).toHaveBeenCalledWith({
      where: { id: 'cost-1' },
      data: { status: 'APPROVED' },
    })
    expect(result).toEqual({ id: 'cost-1', status: 'APPROVED' })
  })

  it('menormalkan note kosong jadi null dan tetap PENDING_APPROVAL', async () => {
    mocked.costEntry.findUnique.mockResolvedValue({
      id: 'cost-1',
      pattern: 'BIDDING',
      approvals: [
        { role: 'DIREKTUR', decision: 'PENDING' },
        { role: 'FINANCE_MANAGER', decision: 'PENDING' },
      ],
    })
    mocked.costEntry.update.mockResolvedValue({ id: 'cost-1' })

    await decideBiddingApproval(base)

    expect(mocked.approval.update.mock.calls[0][0].data.note).toBeNull()
    expect(mocked.costEntry.update.mock.calls[0][0].data.status).toBe('PENDING_APPROVAL')
  })

  it('menolak peran yang tidak berwenang', async () => {
    await expect(decideBiddingApproval({ ...base, role: 'STAFF' })).rejects.toThrowError(
      expect.objectContaining({ code: 'INVALID_APPROVAL_ROLE' }),
    )
  })

  it('menolak bila biaya tidak ditemukan', async () => {
    mocked.costEntry.findUnique.mockResolvedValue(null)
    await expect(decideBiddingApproval(base)).rejects.toThrowError(
      expect.objectContaining({ code: 'COST_ENTRY_NOT_FOUND' }),
    )
  })

  it('menolak biaya berpola PROJECT', async () => {
    mocked.costEntry.findUnique.mockResolvedValue({ id: 'cost-1', pattern: 'PROJECT', approvals: [] })
    await expect(decideBiddingApproval(base)).rejects.toThrowError(
      expect.objectContaining({ code: 'APPROVAL_PATTERN_MISMATCH' }),
    )
  })
})

describe('createProjectCost', () => {
  const input = {
    projectId: 'proj-1',
    category: 'EXPERT_HONORARIUM',
    description: 'Honorarium ahli biologi',
    amount: '15000000',
    incurredAt: at('2026-02-10'),
    requestedById: 'user-3',
  }

  it('membuat direct cost bila kontrak sudah diteken', async () => {
    mocked.project.findUnique.mockResolvedValue({
      id: 'proj-1',
      contracts: [{ signedAt: at('2026-01-05') }],
    })
    mocked.costEntry.create.mockResolvedValue({ id: 'cost-9' })

    const result = await createProjectCost(input)

    expect(result).toEqual({ id: 'cost-9' })
    expect(mocked.costEntry.create.mock.calls[0][0].data).toMatchObject({
      pattern: 'PROJECT',
      coaCode: '5101',
      tenderId: null,
      projectId: 'proj-1',
      amount: '15000000.00',
    })
  })

  it('menolak bila proyek tidak ada', async () => {
    mocked.project.findUnique.mockResolvedValue(null)
    await expect(createProjectCost(input)).rejects.toThrowError(
      expect.objectContaining({ code: 'PROJECT_NOT_FOUND' }),
    )
  })

  it('menolak bila belum ada kontrak yang ditandatangani', async () => {
    mocked.project.findUnique.mockResolvedValue({ id: 'proj-1', contracts: [] })
    await expect(createProjectCost(input)).rejects.toThrowError(
      expect.objectContaining({ code: 'PROJECT_COST_REQUIRES_SIGNED_CONTRACT' }),
    )
  })
})

describe('getProjectCostSummary', () => {
  it('menjumlah hanya biaya pola PROJECT yang disetujui', async () => {
    mocked.project.findUnique.mockResolvedValue({
      id: 'proj-1',
      code: 'JO-2026-001',
      contractValue: '1000000',
      costs: [
        { pattern: 'PROJECT', amount: '200000', status: 'APPROVED' },
        { pattern: 'PROJECT', amount: '50000', status: 'PENDING_APPROVAL' },
        { pattern: 'BIDDING', amount: '900000', status: 'PAID' },
      ],
    })

    await expect(getProjectCostSummary('proj-1')).resolves.toEqual({
      projectId: 'proj-1',
      jobOrderId: 'JO-2026-001',
      contractValue: '1000000.00',
      directCost: '200000.00',
      grossProfit: '800000.00',
      marginPercentage: '80.00',
    })
  })

  it('menolak bila proyek tidak ada', async () => {
    mocked.project.findUnique.mockResolvedValue(null)
    await expect(getProjectCostSummary('x')).rejects.toThrowError(
      expect.objectContaining({ code: 'PROJECT_NOT_FOUND' }),
    )
  })
})

describe('createTerminPlan', () => {
  const dates = [at('2026-01-10'), at('2026-03-10'), at('2026-06-10')]

  it('membuat tiga termin sesuai persentase', async () => {
    mocked.project.findUnique.mockResolvedValue({
      id: 'proj-1',
      contractValue: '500000000',
      termins: [],
    })
    mocked.termin.createManyAndReturn.mockResolvedValue([{ id: 't1' }])

    const result = await createTerminPlan({
      projectId: 'proj-1',
      percentages: ['20', '50', '30'],
      plannedDates: dates,
    })

    expect(result).toEqual([{ id: 't1' }])
    expect(mocked.termin.createManyAndReturn.mock.calls[0][0].data).toEqual([
      { projectId: 'proj-1', sequence: 1, name: 'Termin I', percentage: '20.00', amount: '100000000.00', milestone: 'CONTRACT_SIGNED', plannedDate: dates[0] },
      { projectId: 'proj-1', sequence: 2, name: 'Termin II', percentage: '50.00', amount: '250000000.00', milestone: 'DRAFT_REPORT', plannedDate: dates[1] },
      { projectId: 'proj-1', sequence: 3, name: 'Termin III', percentage: '30.00', amount: '150000000.00', milestone: 'BAST', plannedDate: dates[2] },
    ])
  })

  it('menolak bila proyek tidak ada', async () => {
    mocked.project.findUnique.mockResolvedValue(null)
    await expect(
      createTerminPlan({ projectId: 'x', percentages: ['20', '50', '30'], plannedDates: dates }),
    ).rejects.toThrowError(expect.objectContaining({ code: 'PROJECT_NOT_FOUND' }))
  })

  it('menolak bila rencana termijn sudah ada', async () => {
    mocked.project.findUnique.mockResolvedValue({
      id: 'proj-1',
      contractValue: '1000',
      termins: [{ id: 't1' }],
    })
    await expect(
      createTerminPlan({ projectId: 'proj-1', percentages: ['20', '50', '30'], plannedDates: dates }),
    ).rejects.toThrowError(expect.objectContaining({ code: 'TERMIN_PLAN_ALREADY_EXISTS' }))
  })

  it('menolak bila jumlah tanggal tidak cocok', async () => {
    mocked.project.findUnique.mockResolvedValue({ id: 'proj-1', contractValue: '1000', termins: [] })
    await expect(
      createTerminPlan({ projectId: 'proj-1', percentages: ['20', '50', '30'], plannedDates: [dates[0]] }),
    ).rejects.toThrowError(
      expect.objectContaining({ code: 'TERMIN_PLANNED_DATE_COUNT_MISMATCH' }),
    )
  })
})

describe('issueInvoice', () => {
  const input = {
    terminId: 'termin-1',
    number: 'INV/2026/001',
    bapNumber: 'BAP/2026/001',
    bapVerifiedAt: at('2026-03-01'),
    issuedAt: at('2026-03-02'),
    dueDate: at('2026-04-01'),
  }

  it('menerbitkan invoice dan menandai termin INVOICED', async () => {
    mocked.termin.findUnique.mockResolvedValue({
      id: 'termin-1',
      amount: '250000000',
      milestoneMetAt: at('2026-02-28'),
      invoice: null,
    })
    mocked.invoice.create.mockResolvedValue({ id: 'inv-1' })

    const result = await issueInvoice(input)

    expect(result).toEqual({ id: 'inv-1' })
    expect(mocked.invoice.create.mock.calls[0][0].data).toMatchObject({
      number: 'INV/2026/001',
      terminId: 'termin-1',
      amount: '250000000',
      status: 'ISSUED',
    })
    expect(mocked.termin.update).toHaveBeenCalledWith({
      where: { id: 'termin-1' },
      data: { status: 'INVOICED' },
    })
  })

  it('menolak bila termin tidak ada', async () => {
    mocked.termin.findUnique.mockResolvedValue(null)
    await expect(issueInvoice(input)).rejects.toThrowError(
      expect.objectContaining({ code: 'TERMIN_NOT_FOUND' }),
    )
  })

  it('menolak bila invoice sudah pernah terbit', async () => {
    mocked.termin.findUnique.mockResolvedValue({ id: 'termin-1', invoice: { id: 'inv-0' } })
    await expect(issueInvoice(input)).rejects.toThrowError(
      expect.objectContaining({ code: 'INVOICE_ALREADY_EXISTS' }),
    )
  })

  it('menolak bila BAP belum terverifikasi', async () => {
    mocked.termin.findUnique.mockResolvedValue({
      id: 'termin-1',
      milestoneMetAt: at('2026-02-28'),
      invoice: null,
    })
    await expect(issueInvoice({ ...input, bapVerifiedAt: null })).rejects.toThrowError(
      expect.objectContaining({ code: 'INVOICE_BAP_NOT_VERIFIED' }),
    )
    expect(mocked.invoice.create).not.toHaveBeenCalled()
  })

  it('menolak bila milestone belum tercapai', async () => {
    mocked.termin.findUnique.mockResolvedValue({
      id: 'termin-1',
      milestoneMetAt: null,
      invoice: null,
    })
    await expect(issueInvoice(input)).rejects.toThrowError(
      expect.objectContaining({ code: 'INVOICE_MILESTONE_NOT_MET' }),
    )
  })
})

describe('getProjectCashFlow', () => {
  it('meringkas invoice proyek pada tanggal acuan yang di-inject', async () => {
    mocked.invoice.findMany.mockResolvedValue([
      { amount: '1000', dueDate: at('2026-02-01'), paidAt: at('2026-02-02') },
      { amount: '3000', dueDate: at('2026-03-01'), paidAt: null },
    ])

    await expect(getProjectCashFlow('proj-1', at('2026-03-15'))).resolves.toEqual({
      projectId: 'proj-1',
      billed: '4000.00',
      paid: '1000.00',
      outstanding: '3000.00',
      overdue: '3000.00',
      overdueCount: 1,
    })
    expect(mocked.invoice.findMany).toHaveBeenCalledWith({
      where: { termin: { projectId: 'proj-1' } },
    })
  })
})
