/**
 * Aturan peringatan (SOP perusahaan) — MURNI, tanpa database.
 *
 * Kenapa dipisah: penjadwalan dan isi pesan adalah aturan bisnis yang paling
 * sering berubah dan paling mahal kalau salah. Dengan memisahkannya sebagai
 * fungsi murni, seluruh tabel SOP bisa diuji tanpa Prisma, tanpa jam sistem,
 * dan tanpa flakiness.
 *
 * ASUMSI ZONA WAKTU
 * -----------------
 * Seluruh perhitungan "hari" memakai Asia/Jakarta (WIB, UTC+07:00) sebagai
 * offset TETAP. Alasannya:
 *  1. Pengguna sistem ini seluruhnya bekerja di zona WIB, sehingga "H-3"
 *     harus berarti H-3 menurut kalender kantor, bukan kalender UTC. Deadline
 *     23-04-2026 00:00 WIB tersimpan sebagai 22-04-2026 17:00 UTC; kalau
 *     dinormalkan ke UTC, notifikasinya akan meleset satu hari.
 *  2. Indonesia tidak pernah menerapkan DST dan WIB tidak pernah berubah
 *     offset, jadi offset tetap +07:00 aman dan jauh lebih murah/deterministik
 *     daripada Intl.DateTimeFormat per pemanggilan.
 * Nilai `Date` yang dikembalikan tetap instan UTC (sesuai kolom DateTime
 * Prisma); yang dinormalkan adalah *titik* awal harinya, yaitu 00:00 WIB.
 *
 * Semua fungsi yang bergantung waktu WAJIB menerima `now: Date` dari pemanggil.
 * Tidak ada `new Date()` di berkas ini — itu disengaja.
 */

import {
  BusinessRuleError,
  type Division,
  type NotificationCategory,
  type Role,
} from '@/server/shared/constants'

/** Offset WIB dalam milidetik. */
const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

// ------------------------------------------------------------------- TIPE

/** Siapa yang harus menerima sebuah notifikasi. */
export interface RecipientSpec {
  /** Semua user aktif pada divisi ini. */
  divisions: Division[]
  /** Semua user aktif dengan peran ini (lintas divisi). */
  roles: Role[]
  /** User spesifik, mis. personel pemilik sertifikat. */
  userIds: string[]
}

export type NotificationEntityType =
  | 'Tender'
  | 'Deliverable'
  | 'Termin'
  | 'Invoice'
  | 'Project'
  | 'Certification'

/** Notifikasi yang SEHARUSNYA ada menurut SOP — belum tentu sudah dibuat. */
export interface PlannedNotification {
  category: NotificationCategory
  entityType: NotificationEntityType
  entityId: string
  /** Negatif = sebelum (H-3 => -3), positif = sesudah (H+1 => 1), 0 = saat itu juga. */
  offsetDays: number
  triggerAt: Date
  title: string
  message: string
  action: string
  recipients: RecipientSpec
}

// -------------------------------------------------------- TABEL AKSI SOP

/** Aksi wajib per kategori — teks persis dari SOP, jangan diparafrase. */
export const REQUIRED_ACTIONS: Record<NotificationCategory, string> = {
  TENDER_DEADLINE:
    'Memastikan kelengkapan dokumen teknis & jaminan penawaran telah diunggah.',
  TECHNICAL_DEADLINE:
    'Melakukan review internal (QA/QC) dan finalisasi penyerahan berkas.',
  INVOICING:
    'Menerbitkan Invoice, Faktur Pajak, dan kelengkapan lampiran BAP ke Klien.',
  PAYMENT_OVERDUE:
    'Mengirimkan Email Reminder atau Surat Tagihan Formal kepada Klien.',
  CONTRACT_EXPIRY:
    'Menyusun Addendum Perpanjangan Waktu atau menyiapkan BAST Final.',
  CERTIFICATE_EXPIRY:
    'Mengajukan registrasi pembaharuan/recertification di LSP/LPTK.',
}

