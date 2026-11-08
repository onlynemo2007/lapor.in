# Saran: batas waktu input & keamanan menu Sinkronisasi

Ditulis 5 November 2026 · untuk Tim Dukman (PSSSDMKP) · aplikasi Lapor.in

> **Status: Paket 2 + bagian tampilan Paket 1 sudah dikerjakan** (skrip v2.2, commit menyusul di
> riwayat git). Yang aktif sekarang: kunci minggu otomatis berbasis judul tab, PIN admin diverifikasi
> skrip, nama pengisi wajib, batas ukuran/frekuensi kiriman, anti-timpa per sel (kegiatan & rencana),
> dan pemisahan menu Sinkronisasi (token tersamar, aksi berisiko di balik mode admin). Paket 3
> (kode akses per pegawai) belum dikerjakan.

## Ringkasan

- **Jangan batasi jam input.** Yang lebih tepat dibatasi adalah **periode (minggu)**, **identitas penginput**, dan **tumpang-tindih tulisan** — bukan pukul berapa orang mengetik.
- **Menu Sinkronisasi belum aman ditampilkan apa adanya.** Bukan karena isinya bisa menghapus sheet, tetapi karena: token tampil dalam teks biasa, tautan berisi token bisa disalin, dan ada 3 tombol berisiko data (kirim ulang semua, tandai sudah ditempel, buat minggu baru) yang bisa ditekan siapa saja.
- Catatan jujur: sejak koneksi dipasang lewat build (`VITE_TOKEN`), **token ada di dalam berkas aplikasi**. Jadi menyembunyikan menu itu hanya mencegah kecelakaan dan rasa ingin tahu — pengamanan sebenarnya harus di sisi skrip (server-side).

---

## A. Batas input: jam kerja bukan alat yang tepat

Pegawai bisa mengisi malam, akhir pekan, atau dari rumah. Memblokir di luar 08.00–16.00 akan membuat laporan justru tidak masuk. Yang saya sarankan:

| Prioritas | Pembatasan | Kenapa perlu | Cara teknis |
|---|---|---|---|
| **1** | **Kunci per minggu** (periode rekap), bukan per jam | Setelah rekap minggu diserahkan, isi minggu itu tidak boleh berubah lagi — ini yang benar-benar mencegah "laporan minggu lalu tiba-tiba berubah" | Daftar gid terkunci di Script Properties / tab `_konfig`; skrip menolak tulisan ke gid terkunci; aplikasi menampilkan tab itu mode baca. Admin bisa buka–kunci. |
| **2** | **Identitas wajib sebelum kirim** | Audit sekarang mencatat `oleh` yang bisa kosong / asal ketik, jadi tidak bisa dipertanggungjawabkan | Aplikasi menolak menulis bila nama/tim kosong; skrip menolak `oleh` kosong dan mencocokkan ke daftar nama (`_pengguna`) |
| **3** | **Anti-timpa (konflik tulis)** | Hari ini dua orang yang membuka bersamaan bisa saling menimpa sel; "kirim ulang semua" bisa menimpa satu tab dengan salinan lama | Aplikasi mengirim `nilaiLama` per sel; skrip membandingkan, menolak yang sudah berubah; aplikasi menampilkan "sel ini baru diubah rekan — muat ulang" |
| **4** | **Batas ukuran & frekuensi kiriman** | Mencegah kiriman raksasa (mis. 1.000 sel) dan spam tombol | Skrip: maksimum ±300 sel per kiriman, maksimum N kiriman/menit per token |
| **5** | **Aksi berisiko hanya admin** | "Kirim ulang semua isian" & "tandai sudah ditempel" & "buat minggu baru" bukan aksi harian pegawai | PIN admin diverifikasi skrip untuk aksi `buatTab`, `kirimPenuh`, `sisip` massal |
| **6** | **Audit per orang + cadangan harian** | Jaring pengaman terakhir kalau ada yang salah tulis | `_audit` sudah ada; tambah cadangan otomatis harian ke spreadsheet arsip |
| 7 (opsional) | **Hanya sel timnya sendiri** | Kalau ingin tiap tim mandiri dan tidak menyentuh tim lain | Token/kode per tim, skrip mencocokkan `tim` dengan kode |
| 8 (kalau tetap mau jam) | **Mode lembut, bukan blokir** | Tidak menghambat, tetapi kelihatan di audit | Tandai kiriman di luar 05.00–23.00 WIB pada `_audit` sebagai catatan, bukan penolakan |

**Kesimpulan A:** pakai **batas hari/periode**, bukan batas jam. Kalau tetap ingin sentuhan jam, cukup jadi penanda audit.

---

## B. Menu Sinkronisasi: apa yang terpapar sekarang

