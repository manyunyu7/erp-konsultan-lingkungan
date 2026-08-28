import { describe, expect, it } from 'vitest'
import { BusinessRuleError } from '@/server/shared/constants'
import {
  CATEGORY_OFFSETS,
  REQUIRED_ACTIONS,
  computeTriggerDate,
  describeOffset,
  formatJakartaDate,
  isDeliverableDone,
  isDue,
  isInvoiceSettled,
  isProjectClosed,
  isReportDeliverable,
  isTenderSettled,
  isTerminBilled,
  notificationKey,
  planCertificateExpiry,
  planContractExpiry,
  planInvoicing,
  planPaymentOverdue,
  planTechnicalDeadline,
  planTenderDeadline,
  startOfJakartaDay,
  type CertificationInput,
  type DeliverableInput,
  type InvoiceInput,
  type ProjectInput,
  type TenderInput,
  type TerminInput,
} from './rules'

/** 00:00 WIB pada tanggal tertentu, dinyatakan sebagai instan UTC. */
const wib = (iso: string) => new Date(`${iso}+07:00`)

describe('utilitas tanggal (Asia/Jakarta)', () => {
  it('startOfJakartaDay memotong jam ke 00:00 WIB', () => {
    expect(startOfJakartaDay(wib('2026-04-23T16:45:12')).toISOString()).toBe(
      '2026-04-22T17:00:00.000Z',
    )
  })

  it('startOfJakartaDay bersifat idempoten', () => {
    const once = startOfJakartaDay(wib('2026-04-23T23:59:59'))
    expect(startOfJakartaDay(once).getTime()).toBe(once.getTime())
  })

  it('menangani instan sebelum epoch (pembulatan ke bawah)', () => {
    expect(startOfJakartaDay(new Date('1969-12-31T10:00:00Z')).toISOString()).toBe(
      '1969-12-30T17:00:00.000Z',
    )
  })

  it('startOfJakartaDay menolak tanggal tidak valid', () => {
    expect(() => startOfJakartaDay(new Date('bukan-tanggal'))).toThrow(
      BusinessRuleError,
    )
  })

  it('computeTriggerDate menggeser mundur untuk offset negatif', () => {
    expect(
      computeTriggerDate(wib('2026-04-23T16:00:00'), -3).toISOString(),
    ).toBe('2026-04-19T17:00:00.000Z')
  })

  it('computeTriggerDate menggeser maju untuk offset positif', () => {
    expect(computeTriggerDate(wib('2026-04-23T00:00:00'), 1).toISOString()).toBe(
      '2026-04-23T17:00:00.000Z',
    )
  })

  it('computeTriggerDate offset 0 = awal hari itu sendiri', () => {
    expect(computeTriggerDate(wib('2026-04-23T09:30:00'), 0).toISOString()).toBe(
      '2026-04-22T17:00:00.000Z',
    )
  })

  it('computeTriggerDate menolak tanggal tidak valid', () => {
    expect(() => computeTriggerDate(new Date(NaN), -3)).toThrow(BusinessRuleError)
  })

  it('computeTriggerDate menolak offset non-bilangan-bulat', () => {
    expect(() => computeTriggerDate(wib('2026-04-23T00:00:00'), 1.5)).toThrow(
      /bilangan bulat/,
    )
  })

  it('formatJakartaDate memakai kalender WIB, bukan UTC', () => {
    // 2026-04-23T00:00 WIB = 2026-04-22T17:00Z; harus tetap terbaca 23-04-2026.
    expect(formatJakartaDate(wib('2026-04-23T00:00:00'))).toBe('23-04-2026')
  })

  it('formatJakartaDate menolak tanggal tidak valid', () => {
    expect(() => formatJakartaDate(new Date(NaN))).toThrow(BusinessRuleError)
  })

  it('describeOffset melabeli sebelum/sesudah/hari ini', () => {
    expect(describeOffset(-3)).toBe('H-3')
    expect(describeOffset(1)).toBe('H+1')
    expect(describeOffset(0)).toBe('Hari ini')
  })

  it('notificationKey mencerminkan unique constraint', () => {
    expect(
      notificationKey({ category: 'INVOICING', entityId: 't1', offsetDays: -3 }),
    ).toBe('INVOICING|t1|-3')
  })
})

