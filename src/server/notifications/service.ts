/**
 * Orkestrasi notifikasi: memindai entitas dari database, membuat notifikasi
 * yang sudah jatuh tempo, lalu mengirim yang masih PENDING.
 *
 * Pembagian tanggung jawab yang disengaja:
 *  - `rules.ts` memutuskan APA yang harus ada (murni, tanpa I/O).
 *  - berkas ini hanya membaca/menulis dan memanggil sender.
 * Karena itu berkas ini sengaja tidak menyaring status entitas di klausa
 * `where` Prisma: satu-satunya sumber kebenaran soal "entitas sudah selesai"
 * ada di rules, supaya tidak ada dua tempat yang bisa berbeda pendapat.
 */

import { db } from '@/lib/db'
import { BusinessRuleError } from '@/server/shared/constants'
import {
  isDue,
  notificationKey,
  planCertificateExpiry,
  planContractExpiry,
  planInvoicing,
  planPaymentOverdue,
  planTechnicalDeadline,
  planTenderDeadline,
  type PlannedNotification,
  type RecipientSpec,
} from './rules'

// ----------------------------------------------------------------- SENDER

/** Notifikasi siap kirim, bentuk minimum yang dibutuhkan kanal pengiriman. */
export interface OutboundNotification {
  id: string
  category: string
  title: string
  message: string
  action: string
  triggerAt: Date
  recipientUserIds: string[]
}

/**
 * Titik sambung pengiriman. Integrasi email/WhatsApp nanti cukup
 * mengimplementasikan antarmuka ini — tidak ada bagian lain yang perlu berubah.
 */
export interface NotificationSender {
  send(notification: OutboundNotification): Promise<void>
}

export interface Logger {
  info(message: string): void
}

/**
 * Implementasi default: TIDAK mengirim email sungguhan. Notifikasi dianggap
 * "terkirim" begitu tercatat di database (status SENT) dan dicatat ke log.
 */
export function createLogNotificationSender(
  logger: Logger = console,
): NotificationSender {
  return {
    async send(notification: OutboundNotification): Promise<void> {
      logger.info(
        `[notifikasi] ${notification.category} — ${notification.title} ` +
          `→ ${notification.recipientUserIds.length} penerima`,
      )
    },
  }
}

// -------------------------------------------------------------- PENERIMA

interface RecipientCandidate {
  id: string
  role: string
  division: string
}

/**
 * Terjemahkan spesifikasi penerima (divisi/peran/user) menjadi daftar userId
 * unik. Dipisah sebagai fungsi agar bisa diuji tanpa database.
 */
export function resolveRecipientIds(
  spec: RecipientSpec,
  users: RecipientCandidate[],
): string[] {
  const matched = new Set<string>()
  for (const user of users) {
    if (
      spec.divisions.includes(user.division as RecipientSpec['divisions'][number]) ||
      spec.roles.includes(user.role as RecipientSpec['roles'][number])
    ) {
      matched.add(user.id)
    }
  }
  // userIds eksplisit ditambahkan meski divisi/perannya tidak cocok,
  // mis. personel pemilik sertifikat.
  for (const id of spec.userIds) matched.add(id)
  return [...matched]
}

// ---------------------------------------------------------------- PEMINDAI

/** Kumpulkan seluruh notifikasi yang seharusnya ada menurut SOP. */
export async function collectPlannedNotifications(): Promise<
  PlannedNotification[]
> {
  const [tenders, deliverables, termins, invoices, projects, certifications] =
    await Promise.all([
      db.tender.findMany(),
      db.deliverable.findMany({ include: { project: true } }),
      db.termin.findMany({ include: { project: true } }),
      db.invoice.findMany({ include: { termin: { include: { project: true } } } }),
      db.project.findMany(),
      db.certification.findMany({ include: { personnel: true } }),
    ])

  return [
    ...tenders.flatMap(planTenderDeadline),
    ...deliverables.flatMap(planTechnicalDeadline),
    ...termins.flatMap(planInvoicing),
    ...invoices.flatMap(planPaymentOverdue),
    ...projects.flatMap(planContractExpiry),
    ...certifications.flatMap(planCertificateExpiry),
  ]
}

