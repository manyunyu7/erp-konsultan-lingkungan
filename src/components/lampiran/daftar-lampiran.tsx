'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  FileSpreadsheet,
  FileText,
  ImageIcon,
  Paperclip,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/field'
import { cn, tanggal } from '@/lib/utils'
import { ALLOWED_TYPES, MAX_SIZE_BYTES, formatSize } from '@/server/attachments/rules'

/** Bentuk lampiran yang dibutuhkan antarmuka — sengaja tidak memakai tipe Prisma
 *  karena komponen ini berjalan di peramban dan hanya menerima data terserialisasi. */
export interface LampiranTampil {
  id: string
  originalName: string
  caption: string | null
  mimeType: string
  sizeBytes: number
  createdAt: string
  uploadedByName: string
}

const JENIS_DITERIMA = Object.keys(ALLOWED_TYPES).join(',')
/** Berkas terpilih beserta objectURL pratinjaunya (hanya untuk gambar). */
interface Terpilih {
  file: File
  url: string | null
}

const MAX_MB = Math.round(MAX_SIZE_BYTES / 1024 / 1024)

function isGambar(mimeType: string): boolean {
  return mimeType.startsWith('image/')
}

function isPdf(mimeType: string): boolean {
  return mimeType === 'application/pdf'
}

function IkonBerkas({ mimeType, className }: { mimeType: string; className?: string }) {
  if (isGambar(mimeType)) return <ImageIcon className={className} aria-hidden />
  if (isPdf(mimeType)) return <FileText className={className} aria-hidden />
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) {
    return <FileSpreadsheet className={className} aria-hidden />
  }
  if (mimeType.includes('word')) return <FileText className={className} aria-hidden />
  return <Paperclip className={className} aria-hidden />
}