describe('isDue', () => {
  const planned = planTenderDeadline({
    id: 'tn1',
    code: 'TDR-001',
    title: 'Kajian UKL-UPL',
    status: 'PREPARING',
    submissionDeadline: wib('2026-04-23T00:00:00'),
  })[0]

  it('true bila tanggal pemicu sudah tiba', () => {
    expect(isDue(planned, wib('2026-04-20T08:00:00'))).toBe(true)
  })

  it('true bila tanggal pemicu sudah lewat (tidak boleh hilang)', () => {
    expect(isDue(planned, wib('2026-05-30T08:00:00'))).toBe(true)
  })

  it('false bila belum tiba', () => {
    expect(isDue(planned, wib('2026-04-19T23:59:59'))).toBe(false)
  })

  it('menolak now tidak valid', () => {
    expect(() => isDue(planned, new Date(NaN))).toThrow(BusinessRuleError)
  })
})

describe('predikat keselesaian entitas', () => {
  it('isProjectClosed', () => {
    expect(isProjectClosed('CLOSED')).toBe(true)
    expect(isProjectClosed('CANCELLED')).toBe(true)
    expect(isProjectClosed('RUNNING')).toBe(false)
  })

  it('isTenderSettled', () => {
    for (const status of ['SUBMITTED', 'WON', 'LOST', 'CANCELLED']) {
      expect(isTenderSettled(status)).toBe(true)
    }
    expect(isTenderSettled('PREPARING')).toBe(false)
  })

  it('isTerminBilled', () => {
    expect(isTerminBilled('INVOICED')).toBe(true)
    expect(isTerminBilled('PAID')).toBe(true)
    expect(isTerminBilled('PENDING')).toBe(false)
  })

  it('isReportDeliverable', () => {
    expect(isReportDeliverable('DRAFT_REPORT')).toBe(true)
    expect(isReportDeliverable('FINAL_REPORT')).toBe(true)
    expect(isReportDeliverable('EXPOSE')).toBe(false)
  })
})

// -------------------------------------------------------------------- 1
describe('TENDER_DEADLINE', () => {
  const tender: TenderInput = {
    id: 'tn1',
    code: 'TDR-2026-001',
    title: 'Penyusunan AMDAL Jalan Tol',
    status: 'PREPARING',
    submissionDeadline: wib('2026-04-23T16:00:00'),
  }

  it('membuat tepat H-3 dan H-1', () => {
    const result = planTenderDeadline(tender)
    expect(result.map((n) => n.offsetDays)).toEqual([-3, -1])
    expect(result[0].triggerAt.toISOString()).toBe('2026-04-19T17:00:00.000Z')
    expect(result[1].triggerAt.toISOString()).toBe('2026-04-21T17:00:00.000Z')
  })

  it('menyebut identitas tender dan aksi wajib SOP', () => {
    const [first] = planTenderDeadline(tender)
    expect(first.title).toContain('TDR-2026-001')
    expect(first.message).toContain('Penyusunan AMDAL Jalan Tol')
    expect(first.message).toContain('23-04-2026')
    expect(first.action).toBe(REQUIRED_ACTIONS.TENDER_DEADLINE)
    expect(first.entityType).toBe('Tender')
    expect(first.entityId).toBe('tn1')
  })

  it('penerimanya MARKETING, FINANCE, dan PROJECT_MANAGER', () => {
    const [first] = planTenderDeadline(tender)
    expect(first.recipients.divisions).toEqual(['MARKETING', 'FINANCE'])
    expect(first.recipients.roles).toEqual(['PROJECT_MANAGER'])
    expect(first.recipients.userIds).toEqual([])
  })

  it('tidak dibuat untuk tender kalah/batal/selesai', () => {
    for (const status of ['LOST', 'CANCELLED', 'WON', 'SUBMITTED']) {
      expect(planTenderDeadline({ ...tender, status })).toEqual([])
    }
  })
})

