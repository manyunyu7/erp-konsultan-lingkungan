import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BusinessRuleError } from '@/server/shared/constants'

vi.mock('@/lib/db', () => ({
  db: {
    tender: { findMany: vi.fn() },
    deliverable: { findMany: vi.fn() },
    termin: { findMany: vi.fn() },
    invoice: { findMany: vi.fn() },
    project: { findMany: vi.fn() },
    certification: { findMany: vi.fn() },
    user: { findMany: vi.fn() },
    notification: { findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
  },
}))

import { db } from '@/lib/db'
import {
  collectPlannedNotifications,
  createDueNotifications,
  createLogNotificationSender,
  dispatchPendingNotifications,
  resolveRecipientIds,
  runNotificationScan,
  type NotificationSender,
} from './service'

const wib = (iso: string) => new Date(`${iso}+07:00`)
const NOW = wib('2026-04-21T09:00:00')

/* eslint-disable @typescript-eslint/no-explicit-any */
const mocked = db as any

const TENDER = {
  id: 'tn1',
  code: 'TDR-2026-001',
  title: 'AMDAL Jalan Tol',
  status: 'PREPARING',
  submissionDeadline: wib('2026-04-23T16:00:00'),
}

const USERS = [
  { id: 'u-mkt', role: 'STAFF', division: 'MARKETING' },
  { id: 'u-fin', role: 'FINANCE_MANAGER', division: 'FINANCE' },
  { id: 'u-pm', role: 'PROJECT_MANAGER', division: 'MANAJEMEN' },
  { id: 'u-tek', role: 'STAFF', division: 'TEKNIS' },
]

/** Kosongkan semua tabel; tiap tes mengisi yang relevan saja. */
function resetDb() {
  vi.clearAllMocks()
  mocked.tender.findMany.mockResolvedValue([])
  mocked.deliverable.findMany.mockResolvedValue([])
  mocked.termin.findMany.mockResolvedValue([])
  mocked.invoice.findMany.mockResolvedValue([])
  mocked.project.findMany.mockResolvedValue([])
  mocked.certification.findMany.mockResolvedValue([])
  mocked.user.findMany.mockResolvedValue(USERS)
  mocked.notification.findMany.mockResolvedValue([])
  mocked.notification.create.mockResolvedValue({ id: 'n1' })
  mocked.notification.update.mockResolvedValue({ id: 'n1' })
}

beforeEach(resetDb)

describe('createLogNotificationSender', () => {
  const outbound = {
    id: 'n1',
    category: 'TENDER_DEADLINE',
    title: 'H-3 batas unggah',
    message: 'pesan',
    action: 'aksi',
    triggerAt: NOW,
    recipientUserIds: ['u1', 'u2'],
  }

  it('mencatat ke logger yang disuntikkan, tanpa kirim email', async () => {
    const logger = { info: vi.fn() }
    await createLogNotificationSender(logger).send(outbound)
    expect(logger.info).toHaveBeenCalledTimes(1)
    expect(logger.info.mock.calls[0][0]).toContain('TENDER_DEADLINE')
    expect(logger.info.mock.calls[0][0]).toContain('2 penerima')
  })

  it('memakai console sebagai logger bawaan', async () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {})
    await createLogNotificationSender().send(outbound)
    expect(spy).toHaveBeenCalledTimes(1)
    spy.mockRestore()
  })
})

describe('resolveRecipientIds', () => {
  it('mencocokkan berdasarkan divisi', () => {
    expect(
      resolveRecipientIds(
        { divisions: ['TEKNIS'], roles: [], userIds: [] },
        USERS,
      ),
    ).toEqual(['u-tek'])
  })

  it('mencocokkan berdasarkan peran lintas divisi', () => {
    expect(
      resolveRecipientIds(
        { divisions: [], roles: ['PROJECT_MANAGER'], userIds: [] },
        USERS,
      ),
    ).toEqual(['u-pm'])
  })

  it('tidak menduplikasi user yang cocok dua kriteria', () => {
    expect(
      resolveRecipientIds(
        { divisions: ['FINANCE'], roles: ['FINANCE_MANAGER'], userIds: ['u-fin'] },
        USERS,
      ),
    ).toEqual(['u-fin'])
  })

  it('menambahkan userIds eksplisit meski divisi/peran tak cocok', () => {
    expect(
      resolveRecipientIds(
        { divisions: ['HR'], roles: [], userIds: ['u-personel'] },
        USERS,
      ),
    ).toEqual(['u-personel'])
  })
})

