import { describe, expect, it } from 'vitest'
import { BusinessRuleError } from '@/server/shared/constants'
import {
  assertApprovalRole,
  assertInvoiceIssuable,
  buildTerminPlan,
  calculateDirectCostTotal,
  calculateProjectMargin,
  fromMinorUnits,
  isInvoiceOverdue,
  resolveBiddingApprovalStatus,
  resolveInvoiceStatus,
  summarizeCashFlow,
  toMinorUnits,
  validateBiddingCost,
  validateProjectCost,
} from './rules'

const at = (iso: string) => new Date(iso)

describe('konversi uang', () => {
  it('mengubah string, number, dan objek Decimal-like ke satuan minor', () => {
    expect(toMinorUnits('1500.25')).toBe(BigInt(150025))
    expect(toMinorUnits(1500)).toBe(BigInt(150000))
    expect(toMinorUnits({ toString: () => '10.5' })).toBe(BigInt(1050))
    expect(toMinorUnits(' 7 ')).toBe(BigInt(700))
  })

  it('membulatkan half-up pada digit ketiga', () => {
    expect(toMinorUnits('0.005')).toBe(BigInt(1))
    expect(toMinorUnits('0.004')).toBe(BigInt(0))
    expect(toMinorUnits('-0.005')).toBe(-BigInt(1))
  })

  it('menolak string non-desimal', () => {
    expect(() => toMinorUnits('abc')).toThrowError(BusinessRuleError)
    try {
      toMinorUnits('abc')
    } catch (error) {
      expect((error as BusinessRuleError).code).toBe('INVALID_DECIMAL_VALUE')
    }
  })

  it('mengembalikan string dua desimal termasuk nilai negatif', () => {
    expect(fromMinorUnits(BigInt(150025))).toBe('1500.25')
    expect(fromMinorUnits(BigInt(5))).toBe('0.05')
    expect(fromMinorUnits(-BigInt(5))).toBe('-0.05')
  })
})

describe('validateBiddingCost (Pola 1)', () => {
  const base = {
    category: 'BID_BOND',
    tenderId: 'tender-1',
    projectId: null,
    amount: '1000000',
    winRateProbability: 75,
  }

  it('menerima biaya tender yang sah', () => {
    const result = validateBiddingCost(base)
    expect(result).toMatchObject({
      pattern: 'BIDDING',
      category: 'BID_BOND',
      coaCode: '6102',
      tenderId: 'tender-1',
      projectId: null,
      amount: '1000000.00',
    })
    expect(result.amountMinor).toBe(BigInt(100000000))
  })

  it.each([
    [{ ...base, category: 'EXPERT_HONORARIUM' }, 'INVALID_BIDDING_COST_CATEGORY'],
    [{ ...base, tenderId: null }, 'BIDDING_COST_REQUIRES_TENDER'],
    [{ ...base, projectId: 'p-1' }, 'BIDDING_COST_FORBIDS_PROJECT'],
    [{ ...base, winRateProbability: 59 }, 'WIN_RATE_BELOW_THRESHOLD'],
    [{ ...base, winRateProbability: null }, 'WIN_RATE_BELOW_THRESHOLD'],
    [{ ...base, amount: '0' }, 'COST_AMOUNT_NOT_POSITIVE'],
  ])('menolak input tidak sah (%#)', (input, code) => {
    expect(() => validateBiddingCost(input)).toThrowError(
      expect.objectContaining({ code }),
    )
  })

  it('menerima tepat pada ambang win rate 60', () => {
    expect(validateBiddingCost({ ...base, winRateProbability: 60 }).coaCode).toBe('6102')
  })
})