/** Offset hari per kategori — sumber tunggal jadwal SOP. */
export const CATEGORY_OFFSETS: Record<NotificationCategory, number[]> = {
  TENDER_DEADLINE: [-3, -1],
  TECHNICAL_DEADLINE: [-14, -7, -3],
  // 0 = pemicu "segera saat milestone tercapai", basisnya milestoneMetAt.
  INVOICING: [-3, 0],
  PAYMENT_OVERDUE: [-3, 1],
  CONTRACT_EXPIRY: [-30, -14],
  CERTIFICATE_EXPIRY: [-60],
}

/** Penerima per kategori. */
export const CATEGORY_RECIPIENTS: Record<
  NotificationCategory,
  Pick<RecipientSpec, 'divisions' | 'roles'>
> = {
  TENDER_DEADLINE: {
    divisions: ['MARKETING', 'FINANCE'],
    roles: ['PROJECT_MANAGER'],
  },
  TECHNICAL_DEADLINE: { divisions: ['TEKNIS'], roles: ['PROJECT_MANAGER'] },
  INVOICING: { divisions: ['FINANCE'], roles: ['PROJECT_MANAGER'] },
  PAYMENT_OVERDUE: { divisions: ['FINANCE'], roles: [] },
  CONTRACT_EXPIRY: { divisions: ['ADMIN_LEGAL'], roles: ['PROJECT_MANAGER'] },
  CERTIFICATE_EXPIRY: { divisions: ['HR'], roles: [] },
}

// -------------------------------------------------------- UTILITAS TANGGAL

/**
 * Awal hari (00:00 WIB) dari sebuah instan, dikembalikan sebagai instan UTC.
 * Kenapa: menghilangkan komponen jam supaya H-3 tidak bergeser hanya karena
 * deadline dicatat pukul 16:00 dan scan berjalan pukul 09:00.
 */
export function startOfJakartaDay(date: Date): Date {
  assertValidDate(date, 'startOfJakartaDay')
  const shifted = date.getTime() + JAKARTA_OFFSET_MS
  return new Date(Math.floor(shifted / DAY_MS) * DAY_MS - JAKARTA_OFFSET_MS)
}

/**
 * Tanggal pemicu = awal hari WIB dari baseDate digeser `offsetDays` hari.
 * offsetDays negatif = sebelum, positif = sesudah (konsisten dengan kolom
 * `offsetDays` pada tabel Notification).
 */
export function computeTriggerDate(baseDate: Date, offsetDays: number): Date {
  assertValidDate(baseDate, 'computeTriggerDate')
  if (!Number.isInteger(offsetDays)) {
    throw new BusinessRuleError(
      'offsetDays harus bilangan bulat (hari).',
      'NOTIFICATION_INVALID_OFFSET',
    )
  }
  // Aritmetika epoch, bukan setDate(): WIB tanpa DST membuat penambahan
  // 24 jam selalu tepat satu hari kalender.
  return new Date(startOfJakartaDay(baseDate).getTime() + offsetDays * DAY_MS)
}

function assertValidDate(date: Date, where: string): void {
  if (Number.isNaN(date.getTime())) {
    throw new BusinessRuleError(
      `Tanggal tidak valid pada ${where}.`,
      'NOTIFICATION_INVALID_DATE',
    )
  }
}

/** Format tanggal dd-MM-yyyy menurut WIB, untuk ditempel di pesan. */
export function formatJakartaDate(date: Date): string {
  assertValidDate(date, 'formatJakartaDate')
  const shifted = new Date(date.getTime() + JAKARTA_OFFSET_MS)
  const day = String(shifted.getUTCDate()).padStart(2, '0')
  const month = String(shifted.getUTCMonth() + 1).padStart(2, '0')
  return `${day}-${month}-${shifted.getUTCFullYear()}`
}