// -------------------------------------------------------------------- 2
describe('TECHNICAL_DEADLINE', () => {
  const deliverable: DeliverableInput = {
    id: 'dl1',
    name: 'Laporan Draft UKL-UPL',
    type: 'DRAFT_REPORT',
    status: 'IN_PROGRESS',
    dueDate: wib('2026-06-30T00:00:00'),
    submittedAt: null,
    project: { code: 'PRJ-001', name: 'UKL-UPL Pabrik A', status: 'RUNNING' },
  }

  it('membuat H-14, H-7, H-3', () => {
    const result = planTechnicalDeadline(deliverable)
    expect(result.map((n) => n.offsetDays)).toEqual(
      CATEGORY_OFFSETS.TECHNICAL_DEADLINE,
    )
    expect(result[0].triggerAt.toISOString()).toBe('2026-06-15T17:00:00.000Z')
  })

  it('menyebut nama laporan dan kode proyek', () => {
    const [first] = planTechnicalDeadline(deliverable)
    expect(first.title).toContain('Laporan Draft UKL-UPL')
    expect(first.message).toContain('PRJ-001')
    expect(first.message).toContain('30-06-2026')
    expect(first.action).toBe(REQUIRED_ACTIONS.TECHNICAL_DEADLINE)
    expect(first.recipients.divisions).toEqual(['TEKNIS'])
  })

  it('berlaku juga untuk FINAL_REPORT', () => {
    expect(
      planTechnicalDeadline({ ...deliverable, type: 'FINAL_REPORT' }),
    ).toHaveLength(3)
  })

  it('diabaikan untuk tipe non-laporan', () => {
    expect(
      planTechnicalDeadline({ ...deliverable, type: 'SAMPLING_PLAN' }),
    ).toEqual([])
  })

  it('diabaikan bila sudah diserahkan', () => {
    expect(
      planTechnicalDeadline({
        ...deliverable,
        submittedAt: wib('2026-06-20T00:00:00'),
      }),
    ).toEqual([])
    expect(
      planTechnicalDeadline({ ...deliverable, status: 'SUBMITTED' }),
    ).toEqual([])
    expect(
      planTechnicalDeadline({ ...deliverable, status: 'APPROVED' }),
    ).toEqual([])
  })

  it('diabaikan bila proyek sudah ditutup', () => {
    expect(
      planTechnicalDeadline({
        ...deliverable,
        project: { ...deliverable.project, status: 'CLOSED' },
      }),
    ).toEqual([])
  })

  it('isDeliverableDone konsisten dengan predikatnya', () => {
    expect(isDeliverableDone(deliverable)).toBe(false)
  })
})

// -------------------------------------------------------------------- 3
describe('INVOICING', () => {
  const termin: TerminInput = {
    id: 'tr1',
    sequence: 2,
    name: 'Termin 2 - Draft Report',
    status: 'PENDING',
    plannedDate: wib('2026-07-10T00:00:00'),
    milestoneMetAt: null,
    project: { code: 'PRJ-002', name: 'AMDAL Tambang B', status: 'RUNNING' },
  }

  it('hanya H-3 bila milestone belum tercapai', () => {
    const result = planInvoicing(termin)
    expect(result.map((n) => n.offsetDays)).toEqual([-3])
    expect(result[0].triggerAt.toISOString()).toBe('2026-07-06T17:00:00.000Z')
    expect(result[0].message).toContain('PRJ-002')
    expect(result[0].action).toBe(REQUIRED_ACTIONS.INVOICING)
  })

  it('menambah pemicu segera (offset 0) saat milestone tercapai', () => {
    const result = planInvoicing({
      ...termin,
      milestoneMetAt: wib('2026-06-25T14:00:00'),
    })
    expect(result.map((n) => n.offsetDays)).toEqual([-3, 0])
    expect(result[1].triggerAt.toISOString()).toBe('2026-06-24T17:00:00.000Z')
    expect(result[1].message).toContain('25-06-2026')
    expect(result[1].title).toContain('Milestone tercapai')
  })

  it('penerimanya FINANCE dan PROJECT_MANAGER', () => {
    const [first] = planInvoicing(termin)
    expect(first.recipients.divisions).toEqual(['FINANCE'])
    expect(first.recipients.roles).toEqual(['PROJECT_MANAGER'])
  })

  it('diabaikan bila termin sudah diinvoice/dibayar', () => {
    expect(planInvoicing({ ...termin, status: 'INVOICED' })).toEqual([])
    expect(planInvoicing({ ...termin, status: 'PAID' })).toEqual([])
  })

  it('diabaikan bila proyek sudah ditutup', () => {
    expect(
      planInvoicing({
        ...termin,
        project: { ...termin.project, status: 'CANCELLED' },
      }),
    ).toEqual([])
  })
})