describe('validateProjectCost (Pola 2)', () => {
  const base = {
    category: 'LAB_TEST_KAN',
    tenderId: null,
    projectId: 'proj-1',
    amount: '2500000.5',
    hasSignedContract: true,
  }

  it('menerima biaya proyek yang sah dan memetakan COA HPP', () => {
    expect(validateProjectCost(base)).toMatchObject({
      pattern: 'PROJECT',
      coaCode: '5103',
      tenderId: null,
      projectId: 'proj-1',
      amount: '2500000.50',
    })
  })

  it.each([
    [{ ...base, category: 'BID_BOND' }, 'INVALID_PROJECT_COST_CATEGORY'],
    [{ ...base, projectId: null }, 'PROJECT_COST_REQUIRES_PROJECT'],
    [{ ...base, tenderId: 't-1' }, 'PROJECT_COST_FORBIDS_TENDER'],
    [{ ...base, hasSignedContract: false }, 'PROJECT_COST_REQUIRES_SIGNED_CONTRACT'],
    [{ ...base, amount: '-5' }, 'COST_AMOUNT_NOT_POSITIVE'],
  ])('menolak input tidak sah (%#)', (input, code) => {
    expect(() => validateProjectCost(input)).toThrowError(
      expect.objectContaining({ code }),
    )
  })
})

describe('gate persetujuan dua peran', () => {
  it('APPROVED hanya jika kedua peran setuju', () => {
    expect(
      resolveBiddingApprovalStatus([
        { role: 'DIREKTUR', decision: 'APPROVED' },
        { role: 'FINANCE_MANAGER', decision: 'APPROVED' },
      ]),
    ).toBe('APPROVED')
  })

  it('REJECTED bila salah satu menolak', () => {
    expect(
      resolveBiddingApprovalStatus([
        { role: 'DIREKTUR', decision: 'APPROVED' },
        { role: 'FINANCE_MANAGER', decision: 'REJECTED' },
      ]),
    ).toBe('REJECTED')
  })

  it('PENDING_APPROVAL bila belum lengkap dan mengabaikan peran lain', () => {
    expect(
      resolveBiddingApprovalStatus([
        { role: 'DIREKTUR', decision: 'APPROVED' },
        { role: 'STAFF', decision: 'REJECTED' },
      ]),
    ).toBe('PENDING_APPROVAL')
    expect(resolveBiddingApprovalStatus([])).toBe('PENDING_APPROVAL')
  })

  it('memvalidasi peran penyetuju', () => {
    expect(assertApprovalRole('DIREKTUR')).toBe('DIREKTUR')
    expect(() => assertApprovalRole('STAFF')).toThrowError(
      expect.objectContaining({ code: 'INVALID_APPROVAL_ROLE' }),
    )
  })
})

describe('buildTerminPlan', () => {
  it('menghitung nominal tiap termin dan totalnya persis nilai kontrak', () => {
    const plan = buildTerminPlan('1000000000', ['25', '50', '25'])
    expect(plan.map((t) => t.amount)).toEqual([
      '250000000.00',
      '500000000.00',
      '250000000.00',
    ])
    expect(plan[0]).toMatchObject({ sequence: 1, milestone: 'CONTRACT_SIGNED', percentage: '25.00' })
    expect(plan[1].milestone).toBe('DRAFT_REPORT')
    expect(plan[2].milestone).toBe('BAST')
  })

  it('melempar sisa pembulatan ke termin terakhir', () => {
    const plan = buildTerminPlan('100.01', ['30', '40', '30'])
    const total = plan.reduce((sum, t) => sum + t.amountMinor, BigInt(0))
    expect(total).toBe(BigInt(10001))
  })

  it.each([
    [['25', '50'], 'TERMIN_COUNT_INVALID'],
    [['19.99', '50', '30.01'], 'TERMIN_1_PERCENTAGE_OUT_OF_RANGE'],
    [['30.01', '39.99', '30'], 'TERMIN_1_PERCENTAGE_OUT_OF_RANGE'],
    [['25', '39', '36'], 'TERMIN_2_PERCENTAGE_OUT_OF_RANGE'],
    [['25', '51', '24'], 'TERMIN_2_PERCENTAGE_OUT_OF_RANGE'],
    [['30', '50', '19'], 'TERMIN_3_PERCENTAGE_OUT_OF_RANGE'],
    [['20', '45', '31'], 'TERMIN_3_PERCENTAGE_OUT_OF_RANGE'],
    [['20', '45', '30'], 'TERMIN_TOTAL_NOT_100'],
  ])('menolak pembagian tidak sah (%#)', (percentages, code) => {
    expect(() => buildTerminPlan('1000', percentages)).toThrowError(
      expect.objectContaining({ code }),
    )
  })

  it('menolak nilai kontrak nol', () => {
    expect(() => buildTerminPlan('0', ['25', '50', '25'])).toThrowError(
      expect.objectContaining({ code: 'CONTRACT_VALUE_NOT_POSITIVE' }),
    )
  })
})

