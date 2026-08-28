/**
 * Nilai domain bersama. Semua string status/kategori didefinisikan di sini
 * supaya lapisan UI tidak pernah menebak-nebak nilainya.
 */

export const ROLES = ['DIREKTUR', 'FINANCE_MANAGER', 'PROJECT_MANAGER', 'STAFF'] as const
export type Role = (typeof ROLES)[number]

export const DIVISIONS = [
  'MARKETING',
  'ADMIN_LEGAL',
  'FINANCE',
  'TEKNIS',
  'HR',
  'MANAJEMEN',
] as const
export type Division = (typeof DIVISIONS)[number]

export const TENDER_STATUSES = [
  'IDENTIFIED',
  'PREPARING',
  'SUBMITTED',
  'WON',
  'LOST',
  'CANCELLED',
] as const
export type TenderStatus = (typeof TENDER_STATUSES)[number]

export const PROJECT_STATUSES = [
  'PREPARATION',
  'RUNNING',
  'REPORTING',
  'CLOSING',
  'CLOSED',
  'CANCELLED',
] as const
export type ProjectStatus = (typeof PROJECT_STATUSES)[number]

/** Pola 1 = biaya tender (hangus bila kalah). Pola 2 = biaya proyek (HPP). */
export const COST_PATTERNS = ['BIDDING', 'PROJECT'] as const
export type CostPattern = (typeof COST_PATTERNS)[number]

export const NOTIFICATION_CATEGORIES = [
  'TENDER_DEADLINE',
  'TECHNICAL_DEADLINE',
  'INVOICING',
  'PAYMENT_OVERDUE',
  'CONTRACT_EXPIRY',
  'CERTIFICATE_EXPIRY',
] as const
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number]

/** Kesalahan aturan bisnis — dipetakan ke HTTP 422 di lapisan API. */
export class BusinessRuleError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message)
    this.name = 'BusinessRuleError'
  }
}