// -------------------------------------------------------------------- 4
describe('PAYMENT_OVERDUE', () => {
  const invoice: InvoiceInput = {
    id: 'inv1',
    number: 'INV/2026/VII/014',
    status: 'ISSUED',
    dueDate: wib('2026-08-15T00:00:00'),
    paidAt: null,
    termin: { project: { code: 'PRJ-003', status: 'RUNNING' } },
  }

  it('membuat pre-due H-3 dan overdue H+1', () => {
    const result = planPaymentOverdue(invoice)
    expect(result.map((n) => n.offsetDays)).toEqual([-3, 1])
    expect(result[0].triggerAt.toISOString()).toBe('2026-08-11T17:00:00.000Z')
    expect(result[1].triggerAt.toISOString()).toBe('2026-08-15T17:00:00.000Z')
  })

  it('pesan berbeda antara pre-due dan overdue, keduanya menyebut nomor invoice', () => {
    const [pre, over] = planPaymentOverdue(invoice)
    expect(pre.title).toContain('H-3 jatuh tempo')
    expect(pre.message).toContain('INV/2026/VII/014')
    expect(pre.message).toContain('15-08-2026')
    expect(over.title).toContain('lewat jatuh tempo')
    expect(over.message).toContain('telah melewati jatuh tempo')
    expect(over.recipients.divisions).toEqual(['FINANCE'])
    expect(over.recipients.roles).toEqual([])
    expect(over.action).toBe(REQUIRED_ACTIONS.PAYMENT_OVERDUE)
  })

  it('diabaikan bila invoice sudah lunas atau dibatalkan', () => {
    expect(
      planPaymentOverdue({ ...invoice, paidAt: wib('2026-08-10T00:00:00') }),
    ).toEqual([])
    expect(planPaymentOverdue({ ...invoice, status: 'PAID' })).toEqual([])
    expect(planPaymentOverdue({ ...invoice, status: 'CANCELLED' })).toEqual([])
  })

  it('diabaikan bila proyek sudah ditutup', () => {
    expect(
      planPaymentOverdue({
        ...invoice,
        termin: { project: { code: 'PRJ-003', status: 'CLOSED' } },
      }),
    ).toEqual([])
  })

  it('isInvoiceSettled konsisten dengan predikatnya', () => {
    expect(isInvoiceSettled(invoice)).toBe(false)
  })
})

// -------------------------------------------------------------------- 5
describe('CONTRACT_EXPIRY', () => {
  const project: ProjectInput = {
    id: 'pj1',
    code: 'PRJ-004',
    name: 'DELH Kawasan Industri',
    status: 'RUNNING',
    endDate: wib('2026-12-31T00:00:00'),
  }

  it('membuat H-30 dan H-14', () => {
    const result = planContractExpiry(project)
    expect(result.map((n) => n.offsetDays)).toEqual([-30, -14])
    expect(result[0].triggerAt.toISOString()).toBe('2026-11-30T17:00:00.000Z')
    expect(result[1].triggerAt.toISOString()).toBe('2026-12-16T17:00:00.000Z')
  })

  it('menyebut kode proyek dan aksi SOP', () => {
    const [first] = planContractExpiry(project)
    expect(first.title).toContain('PRJ-004')
    expect(first.message).toContain('31-12-2026')
    expect(first.action).toBe(REQUIRED_ACTIONS.CONTRACT_EXPIRY)
    expect(first.recipients.divisions).toEqual(['ADMIN_LEGAL'])
    expect(first.recipients.roles).toEqual(['PROJECT_MANAGER'])
  })

  it('diabaikan bila proyek CLOSED', () => {
    expect(planContractExpiry({ ...project, status: 'CLOSED' })).toEqual([])
  })
})

// -------------------------------------------------------------------- 6
describe('CERTIFICATE_EXPIRY', () => {
  const certification: CertificationInput = {
    id: 'ct1',
    name: 'ATPA',
    issuer: 'LSP Lingkungan',
    expiresAt: wib('2026-10-01T00:00:00'),
    personnel: { fullName: 'Budi Santoso', isActive: true, userId: 'u9' },
  }

  it('membuat H-60 saja', () => {
    const result = planCertificateExpiry(certification)
    expect(result.map((n) => n.offsetDays)).toEqual([-60])
    expect(result[0].triggerAt.toISOString()).toBe('2026-08-01T17:00:00.000Z')
    expect(result[0].message).toContain('Budi Santoso')
    expect(result[0].message).toContain('01-10-2026')
    expect(result[0].action).toBe(REQUIRED_ACTIONS.CERTIFICATE_EXPIRY)
  })

  it('penerimanya divisi HR dan personel bersangkutan', () => {
    const [first] = planCertificateExpiry(certification)
    expect(first.recipients.divisions).toEqual(['HR'])
    expect(first.recipients.userIds).toEqual(['u9'])
  })

  it('tanpa akun user, hanya HR yang menerima', () => {
    const [first] = planCertificateExpiry({
      ...certification,
      personnel: { ...certification.personnel, userId: null },
    })
    expect(first.recipients.userIds).toEqual([])
  })

  it('diabaikan untuk personel non-aktif', () => {
    expect(
      planCertificateExpiry({
        ...certification,
        personnel: { ...certification.personnel, isActive: false },
      }),
    ).toEqual([])
  })
})