/** Label manusiawi untuk offset, dipakai di judul notifikasi. */
export function describeOffset(offsetDays: number): string {
  if (offsetDays === 0) return 'Hari ini'
  if (offsetDays < 0) return `H-${Math.abs(offsetDays)}`
  return `H+${offsetDays}`
}

/** Notifikasi dianggap jatuh tempo bila tanggal pemicunya sudah tiba/lewat. */
export function isDue(planned: PlannedNotification, now: Date): boolean {
  assertValidDate(now, 'isDue')
  return planned.triggerAt.getTime() <= now.getTime()
}

// ------------------------------------------------------------ BENTUK INPUT

export interface TenderInput {
  id: string
  code: string
  title: string
  status: string
  submissionDeadline: Date
}

export interface DeliverableInput {
  id: string
  name: string
  type: string
  status: string
  dueDate: Date
  submittedAt: Date | null
  project: { code: string; name: string; status: string }
}

export interface TerminInput {
  id: string
  sequence: number
  name: string
  status: string
  plannedDate: Date
  milestoneMetAt: Date | null
  project: { code: string; name: string; status: string }
}

export interface InvoiceInput {
  id: string
  number: string
  status: string
  dueDate: Date
  paidAt: Date | null
  termin: { project: { code: string; status: string } }
}

export interface ProjectInput {
  id: string
  code: string
  name: string
  status: string
  endDate: Date
}

export interface CertificationInput {
  id: string
  name: string
  issuer: string
  expiresAt: Date
  personnel: { fullName: string; isActive: boolean; userId: string | null }
}

// ------------------------------------------------------ PREDIKAT KESELESAIAN

/** Proyek yang sudah tutup/batal tidak boleh memicu peringatan apa pun. */
export function isProjectClosed(status: string): boolean {
  return status === 'CLOSED' || status === 'CANCELLED'
}

/** Tender selesai bila sudah disubmit atau keputusannya keluar/batal. */
export function isTenderSettled(status: string): boolean {
  return (
    status === 'SUBMITTED' ||
    status === 'WON' ||
    status === 'LOST' ||
    status === 'CANCELLED'
  )
}

/** Laporan yang sudah diserahkan tidak perlu diingatkan lagi. */
export function isDeliverableDone(entity: DeliverableInput): boolean {
  return (
    entity.submittedAt !== null ||
    entity.status === 'SUBMITTED' ||
    entity.status === 'APPROVED'
  )
}

/** Termin yang sudah diinvoice/dibayar tidak perlu peringatan penagihan. */
export function isTerminBilled(status: string): boolean {
  return status === 'INVOICED' || status === 'PAID'
}

/** Hanya invoice yang benar-benar belum dibayar yang ditagih. */
export function isInvoiceSettled(entity: InvoiceInput): boolean {
  return (
    entity.paidAt !== null ||
    entity.status === 'PAID' ||
    entity.status === 'CANCELLED'
  )
}

/** Hanya laporan (draft/final) yang masuk aturan TECHNICAL_DEADLINE. */
export function isReportDeliverable(type: string): boolean {
  return type === 'DRAFT_REPORT' || type === 'FINAL_REPORT'
}

// ------------------------------------------------------------ ATURAN 1..6

function recipientsFor(
  category: NotificationCategory,
  userIds: string[] = [],
): RecipientSpec {
  const base = CATEGORY_RECIPIENTS[category]
  return { divisions: base.divisions, roles: base.roles, userIds }
}

/** 1. TENDER_DEADLINE — H-3 & H-1 sebelum penutupan unggah dokumen. */
export function planTenderDeadline(tender: TenderInput): PlannedNotification[] {
  if (isTenderSettled(tender.status)) return []
  const deadline = formatJakartaDate(tender.submissionDeadline)
  return CATEGORY_OFFSETS.TENDER_DEADLINE.map((offsetDays) => ({
    category: 'TENDER_DEADLINE' as const,
    entityType: 'Tender' as const,
    entityId: tender.id,
    offsetDays,
    triggerAt: computeTriggerDate(tender.submissionDeadline, offsetDays),
    title: `${describeOffset(offsetDays)} batas unggah dokumen tender ${tender.code}`,
    message:
      `Tender ${tender.code} — ${tender.title} ditutup pada ${deadline}. ` +
      `Sisa waktu unggah dokumen tinggal ${Math.abs(offsetDays)} hari.`,
    action: REQUIRED_ACTIONS.TENDER_DEADLINE,
    recipients: recipientsFor('TENDER_DEADLINE'),
  }))
}