describe('collectPlannedNotifications', () => {
  it('menggabungkan keenam kategori SOP', async () => {
    mocked.tender.findMany.mockResolvedValue([TENDER])
    mocked.deliverable.findMany.mockResolvedValue([
      {
        id: 'dl1',
        name: 'Draft Report',
        type: 'DRAFT_REPORT',
        status: 'IN_PROGRESS',
        dueDate: wib('2026-05-01T00:00:00'),
        submittedAt: null,
        project: { code: 'PRJ-1', name: 'Proyek 1', status: 'RUNNING' },
      },
    ])
    mocked.termin.findMany.mockResolvedValue([
      {
        id: 'tr1',
        sequence: 1,
        name: 'Termin 1',
        status: 'PENDING',
        plannedDate: wib('2026-05-01T00:00:00'),
        milestoneMetAt: null,
        project: { code: 'PRJ-1', name: 'Proyek 1', status: 'RUNNING' },
      },
    ])
    mocked.invoice.findMany.mockResolvedValue([
      {
        id: 'inv1',
        number: 'INV-1',
        status: 'ISSUED',
        dueDate: wib('2026-05-01T00:00:00'),
        paidAt: null,
        termin: { project: { code: 'PRJ-1', status: 'RUNNING' } },
      },
    ])
    mocked.project.findMany.mockResolvedValue([
      {
        id: 'pj1',
        code: 'PRJ-1',
        name: 'Proyek 1',
        status: 'RUNNING',
        endDate: wib('2026-12-31T00:00:00'),
      },
    ])
    mocked.certification.findMany.mockResolvedValue([
      {
        id: 'ct1',
        name: 'ATPA',
        issuer: 'LSP',
        expiresAt: wib('2026-10-01T00:00:00'),
        personnel: { fullName: 'Budi', isActive: true, userId: 'u-tek' },
      },
    ])

    const planned = await collectPlannedNotifications()
    expect(new Set(planned.map((p) => p.category))).toEqual(
      new Set([
        'TENDER_DEADLINE',
        'TECHNICAL_DEADLINE',
        'INVOICING',
        'PAYMENT_OVERDUE',
        'CONTRACT_EXPIRY',
        'CERTIFICATE_EXPIRY',
      ]),
    )
    // 2 + 3 + 1 + 2 + 2 + 1
    expect(planned).toHaveLength(11)
  })
})

describe('createDueNotifications', () => {
  it('menolak now tidak valid', async () => {
    await expect(createDueNotifications(new Date(NaN))).rejects.toThrow(
      BusinessRuleError,
    )
  })

  it('tidak melakukan apa-apa bila belum ada yang jatuh tempo', async () => {
    mocked.tender.findMany.mockResolvedValue([TENDER])
    // H-3 baru jatuh 20-04, H-1 pada 22-04.
    const result = await createDueNotifications(wib('2026-04-19T09:00:00'))
    expect(result).toEqual({ created: 0, skipped: 0 })
    expect(mocked.notification.findMany).not.toHaveBeenCalled()
    expect(mocked.notification.create).not.toHaveBeenCalled()
  })

  it('membuat hanya notifikasi yang tanggal pemicunya sudah tiba', async () => {
    mocked.tender.findMany.mockResolvedValue([TENDER])
    const result = await createDueNotifications(NOW)
    expect(result).toEqual({ created: 1, skipped: 0 })
    expect(mocked.notification.create).toHaveBeenCalledTimes(1)
    const data = mocked.notification.create.mock.calls[0][0].data
    expect(data.offsetDays).toBe(-3)
    expect(data.status).toBe('PENDING')
    expect(data.entityType).toBe('Tender')
    expect(data.recipients.create).toEqual([
      { userId: 'u-mkt' },
      { userId: 'u-fin' },
      { userId: 'u-pm' },
    ])
  })

  it('tetap membuat notifikasi yang pemicunya sudah lama lewat', async () => {
    mocked.tender.findMany.mockResolvedValue([TENDER])
    const result = await createDueNotifications(wib('2026-06-01T09:00:00'))
    expect(result).toEqual({ created: 2, skipped: 0 })
  })

  it('idempoten: eksekusi ulang tidak membuat duplikat', async () => {
    mocked.tender.findMany.mockResolvedValue([TENDER])
    mocked.notification.findMany.mockResolvedValue([
      { category: 'TENDER_DEADLINE', entityId: 'tn1', offsetDays: -3 },
    ])
    const result = await createDueNotifications(NOW)
    expect(result).toEqual({ created: 0, skipped: 1 })
    expect(mocked.notification.create).not.toHaveBeenCalled()
    expect(mocked.user.findMany).not.toHaveBeenCalled()
  })

  it('hanya membuat yang belum ada saat sebagian sudah tercatat', async () => {
    mocked.tender.findMany.mockResolvedValue([TENDER])
    mocked.notification.findMany.mockResolvedValue([
      { category: 'TENDER_DEADLINE', entityId: 'tn1', offsetDays: -3 },
    ])
    const result = await createDueNotifications(wib('2026-06-01T09:00:00'))
    expect(result).toEqual({ created: 1, skipped: 1 })
    expect(mocked.notification.create.mock.calls[0][0].data.offsetDays).toBe(-1)
  })

  it('tidak membuat apa pun untuk entitas yang sudah selesai', async () => {
    mocked.tender.findMany.mockResolvedValue([{ ...TENDER, status: 'LOST' }])
    mocked.invoice.findMany.mockResolvedValue([
      {
        id: 'inv1',
        number: 'INV-1',
        status: 'ISSUED',
        dueDate: wib('2026-01-01T00:00:00'),
        paidAt: wib('2026-01-01T00:00:00'),
        termin: { project: { code: 'PRJ-1', status: 'RUNNING' } },
      },
    ])
    mocked.deliverable.findMany.mockResolvedValue([
      {
        id: 'dl1',
        name: 'Draft',
        type: 'DRAFT_REPORT',
        status: 'SUBMITTED',
        dueDate: wib('2026-01-01T00:00:00'),
        submittedAt: wib('2026-01-01T00:00:00'),
        project: { code: 'PRJ-1', name: 'P1', status: 'RUNNING' },
      },
    ])
    mocked.project.findMany.mockResolvedValue([
      {
        id: 'pj1',
        code: 'PRJ-1',
        name: 'P1',
        status: 'CLOSED',
        endDate: wib('2026-01-01T00:00:00'),
      },
    ])
    const result = await createDueNotifications(NOW)
    expect(result).toEqual({ created: 0, skipped: 0 })
    expect(mocked.notification.create).not.toHaveBeenCalled()
  })
})

