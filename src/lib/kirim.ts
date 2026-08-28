'use client'

/**
 * Pembungkus pemanggilan API untuk formulir.
 *
 * Galat aturan bisnis dari server (HTTP 422) dikembalikan sebagai pesan siap
 * tampil, bukan dilempar — pesan itu memang ditulis untuk dibaca pengguna,
 * misalnya "Invoice tidak dapat terbit sebelum BAP terverifikasi."
 */

export interface HasilKirim<T> {
  ok: boolean
  data?: T
  pesan?: string
  kode?: string
}

export async function kirim<T>(
  url: string,
  method: 'POST' | 'PATCH' | 'DELETE',
  body?: unknown,
): Promise<HasilKirim<T>> {
  let res: Response
  try {
    res = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    return { ok: false, pesan: 'Tidak dapat menghubungi server. Periksa koneksi Anda.' }
  }

  const isi = await res.json().catch(() => null)

  if (!res.ok) {
    return {
      ok: false,
      pesan: isi?.error?.message ?? 'Permintaan gagal diproses.',
      kode: isi?.error?.code,
    }
  }

  return { ok: true, data: isi?.data as T }
}
