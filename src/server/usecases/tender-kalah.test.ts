/**
 * SKENARIO 1 — Tender kalah, biaya Pola 1 hangus.
 *
 * Alur nyata: staf pemasaran mengeluarkan biaya dokumen tender, Direktur dan
 * Finance Manager menyetujui, lalu pengumuman keluar dan perusahaan KALAH.
 * Yang harus dibuktikan: biaya tetap tercatat sebagai beban operasional
 * (COA 6-xxx) dan TIDAK pernah menempel ke proyek manapun sebagai HPP.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: {
    tender: { findUnique: vi.fn(), update: vi.fn() },
    project: { findUnique: vi.fn() },
    costEntry: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), findMany: vi.fn() },
    approval: { update: vi.fn() },
  },
}))

import { db } from '@/lib/db'
import { BusinessRuleError } from '@/server/shared/constants'
import {
  BIDDING_COA,
  calculateDirectCostTotal,
  createBiddingCost,
  decideBiddingApproval,
  getProjectCostSummary,
  validateBiddingCost,
} from '@/server/finance'
import { changeTenderStatus } from '@/server/lifecycle'

type Fn = ReturnType<typeof vi.fn>
const mocked = db as unknown as {
  tender: { findUnique: Fn; update: Fn }
  project: { findUnique: Fn }
  costEntry: { findUnique: Fn; create: Fn; update: Fn; findMany: Fn }
  approval: { update: Fn }
}

const at = (iso: string) => new Date(iso)

const TENDER = {
  id: 'tnd-tol-lingkar-selatan',
  clientId: 'cli-dlh-bandung',
  status: 'SUBMITTED',
  winRateProbability: 62,
  submissionDeadline: at('2026-05-01'),
}

const DIREKTUR_ID = 'usr-bambang-sutrisno'
const FINANCE_MANAGER_ID = 'usr-retno-wulandari'
const MARKETING_ID = 'usr-rizky-ramadhan'

/** State bersama antar langkah supaya berkas ini terbaca sebagai satu cerita. */
const ctx: { costEntryId: string; costAmount: string; costStatus: string } = {
  costEntryId: 'cost-dokumen-tender',
  costAmount: '7500000.00',
  costStatus: 'DRAFT',
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('Skenario: tender AMDAL Tol Lingkar Selatan akhirnya kalah', () => {
  it('langkah 1 — staf pemasaran mengajukan biaya dokumen tender (Pola 1) dan sistem membuat dua approval PENDING', async () => {
    mocked.tender.findUnique.mockResolvedValue(TENDER)
    mocked.costEntry.create.mockResolvedValue({
      id: ctx.costEntryId,
      pattern: 'BIDDING',
      status: 'PENDING_APPROVAL',
    })

    const cost = await createBiddingCost({
      tenderId: TENDER.id,
      category: 'TENDER_DOCUMENT',
      description: 'Pembelian dokumen lelang dan penggandaan dokumen penawaran',
      amount: ctx.costAmount,
      incurredAt: at('2026-03-02'),
      requestedById: MARKETING_ID,
    })

    expect(cost.status).toBe('PENDING_APPROVAL')

    const data = mocked.costEntry.create.mock.calls[0][0].data
    // Pola 1 selalu menempel ke tender, tidak pernah ke proyek.
    expect(data.pattern).toBe('BIDDING')
    expect(data.tenderId).toBe(TENDER.id)
    expect(data.projectId).toBeNull()
    // COA beban operasional (6-xxx), bukan HPP proyek (5-xxx).
    expect(data.coaCode).toBe(BIDDING_COA.TENDER_DOCUMENT)
    expect(data.coaCode.startsWith('6')).toBe(true)
    expect(data.approvals.create.map((a: { role: string }) => a.role)).toEqual([
      'DIREKTUR',
      'FINANCE_MANAGER',
    ])

    ctx.costStatus = 'PENDING_APPROVAL'
  })

  it('langkah 2 — Direktur menyetujui, tetapi biaya masih PENDING_APPROVAL karena Finance Manager belum memutuskan', async () => {
    mocked.costEntry.findUnique.mockResolvedValue({
      id: ctx.costEntryId,
      pattern: 'BIDDING',
      approvals: [
        { role: 'DIREKTUR', decision: 'PENDING' },
        { role: 'FINANCE_MANAGER', decision: 'PENDING' },
      ],
    })
    mocked.approval.update.mockResolvedValue({})
    mocked.costEntry.update.mockImplementation(
      async (args: { data: { status: string } }) => ({ id: ctx.costEntryId, ...args.data }),
    )

    const updated = await decideBiddingApproval({
      costEntryId: ctx.costEntryId,
      approverId: DIREKTUR_ID,
      role: 'DIREKTUR',
      decision: 'APPROVED',
      note: 'Peluang menang 62%, di atas ambang 60%. Silakan lanjut.',
      now: at('2026-03-03'),
    })

    expect(updated.status).toBe('PENDING_APPROVAL')
    ctx.costStatus = 'PENDING_APPROVAL'
  })

  it('langkah 3 — Finance Manager ikut menyetujui sehingga biaya menjadi APPROVED', async () => {
    mocked.costEntry.findUnique.mockResolvedValue({
      id: ctx.costEntryId,
      pattern: 'BIDDING',
      approvals: [
        { role: 'DIREKTUR', decision: 'APPROVED' },
        { role: 'FINANCE_MANAGER', decision: 'PENDING' },
      ],
    })
    mocked.approval.update.mockResolvedValue({})
    mocked.costEntry.update.mockImplementation(
      async (args: { data: { status: string } }) => ({ id: ctx.costEntryId, ...args.data }),
    )

    const updated = await decideBiddingApproval({
      costEntryId: ctx.costEntryId,
      approverId: FINANCE_MANAGER_ID,
      role: 'FINANCE_MANAGER',
      decision: 'APPROVED',
      note: 'Anggaran pemasaran tersedia.',
      now: at('2026-03-04'),
    })

    expect(updated.status).toBe('APPROVED')
    ctx.costStatus = 'APPROVED'
  })

  it('langkah 4 — pengumuman keluar, tender berubah dari SUBMITTED menjadi LOST', async () => {
    mocked.tender.findUnique.mockResolvedValue(TENDER)
    mocked.tender.update.mockImplementation(
      async (args: { data: { status: string } }) => ({ ...TENDER, ...args.data }),
    )

    const tender = await changeTenderStatus({
      tenderId: TENDER.id,
      to: 'LOST',
      now: at('2026-05-20'),
    })

    expect(tender.status).toBe('LOST')
  })

  it('langkah 5 — biaya yang sudah disetujui tetap tercatat sebagai beban operasional yang hangus', () => {
    // Biaya tidak dihapus dan tidak diubah statusnya hanya karena tender kalah.
    expect(ctx.costStatus).toBe('APPROVED')

    const hangus = [
      { amount: ctx.costAmount, status: 'APPROVED' },
      { amount: '21000000.00', status: 'PAID' },
      { amount: '4350000.00', status: 'APPROVED' },
    ]
    // Total beban pemasaran yang hangus tetap dapat direkap untuk laporan laba rugi.
    expect(calculateDirectCostTotal(hangus)).toBe('32850000.00')
  })

  it('langkah 6 — biaya tender tidak boleh dibebankan ke proyek manapun', () => {
    expect(() =>
      validateBiddingCost({
        category: 'TENDER_DOCUMENT',
        tenderId: TENDER.id,
        projectId: 'jo-2026-011', // percobaan menempelkan ke proyek lain
        amount: ctx.costAmount,
        winRateProbability: TENDER.winRateProbability,
      }),
    ).toThrowError(
      expect.objectContaining({ code: 'BIDDING_COST_FORBIDS_PROJECT' }) as unknown as Error,
    )
  })

  it('langkah 7 — HPP proyek berjalan tidak ikut menanggung biaya tender yang kalah', async () => {
    // Proyek lain punya biaya Pola 1 "nyasar" di relasinya; ringkasan HPP
    // hanya boleh menghitung biaya berpola PROJECT.
    mocked.project.findUnique.mockResolvedValue({
      id: 'jo-2026-011',
      code: 'JO-2026-011',
      contractValue: '1580000000.00',
      costs: [
        { pattern: 'PROJECT', amount: '38500000.00', status: 'PAID' },
        { pattern: 'PROJECT', amount: '64200000.00', status: 'APPROVED' },
        { pattern: 'BIDDING', amount: ctx.costAmount, status: 'APPROVED' },
      ],
    })

    const summary = await getProjectCostSummary('jo-2026-011')

    expect(summary.directCost).toBe('102700000.00')
    expect(summary.grossProfit).toBe('1477300000.00')
    expect(summary.marginPercentage).toBe('93.50')
  })

  it('langkah 8 — tender yang sudah LOST tidak dapat dihidupkan kembali menjadi WON', async () => {
    mocked.tender.findUnique.mockResolvedValue({ ...TENDER, status: 'LOST' })

    await expect(
      changeTenderStatus({ tenderId: TENDER.id, to: 'WON', now: at('2026-05-21') }),
    ).rejects.toBeInstanceOf(BusinessRuleError)
  })
})