/** 2. TECHNICAL_DEADLINE — H-14, H-7, H-3 sebelum penyerahan laporan. */
export function planTechnicalDeadline(
  deliverable: DeliverableInput,
): PlannedNotification[] {
  if (!isReportDeliverable(deliverable.type)) return []
  if (isDeliverableDone(deliverable)) return []
  if (isProjectClosed(deliverable.project.status)) return []
  const due = formatJakartaDate(deliverable.dueDate)
  return CATEGORY_OFFSETS.TECHNICAL_DEADLINE.map((offsetDays) => ({
    category: 'TECHNICAL_DEADLINE' as const,
    entityType: 'Deliverable' as const,
    entityId: deliverable.id,
    offsetDays,
    triggerAt: computeTriggerDate(deliverable.dueDate, offsetDays),
    title: `${describeOffset(offsetDays)} penyerahan ${deliverable.name} — proyek ${deliverable.project.code}`,
    message:
      `Laporan "${deliverable.name}" pada proyek ${deliverable.project.code} ` +
      `(${deliverable.project.name}) harus diserahkan paling lambat ${due}.`,
    action: REQUIRED_ACTIONS.TECHNICAL_DEADLINE,
    recipients: recipientsFor('TECHNICAL_DEADLINE'),
  }))
}

/**
 * 3. INVOICING — H-3 sebelum tanggal penagihan terjadwal, DAN segera saat
 * milestone tercapai. Pemicu milestone dicatat sebagai offsetDays 0 dengan
 * basis milestoneMetAt supaya tetap unik terhadap constraint
 * [category, entityId, offsetDays].
 */
export function planInvoicing(termin: TerminInput): PlannedNotification[] {
  if (isTerminBilled(termin.status)) return []
  if (isProjectClosed(termin.project.status)) return []

  const planned = formatJakartaDate(termin.plannedDate)
  const results: PlannedNotification[] = [
    {
      category: 'INVOICING',
      entityType: 'Termin',
      entityId: termin.id,
      offsetDays: -3,
      triggerAt: computeTriggerDate(termin.plannedDate, -3),
      title: `H-3 penagihan Termin ${termin.sequence} — proyek ${termin.project.code}`,
      message:
        `Termin ${termin.sequence} (${termin.name}) proyek ${termin.project.code} ` +
        `dijadwalkan ditagih pada ${planned}.`,
      action: REQUIRED_ACTIONS.INVOICING,
      recipients: recipientsFor('INVOICING'),
    },
  ]

  if (termin.milestoneMetAt !== null) {
    results.push({
      category: 'INVOICING',
      entityType: 'Termin',
      entityId: termin.id,
      offsetDays: 0,
      triggerAt: computeTriggerDate(termin.milestoneMetAt, 0),
      title: `Milestone tercapai — tagih Termin ${termin.sequence} proyek ${termin.project.code}`,
      message:
        `Milestone Termin ${termin.sequence} (${termin.name}) proyek ` +
        `${termin.project.code} tercapai pada ${formatJakartaDate(termin.milestoneMetAt)}. ` +
        `Penagihan dapat langsung diproses.`,
      action: REQUIRED_ACTIONS.INVOICING,
      recipients: recipientsFor('INVOICING'),
    })
  }

  return results
}