describe('invoice', () => {
  it('mengizinkan terbit bila BAP terverifikasi dan milestone tercapai', () => {
    expect(() =>
      assertInvoiceIssuable({ bapVerifiedAt: at('2026-01-01'), milestoneMetAt: at('2026-01-02') }),
    ).not.toThrow()
  })

  it.each([
    [{ bapVerifiedAt: null, milestoneMetAt: at('2026-01-02') }, 'INVOICE_BAP_NOT_VERIFIED'],
    [{ bapVerifiedAt: at('2026-01-01'), milestoneMetAt: null }, 'INVOICE_MILESTONE_NOT_MET'],
  ])('menolak penerbitan (%#)', (gate, code) => {
    expect(() => assertInvoiceIssuable(gate)).toThrowError(expect.objectContaining({ code }))
  })

  it('menentukan overdue relatif terhadap now yang di-inject', () => {
    const invoice = { amount: '100', dueDate: at('2026-03-10T00:00:00Z') }
    expect(isInvoiceOverdue(invoice, at('2026-03-11T00:00:00Z'))).toBe(true)
    expect(isInvoiceOverdue(invoice, at('2026-03-09T00:00:00Z'))).toBe(false)
    expect(
      isInvoiceOverdue({ ...invoice, paidAt: at('2026-03-01') }, at('2026-03-11')),
    ).toBe(false)
    expect(
      isInvoiceOverdue({ ...invoice, status: 'CANCELLED' }, at('2026-03-11')),
    ).toBe(false)
  })

  it('menurunkan status invoice', () => {
    const due = at('2026-03-10T00:00:00Z')
    expect(resolveInvoiceStatus({ amount: '1', dueDate: due, status: 'CANCELLED' }, at('2026-03-11'))).toBe('CANCELLED')
    expect(resolveInvoiceStatus({ amount: '1', dueDate: due, paidAt: at('2026-03-01') }, at('2026-03-11'))).toBe('PAID')
    expect(resolveInvoiceStatus({ amount: '1', dueDate: due }, at('2026-03-11'))).toBe('OVERDUE')
    expect(resolveInvoiceStatus({ amount: '1', dueDate: due }, at('2026-03-01'))).toBe('ISSUED')
  })

  it('meringkas arus kas', () => {
    const now = at('2026-03-11T00:00:00Z')
    const summary = summarizeCashFlow(
      [
        { amount: '1000', dueDate: at('2026-02-01'), paidAt: at('2026-02-02') },
        { amount: '2000', dueDate: at('2026-03-01') },
        { amount: '500', dueDate: at('2026-04-01') },
        { amount: '9999', dueDate: at('2026-01-01'), status: 'CANCELLED' },
      ],
      now,
    )
    expect(summary).toEqual({
      billed: '3500.00',
      paid: '1000.00',
      outstanding: '2500.00',
      overdue: '2000.00',
      overdueCount: 1,
    })
  })
})

describe('direct cost & margin', () => {
  it('hanya menjumlah biaya berstatus APPROVED atau PAID', () => {
    expect(
      calculateDirectCostTotal([
        { amount: '100.10', status: 'APPROVED' },
        { amount: '200.20', status: 'PAID' },
        { amount: '999', status: 'PENDING_APPROVAL' },
        { amount: '999' },
      ]),
    ).toBe('300.30')
  })

  it('menghitung margin terhadap nilai kontrak', () => {
    expect(calculateProjectMargin('1000000', '250000')).toEqual({
      contractValue: '1000000.00',
      directCost: '250000.00',
      grossProfit: '750000.00',
      marginPercentage: '75.00',
    })
  })

  it('mengembalikan margin null bila nilai kontrak nol', () => {
    expect(calculateProjectMargin('0', '100').marginPercentage).toBeNull()
  })

  it('mendukung margin negatif', () => {
    expect(calculateProjectMargin('100', '150').marginPercentage).toBe('-50.00')
  })
})