export function DaftarLampiran({
  entityType,
  entityId,
  bolehUnggah,
  awal,
}: {
  entityType: string
  entityId: string
  bolehUnggah: boolean
  awal: LampiranTampil[]
}) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const dialogRef = useRef<HTMLDialogElement | null>(null)

  const [terpilih, setTerpilih] = useState<Terpilih | null>(null)
  const [mengunggah, setMengunggah] = useState(false)
  const [galat, setGalat] = useState<string | null>(null)
  const [seret, setSeret] = useState(false)
  const [menghapus, setMenghapus] = useState<string | null>(null)
  const [dibuka, setDibuka] = useState<LampiranTampil | null>(null)

  // objectURL memegang memori berkas sampai dibebaskan; ref ini memastikan
  // pratinjau yang masih hidup ikut dilepas saat komponen dilepas.
  const urlRef = useRef<string | null>(null)
  useEffect(() => {
    return () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    }
  }, [])

  // <dialog> hanya menjadi modal lewat showModal(), bukan lewat atribut.
  useEffect(() => {
    const d = dialogRef.current
    if (!d) return
    if (dibuka && !d.open) d.showModal()
    if (!dibuka && d.open) d.close()
  }, [dibuka])

  function pilihBerkas(daftar: FileList | null) {
    setGalat(null)
    const berkas = daftar && daftar.length > 0 ? daftar[0] : null
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    urlRef.current = berkas && isGambar(berkas.type) ? URL.createObjectURL(berkas) : null
    setTerpilih(berkas ? { file: berkas, url: urlRef.current } : null)
  }

  function bersihkanPilihan() {
    pilihBerkas(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  async function unggah(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!terpilih) {
      setGalat('Pilih berkas terlebih dahulu.')
      return
    }
    const form = e.currentTarget
    const keterangan = String(new FormData(form).get('caption') ?? '').trim()

    setMengunggah(true)
    setGalat(null)

    const muatan = new FormData()
    muatan.set('entityType', entityType)
    muatan.set('entityId', entityId)
    muatan.set('file', terpilih.file)
    if (keterangan) muatan.set('caption', keterangan)

    try {
      const res = await fetch('/api/attachments', { method: 'POST', body: muatan })
      const isi = await res.json().catch(() => null)
      if (!res.ok) {
        // Pesan server memang ditulis untuk dibaca orang, jadi ditampilkan apa adanya.
        setGalat(isi?.error?.message ?? 'Berkas gagal diunggah.')
        return
      }
      form.reset()
      bersihkanPilihan()
      router.refresh()
    } catch {
      setGalat('Tidak dapat menghubungi server. Periksa koneksi Anda.')
    } finally {
      setMengunggah(false)
    }
  }

  async function hapus(lampiran: LampiranTampil) {
    if (!window.confirm(`Hapus berkas "${lampiran.originalName}"?`)) return
    setMenghapus(lampiran.id)
    setGalat(null)
    try {
      const res = await fetch(`/api/attachments/${lampiran.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const isi = await res.json().catch(() => null)
        setGalat(isi?.error?.message ?? 'Berkas gagal dihapus.')
        return
      }
      router.refresh()
    } catch {
      setGalat('Tidak dapat menghubungi server. Periksa koneksi Anda.')
    } finally {
      setMenghapus(null)
    }
  }

  return (
    <div className="flex flex-col gap-gap">
      {awal.length === 0 ? (
        <p className="text-sm text-muted-foreground">Belum ada berkas terlampir.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {awal.map((l) => (
            <li key={l.id} className="flex flex-col gap-2 rounded-md border p-3">
              <button
                type="button"
                onClick={() => setDibuka(l)}
                className="flex h-28 w-full items-center justify-center overflow-hidden rounded-md border bg-muted transition hover:opacity-90"
                aria-label={`Pratinjau ${l.originalName}`}
              >
                {isGambar(l.mimeType) ? (
                  // eslint-disable-next-line @next/next/no-img-element -- berkas privat disajikan lewat route berizin, bukan aset statis
                  <img
                    src={`/api/attachments/${l.id}/berkas`}
                    alt={l.caption ?? l.originalName}
                    className="max-h-28 max-w-full object-contain"
                  />
                ) : (
                  <IkonBerkas mimeType={l.mimeType} className="size-8 text-muted-foreground" />
                )}
              </button>

              <div className="flex flex-col gap-0.5">
                <span className="truncate text-sm font-medium" title={l.originalName}>
                  {l.originalName}
                </span>
                {l.caption && (
                  <span className="line-clamp-2 text-xs text-muted-foreground">{l.caption}</span>
                )}
                <span className="text-xs text-muted-foreground">
                  {formatSize(l.sizeBytes)} · {l.uploadedByName} · {tanggal(l.createdAt)}
                </span>
              </div>

              <div className="flex items-center justify-between gap-2">
                <a
                  href={`/api/attachments/${l.id}/berkas`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                >
                  Buka berkas
                </a>
                {bolehUnggah && (
                  <button
                    type="button"
                    onClick={() => hapus(l)}
                    disabled={menghapus === l.id}
                    className="inline-flex items-center gap-1 text-xs text-destructive hover:underline disabled:opacity-50"
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                    {menghapus === l.id ? 'Menghapus…' : 'Hapus'}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {bolehUnggah && (
        <form onSubmit={unggah} className="flex flex-col gap-3">
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setSeret(true)
            }}
            onDragLeave={() => setSeret(false)}
            onDrop={(e) => {
              e.preventDefault()
              setSeret(false)
              pilihBerkas(e.dataTransfer.files)
            }}
            className={cn(
              'flex flex-col items-center gap-2 rounded-md border border-dashed p-pad text-center transition',
              seret && 'border-[var(--ring)] bg-accent',
            )}
          >
            <Upload className="size-5 text-muted-foreground" aria-hidden />
            <p className="text-sm">Seret berkas ke sini, atau pilih dari perangkat.</p>
            <p className="text-xs text-muted-foreground">
              PDF, gambar (JPG/PNG/WebP), Word, atau Excel · maksimal {MAX_MB} MB
            </p>
            <input
              ref={inputRef}
              type="file"
              name="file"
              accept={JENIS_DITERIMA}
              onChange={(e) => pilihBerkas(e.target.files)}
              className="mt-1 block w-full max-w-sm text-xs text-muted-foreground file:mr-3 file:rounded-md file:border file:bg-secondary file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-secondary-foreground"
            />
          </div>

          {terpilih && (
            <div className="flex items-center gap-3 rounded-md border p-3">
              {terpilih.url ? (
                // eslint-disable-next-line @next/next/no-img-element -- pratinjau lokal dari objectURL, bukan aset yang bisa dioptimalkan
                <img
                  src={terpilih.url}
                  alt="Pratinjau berkas terpilih"
                  className="size-14 rounded-md border object-cover"
                />
              ) : (
                <IkonBerkas
                  mimeType={terpilih.file.type}
                  className="size-6 shrink-0 text-muted-foreground"
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{terpilih.file.name}</p>
                <p className="text-xs text-muted-foreground">{formatSize(terpilih.file.size)}</p>
              </div>
              <button
                type="button"
                onClick={bersihkanPilihan}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Batalkan pilihan berkas"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>
          )}

          <Input name="caption" placeholder="Keterangan (opsional)" maxLength={200} />

          {galat && <p className="text-sm text-destructive">{galat}</p>}

          <div className="flex justify-end">
            <Button type="submit" ukuran="sm" disabled={mengunggah || !terpilih}>
              {mengunggah ? 'Mengunggah…' : 'Unggah berkas'}
            </Button>
          </div>
        </form>
      )}

      <dialog
        ref={dialogRef}
        onClose={() => setDibuka(null)}
        onClick={(e) => {
          // Klik di luar isi menutup pratinjau, kebiasaan umum jendela modal.
          if (e.target === dialogRef.current) setDibuka(null)
        }}
        className="m-auto w-[min(56rem,92vw)] rounded-lg border bg-card p-pad text-card-foreground backdrop:bg-foreground/50"
      >
        {dibuka && (
          <div className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{dibuka.originalName}</p>
                {dibuka.caption && (
                  <p className="text-xs text-muted-foreground">{dibuka.caption}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setDibuka(null)}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Tutup pratinjau"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>

            {isGambar(dibuka.mimeType) ? (
              // eslint-disable-next-line @next/next/no-img-element -- berkas privat disajikan lewat route berizin
              <img
                src={`/api/attachments/${dibuka.id}/berkas`}
                alt={dibuka.caption ?? dibuka.originalName}
                className="max-h-[70vh] w-full rounded-md object-contain"
              />
            ) : isPdf(dibuka.mimeType) ? (
              <iframe
                src={`/api/attachments/${dibuka.id}/berkas`}
                title={dibuka.originalName}
                className="h-[70vh] w-full rounded-md border"
              />
            ) : (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <IkonBerkas mimeType={dibuka.mimeType} className="size-10 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Jenis berkas ini tidak dapat dipratinjau di peramban.
                </p>
                <a
                  href={`/api/attachments/${dibuka.id}/berkas`}
                  className="text-sm underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  Unduh berkas
                </a>
              </div>
            )}
          </div>
        )}
      </dialog>
    </div>
  )
}