/** 4. PAYMENT_OVERDUE — H-3 pre-due dan H+1 overdue, hanya yang belum lunas. */
export function planPaymentOverdue(
  invoice: InvoiceInput,
): PlannedNotification[] {
  if (isInvoiceSettled(invoice)) return []
  if (isProjectClosed(invoice.termin.project.status)) return []
  const due = formatJakartaDate(invoice.dueDate)
  return CATEGORY_OFFSETS.PAYMENT_OVERDUE.map((offsetDays) => ({
    category: 'PAYMENT_OVERDUE' as const,
    entityType: 'Invoice' as const,
    entityId: invoice.id,
    offsetDays,
    triggerAt: computeTriggerDate(invoice.dueDate, offsetDays),
    title:
      offsetDays < 0
        ? `H-3 jatuh tempo Invoice ${invoice.number}`
        : `Invoice ${invoice.number} lewat jatuh tempo`,
    message:
      offsetDays < 0
        ? `Invoice ${invoice.number} (proyek ${invoice.termin.project.code}) jatuh tempo pada ${due} dan belum dibayar.`
        : `Invoice ${invoice.number} (proyek ${invoice.termin.project.code}) telah melewati jatuh tempo ${due} dan belum dibayar.`,
    action: REQUIRED_ACTIONS.PAYMENT_OVERDUE,
    recipients: recipientsFor('PAYMENT_OVERDUE'),
  }))
}

/** 5. CONTRACT_EXPIRY — H-30 dan H-14 sebelum tanggal akhir proyek. */
export function planContractExpiry(
  project: ProjectInput,
): PlannedNotification[] {
  if (isProjectClosed(project.status)) return []
  const end = formatJakartaDate(project.endDate)
  return CATEGORY_OFFSETS.CONTRACT_EXPIRY.map((offsetDays) => ({
    category: 'CONTRACT_EXPIRY' as const,
    entityType: 'Project' as const,
    entityId: project.id,
    offsetDays,
    triggerAt: computeTriggerDate(project.endDate, offsetDays),
    title: `${describeOffset(offsetDays)} berakhirnya kontrak proyek ${project.code}`,
    message:
      `Kontrak proyek ${project.code} (${project.name}) berakhir pada ${end}. ` +
      `Segera tentukan perpanjangan atau penutupan.`,
    action: REQUIRED_ACTIONS.CONTRACT_EXPIRY,
    recipients: recipientsFor('CONTRACT_EXPIRY'),
  }))
}

/** 6. CERTIFICATE_EXPIRY — H-60 sebelum sertifikat personel kedaluwarsa. */
export function planCertificateExpiry(
  certification: CertificationInput,
): PlannedNotification[] {
  // Personel non-aktif tidak perlu recertification.
  if (!certification.personnel.isActive) return []
  const expires = formatJakartaDate(certification.expiresAt)
  // Personel bersangkutan ikut menerima bila punya akun user.
  const userIds =
    certification.personnel.userId === null
      ? []
      : [certification.personnel.userId]
  return CATEGORY_OFFSETS.CERTIFICATE_EXPIRY.map((offsetDays) => ({
    category: 'CERTIFICATE_EXPIRY' as const,
    entityType: 'Certification' as const,
    entityId: certification.id,
    offsetDays,
    triggerAt: computeTriggerDate(certification.expiresAt, offsetDays),
    title: `${describeOffset(offsetDays)} kedaluwarsa sertifikat ${certification.name} — ${certification.personnel.fullName}`,
    message:
      `Sertifikat ${certification.name} (${certification.issuer}) atas nama ` +
      `${certification.personnel.fullName} berlaku sampai ${expires}.`,
    action: REQUIRED_ACTIONS.CERTIFICATE_EXPIRY,
    recipients: recipientsFor('CERTIFICATE_EXPIRY', userIds),
  }))
}

/** Kunci idempotensi, mencerminkan unique constraint di database. */
export function notificationKey(planned: {
  category: string
  entityId: string
  offsetDays: number
}): string {
  return `${planned.category}|${planned.entityId}|${planned.offsetDays}`
}