| Yang ada di menu | Terpapar ke | Risiko | Saran |
|---|---|---|---|
| URL Web App + **token dalam teks biasa** | semua pegawai | **Tinggi** — bisa disalin, dipakai di luar aplikasi, disebar ke grup lain | Samarkan (`••••••••`), tombol "tampilkan" hanya admin |
| **"Salin tautan siap pakai"** (berisi token) | semua pegawai | **Tinggi** — satu klik menyebarkan kunci tulis sheet | Khusus admin |
| **"Kirim ulang semua isian"** | semua pegawai | **Tinggi** — menulis ulang seluruh tab dari salinan lokal (bisa menimpa kerja rekan) | Khusus admin + konfirmasi teks |
| **"Tandai sudah ditempel"** | semua pegawai | Sedang — isian lepas dari antrean tanpa masuk sheet | Khusus admin |
| **"Buat minggu baru"** | semua pegawai | Sedang — tab dobel / struktur salah | Khusus admin |
| **"Putuskan koneksi", ganti URL/token** | semua pegawai | Sedang — perangkat diam-diam berhenti mengirim ("kok data saya tidak masuk") | Tetap ada untuk pegawai, tapi beri konfirmasi + spanduk peringatan (sudah ada) |
| **"Salin kode skrip"** | semua pegawai | Rendah — kode bukan rahasia, tapi mengundang orang mengubah skrip | Boleh tetap; sebaiknya hanya admin |
| Log sinkron, versi skrip, "Sinkronkan sekarang", "Muat ulang", "Tes koneksi" | semua pegawai | Rendah | **Pertahankan** untuk semua — ini yang membuat pegawai bisa memulihkan diri sendiri |

**Jawaban singkat:** menu Sinkronisasi **perlu dipecah dua**, bukan disembunyikan total.

- **Untuk semua pegawai — "Status & sinkron"**: status koneksi, sinkronkan sekarang, muat ulang, tes koneksi, penyambungan perangkat.
- **Untuk admin — "Pengaturan lanjutan"**: URL/token (tersamar), tautan siap pakai, buat minggu baru, kirim ulang semua, tandai sudah ditempel, kode skrip, kunci/buka minggu.

Alasannya: pegawai tetap butuh jalan keluar saat sinkron macet (kalau semua disembunyikan, mereka akan menghubungi Anda terus), tetapi mereka tidak butuh kunci sheet.

---

## C. Tiga paket pengerjaan

**Paket 1 — Rapi & anti-kecelakaan** (perubahan tampilan saja, 1 sesi)
- Token disamarkan, tautan siap pakai hanya admin.
- Tombol berisiko pindah ke "Mode admin" (PIN lokal, sesi 8 jam).
- Konfirmasi teks pada "Kirim ulang semua isian".
- Efek: mencegah ±90% kecelakaan; **tidak** menahan orang yang paham teknis.

**Paket 2 — Aman dari dalam skrip** ← rekomendasi
- PIN admin **diverifikasi skrip** (bukan hanya UI) untuk `buatTab`, `kirimPenuh`, sisip massal.
- `oleh` wajib & dicocokkan ke daftar nama/tim.
- Batas ukuran payload + rate limit; `d.sel` dibatasi hanya di dalam tabel yang dikenal.
- Anti-timpa per sel (`nilaiLama`) + pesan konflik di aplikasi.
- Kunci/buka minggu (`_konfig`), aplikasi menandai minggu terkunci.
- Skrip naik ke v2.2 (perlu "Versi baru" deployment, URL `/exec` tidak berubah).

**Paket 3 — Kode akses per pegawai** (kalau nanti tim membesar / data sensitif)
- Tiap orang punya kode 6–8 karakter → dipetakan ke nama + tim.
- Token bersama **dihapus** dari bundle; hak tulis dibatasi ke timnya; audit per orang.
- Konsekuensi: setiap perangkat isi kode sekali lagi, dan perangkat baru tidak otomatis tersambung tanpa kode.

---

## D. Bisa Anda kerjakan hari ini, tanpa mengubah aplikasi

1. **Google Sheet → Bagikan → "Siapa pun yang punya link" = Pelihat** (bukan Editor). Aplikasi menulis lewat skrip yang berjalan sebagai Anda, jadi editor tidak diperlukan. Ini menutup celah terbesar: orang mengedit sheet langsung tanpa tercatat di `_audit`.
2. **Proteksi rentang**: baris judul, sel rumus, dan tab `_audit` → Data → Proteksi rentang.
3. **Cadangan**: Apps Script trigger harian menyalin tab aktif ke spreadsheet arsip (atau File → Buat salinan tiap Jumat).
4. **Imbauan tim**: jangan menyebar tautan aplikasi ke luar tim, jangan menekan "Kirim ulang semua isian" kecuali diminta.
5. **Rotasi token** kalau tautan sudah beredar luas (token kini ada di berkas aplikasi): ganti `TOKEN` di skrip → Versi baru → perbarui `VITE_TOKEN` di Vercel → Redeploy.

---

## E. Rekomendasi akhir

1. **Hari ini:** D1 (sheet jadi Pelihat) + D2 (proteksi `_audit` & rumus).
2. **Berikutnya:** Paket 2 — karena inti masalahnya bukan "pegawai melihat menu", melainkan "siapa pun yang memegang token bisa menulis apa saja, dan tulisan bisa saling menimpa".
3. **Paket 1** dikerjakan bersamaan Paket 2 (bagian tampilannya).
4. **Paket 3** ditunda sampai tim benar-benar butuh pemisahan hak per orang.

Yang **tidak** saya sarankan: memblokir input di luar jam kerja. Itu menghambat orang jujur tanpa menahan yang tidak jujur, karena kunci tulisnya ada di berkas aplikasi.