describe('dispatchPendingNotifications', () => {
  const pending = [
    {
      id: 'n1',
      category: 'TENDER_DEADLINE',
      title: 'H-3',
      message: 'pesan',
      action: 'aksi',
      triggerAt: wib('2026-04-20T00:00:00'),
      recipients: [{ userId: 'u-mkt' }],
    },
    {
      id: 'n2',
      category: 'PAYMENT_OVERDUE',
      title: 'H+1',
      message: 'pesan',
      action: 'aksi',
      triggerAt: wib('2026-04-21T00:00:00'),
      recipients: [],
    },
  ]

  it('menolak now tidak valid', async () => {
    await expect(dispatchPendingNotifications(new Date(NaN))).rejects.toThrow(
      BusinessRuleError,
    )
  })

  it('mengirim dan menandai SENT', async () => {
    mocked.notification.findMany.mockResolvedValue(pending)
    const sender: NotificationSender = { send: vi.fn().mockResolvedValue(undefined) }
    const result = await dispatchPendingNotifications(NOW, sender)
    expect(result).toEqual({ sent: 2, failed: 0 })
    expect(sender.send).toHaveBeenCalledTimes(2)
    expect((sender.send as ReturnType<typeof vi.fn>).mock.calls[0][0]).toMatchObject(
      { id: 'n1', recipientUserIds: ['u-mkt'] },
    )
    expect(mocked.notification.update).toHaveBeenCalledWith({
      where: { id: 'n1' },
      data: { status: 'SENT', sentAt: NOW },
    })
    // Query hanya mengambil PENDING dengan triggerAt <= now, termasuk yang lewat.
    expect(mocked.notification.findMany.mock.calls[0][0].where).toEqual({
      status: 'PENDING',
      triggerAt: { lte: NOW },
    })
  })

  it('membiarkan PENDING bila pengiriman gagal, supaya dicoba lagi', async () => {
    mocked.notification.findMany.mockResolvedValue(pending)
    const sender: NotificationSender = {
      send: vi
        .fn()
        .mockRejectedValueOnce(new Error('kanal mati'))
        .mockResolvedValueOnce(undefined),
    }
    const result = await dispatchPendingNotifications(NOW, sender)
    expect(result).toEqual({ sent: 1, failed: 1 })
    expect(mocked.notification.update).toHaveBeenCalledTimes(1)
    expect(mocked.notification.update.mock.calls[0][0].where).toEqual({ id: 'n2' })
  })

  it('memakai sender bawaan bila tidak disuntikkan', async () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {})
    mocked.notification.findMany.mockResolvedValue([pending[0]])
    const result = await dispatchPendingNotifications(NOW)
    expect(result).toEqual({ sent: 1, failed: 0 })
    expect(spy).toHaveBeenCalledTimes(1)
    spy.mockRestore()
  })
})

describe('runNotificationScan', () => {
  it('menolak now tidak valid', async () => {
    await expect(runNotificationScan({ now: new Date(NaN) })).rejects.toThrow(
      BusinessRuleError,
    )
  })

  it('menjalankan siklus penuh: buat lalu kirim', async () => {
    mocked.tender.findMany.mockResolvedValue([TENDER])
    mocked.notification.findMany
      .mockResolvedValueOnce([]) // cek idempotensi
      .mockResolvedValueOnce([
        {
          id: 'n1',
          category: 'TENDER_DEADLINE',
          title: 'H-3',
          message: 'pesan',
          action: 'aksi',
          triggerAt: wib('2026-04-20T00:00:00'),
          recipients: [{ userId: 'u-mkt' }],
        },
      ])
    const sender: NotificationSender = { send: vi.fn().mockResolvedValue(undefined) }
    const result = await runNotificationScan({ now: NOW, sender })
    expect(result).toEqual({ created: 1, skipped: 0, sent: 1, failed: 0 })
  })

  it('memakai sender bawaan bila opsi sender dihilangkan', async () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {})
    mocked.notification.findMany.mockResolvedValue([])
    const result = await runNotificationScan({ now: NOW })
    expect(result).toEqual({ created: 0, skipped: 0, sent: 0, failed: 0 })
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })
})
