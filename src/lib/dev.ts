/**
 * Gerbang fitur khusus pengembangan.
 *
 * Pengalihan akun tanpa kata sandi sangat memudahkan saat membangun, tetapi
 * bila ikut terbawa ke server produksi artinya siapa pun bisa masuk sebagai
 * Direktur. Karena itu gerbangnya dua lapis dan keduanya harus terpenuhi:
 *
 * 1. Bukan build produksi.
 * 2. Dinyalakan eksplisit lewat DEV_ACCOUNT_SWITCHER=1.
 *
 * Lapis pertama saja sudah cukup untuk mencegah kecelakaan; lapis kedua
 * membuat penyalaannya menjadi tindakan sadar, bukan bawaan.
 */
export function pengalihAkunAktif(): boolean {
  return process.env.NODE_ENV !== 'production' && process.env.DEV_ACCOUNT_SWITCHER === '1'
}