export interface ScanResult {
  /** Jumlah notifikasi baru yang dibuat pada eksekusi ini. */
  created: number
  /** Jumlah notifikasi jatuh tempo yang sudah ada sebelumnya (idempotensi). */
  skipped: number
  /** Jumlah notifikasi yang berhasil dikirim & ditandai SENT. */
  sent: number
  /** Jumlah notifikasi yang gagal dikirim dan tetap PENDING untuk dicoba lagi. */
  failed: number
}

export interface ScanOptions {
  /** Tanggal acuan. Wajib eksplisit supaya penjadwalan dapat diuji. */
  now: Date
  sender?: NotificationSender
}

/**
 * Buat notifikasi yang tanggal pemicunya sudah tiba/lewat.
 * Yang belum tiba sengaja TIDAK dibuat — biar tidak menumpuk baris PENDING
 * masa depan yang membingungkan operator.
 */
export async function createDueNotifications(
  now: Date,
): Promise<Pick<ScanResult, 'created' | 'skipped'>> {
  assertValidNow(now)

  const due = (await collectPlannedNotifications()).filter((planned) =>
    isDue(planned, now),
  )
  if (due.length === 0) return { created: 0, skipped: 0 }

  // Idempotensi: cek dulu terhadap unique [category, entityId, offsetDays].
  const existing = await db.notification.findMany({
    where: { entityId: { in: due.map((item) => item.entityId) } },
    select: { category: true, entityId: true, offsetDays: true },
  })
  const existingKeys = new Set(existing.map(notificationKey))

  const missing = due.filter(
    (planned) => !existingKeys.has(notificationKey(planned)),
  )
  if (missing.length === 0) return { created: 0, skipped: due.length }

  const users = await db.user.findMany({
    where: { isActive: true },
    select: { id: true, role: true, division: true },
  })

  for (const planned of missing) {
    const recipientIds = resolveRecipientIds(planned.recipients, users)
    await db.notification.create({
      data: {
        category: planned.category,
        entityType: planned.entityType,
        entityId: planned.entityId,
        offsetDays: planned.offsetDays,
        triggerAt: planned.triggerAt,
        title: planned.title,
        message: planned.message,
        action: planned.action,
        status: 'PENDING',
        recipients: {
          create: recipientIds.map((userId) => ({ userId })),
        },
      },
    })
  }

  return { created: missing.length, skipped: due.length - missing.length }
}

/**
 * Kirim semua notifikasi PENDING yang tanggal pemicunya <= now.
 * Kenapa tidak hanya "hari ini": notifikasi yang terlewat (server mati, cron
 * gagal) harus tetap sampai, bukan hilang diam-diam.
 */
export async function dispatchPendingNotifications(
  now: Date,
  sender: NotificationSender = createLogNotificationSender(),
): Promise<Pick<ScanResult, 'sent' | 'failed'>> {
  assertValidNow(now)

  const pending = await db.notification.findMany({
    where: { status: 'PENDING', triggerAt: { lte: now } },
    include: { recipients: { select: { userId: true } } },
    orderBy: { triggerAt: 'asc' },
  })

  let sent = 0
  let failed = 0

  for (const notification of pending) {
    try {
      await sender.send({
        id: notification.id,
        category: notification.category,
        title: notification.title,
        message: notification.message,
        action: notification.action,
        triggerAt: notification.triggerAt,
        recipientUserIds: notification.recipients.map(
          (recipient: { userId: string }) => recipient.userId,
        ),
      })
      await db.notification.update({
        where: { id: notification.id },
        data: { status: 'SENT', sentAt: now },
      })
      sent += 1
    } catch {
      // Dibiarkan PENDING supaya eksekusi berikutnya mencoba lagi.
      failed += 1
    }
  }

  return { sent, failed }
}

/** Satu siklus penuh: pindai → buat → kirim. Ini yang dipanggil cron/route. */
export async function runNotificationScan(
  options: ScanOptions,
): Promise<ScanResult> {
  assertValidNow(options.now)
  const sender = options.sender ?? createLogNotificationSender()
  const { created, skipped } = await createDueNotifications(options.now)
  const { sent, failed } = await dispatchPendingNotifications(
    options.now,
    sender,
  )
  return { created, skipped, sent, failed }
}

function assertValidNow(now: Date): void {
  if (Number.isNaN(now.getTime())) {
    throw new BusinessRuleError(
      'Tanggal acuan `now` tidak valid.',
      'NOTIFICATION_INVALID_NOW',
    )
  }
}
