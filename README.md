# lapor.in

Dashboard & pengisian laporan mingguan Tim Dukman (PSSSDMKP, KKP) yang tersambung langsung ke Google Sheet
“Laporan Mingguan Tim Dukman”.

## Sinkronisasi otomatis (tanpa menyalin manual)

Setiap isian yang disimpan di aplikasi **langsung ditulis ke tab Google Sheet** yang sedang dibuka — tidak perlu
menyalin blok, tidak perlu menekan tombol “Kirim”.

- Kiriman berjalan ±1 detik setelah isian terakhir (jeda tulis), hanya untuk sel yang berubah.
- Bila koneksi putus atau skrip gagal, isian tetap tersimpan di perangkat dan dikirim ulang otomatis
  (4 s → 10 s → 25 s → 60 s), lalu bisa diulang manual dari menu **Sinkronisasi**.
- Status sinkron selalu tampil di bilah atas: *Mengirim ke Sheet… · Sheet terbarui 12.04 · Gagal sinkron*.
- Bila balasan Apps Script tidak bisa dibaca browser, aplikasi memverifikasi ulang ke sheet sebelum
  menandai isian terkirim.

### Link bukti data dukung (lampiran)

Tautan bukti dukung ditulis **pada baris tanggalnya masing-masing** di kolom lampiran (J/K):

| Baris | Tanggal | Kolom lampiran |
|---|---|---|
| 44 | 2 November 2026 | `2 November 2026: https://…AAA/view` |
| 45 | 3 November 2026 | `3 November 2026: https://…BBB/view` |
| 46 | 4 November 2026 | `4 November 2026: https://…CCC/view` |

- Tanggal berbeda → **baris berbeda**; tidak ada yang ditumpuk jadi satu sel dan tidak ada yang saling menimpa.
- Dua tautan (atau lebih) untuk tanggal yang sama ditulis sebagai dua baris teks **di sel tanggal itu**.
- Sel lampiran yang tadinya **digabung (merge)** antar tanggal dibuka otomatis, lalu tautan lama disebar ke
  baris tanggalnya sesuai penanda tanggal — tidak ada tautan yang hilang, dan format sheet lain tidak disentuh.
- Menambah tautan **tidak pernah menghapus** tautan lain: skrip membaca isi baris lebih dulu, baru menambahkan.
  Satu tanggal hanya diganti bila Anda menekan tombol hapus untuk tanggal itu (aplikasi mengirim `gabung:false`).
- Format lama (bernomor `1. … 2. …`, atau tautan tanpa tanggal) tetap dikenali dan dipertahankan; tautan yang
  sama tidak digandakan, hanya dilengkapi tanggalnya bila masih kosong.
- Menempel beberapa tautan sekaligus (baris baru, spasi, atau koma) langsung dipecah dan dirapikan.

### Realisasi keuangan (bagian D)

Menu **Realisasi Keuangan** (sebelah Presensi) dipakai mengisi bagian D langsung dari aplikasi:

- Setiap kode kegiatan ditampilkan satu baris: **Kode · Uraian · Pagu · Realisasi · % serapan**.
- Ubah **pagu**, **realisasi**, atau uraiannya, lalu tekan **Simpan** — nilainya ditulis ke baris yang sama
  di sheet. Pencocokan memakai **kode kegiatan**, jadi aman bila ada baris/kolom yang disisipkan.
- Angka ditulis sebagai **angka** (bukan teks), sehingga format rupiah dan rumus total di sheet tetap bekerja.
  Baris **Total** tidak pernah ditimpa aplikasi.
- Ringkasan total pagu, total realisasi, dan % serapan tampil di atas, plus pencarian kode/uraian.
- Bagian ini juga ikut tercetak di **Pratinjau & Cetak** (tabel “D. Realisasi Keuangan” dengan total).
- Kode yang tidak ditemukan di sheet dilaporkan sebagai baris gagal (tidak menulis ke baris lain).

### Minggu baru (tab minggu berikutnya)

Menu **Sinkronisasi → Minggu baru** (atau tombol **+ Minggu baru** di bilah atas) membuat tab baru
di spreadsheet tanpa membuka Google Sheets:

- **Struktur disalin** dari tab yang dipilih: judul bagian, judul kolom, nama tim, format, lebar kolom,
  rumus, dan tabel realisasi anggaran — jadi tampilannya identik dengan minggu sebelumnya.
- **Isian dikosongkan**: uraian kegiatan (A), rencana (B), tautan bukti dukung (J/K), angka kehadiran (C),
  serta angka aplikasi presensi. Baris, tim, dan judul tidak dihapus.
- **Tanggal digeser +7 hari** (kolom Tanggal bagian A/C/P dan rentang tanggal di baris judul) sehingga
  tab baru langsung berisi tanggal minggu berikutnya. Pilihan “Biarkan sama” mempertahankan tanggal lama.
- **Nama tab disarankan otomatis** dari tanggal terakhir (mis. `Nov I` → `Nov II`), masih bisa diubah.
- Tab baru diletakkan tepat di samping tab sumber; tab lain tidak disentuh. Setelah dibuat, aplikasi
  otomatis pindah ke tab itu dan isian berikutnya langsung masuk ke tab baru.

Fitur ini memakai aksi `buatTab` pada Apps Script **v1.7**. Bila skrip di spreadsheet masih versi lama,
aplikasi menampilkan peringatan: salin ulang kode dari menu Sinkronisasi, lalu
**Terapkan → Kelola deployment → Edit → Versi baru** (URL `/exec` tidak berubah).

## Penyiapan sekali saja

1. Buka spreadsheet → **Ekstensi → Apps Script**, tempel kode dari menu **Sinkronisasi → Salin kode**
   (ubah `TOKEN` di dalam kode menjadi kode rahasia Anda).
2. **Terapkan → Deployment baru → Aplikasi web**, jalankan sebagai **Saya**, akses **Siapa saja**.
3. Tempel URL yang berakhiran `/exec` + token yang sama di menu **Sinkronisasi**.
4. Aktifkan **Kirim otomatis** (default aktif). Untuk rekan setim: bagikan **tautan siap pakai** dari halaman
   yang sama agar perangkat mereka langsung ikut sinkron tanpa mengisi apa pun.

URL Web App dan token disimpan pada kunci penyimpanan terpisah (`laporin:koneksi`), sehingga **tidak pernah hilang**
saat data mingguan diperbarui, sheet dimuat ulang, aplikasi versi baru dibuka, atau ruang penyimpanan data penuh.
Mengosongkan kolom URL/token juga tidak menghapus koneksi — pemutusan hanya lewat tombol **Putuskan koneksi**.

## Kenapa data rekan bisa tidak sinkron

Tautan aplikasi (`https://laporin-psi.vercel.app/#/dashboard`) **tidak membawa koneksi**. Yang disimpan di
`localStorage` tiap browser adalah: URL Web App + token (`laporin:koneksi`), nama/tim, dan salinan data mingguan.
Akibatnya rekan yang membuka tautan itu di perangkat lain:

- **sheet tetap terbaca** (ekspor CSV publik), jadi angka di dashboard tetap muncul, tetapi
- perangkat itu **belum tersambung untuk menulis** — isian yang diketik tidak pernah masuk sheet (lencana
  “Sinkron otomatis belum aktif”), dan isian lama di perangkat itu bisa menimpa tampilan sheet
  (nilai lokal yang belum terkirim menang atas isi sheet saat penggabungan).

Sejak versi ini ada tiga jalan agar semua perangkat tersambung:

1. **Koneksi bawaan build** — isi Environment Variables `VITE_SCRIPT_URL` (URL `/exec`) dan `VITE_TOKEN`
   di Vercel, lalu deploy ulang. Semua perangkat yang belum pernah menyambung (atau baru) otomatis
   tersambung saat membuka tautan biasa. *Token ikut terbundel di berkas JS, jadi siapa pun yang punya
   tautan aplikasi bisa menulis ke sheet — pakai token khusus dan bagikan tautan hanya ke tim.*
2. **Tautan siap pakai** — menu **Sinkronisasi → Salin tautan siap pakai**, kirim ke rekan. Begitu dibuka,
   perangkat mereka langsung tersambung (tanpa menekan tombol) dan token langsung dibersihkan dari address bar.
3. **Manual** — isi URL `/exec` + token di menu **Sinkronisasi** sekali per perangkat.

Perangkat yang sudah tersambung tidak pernah ditimpa oleh koneksi bawaan/tautan lain, dan tombol
**Putuskan koneksi** tetap dihormati (ada penanda `putus` di `laporin:koneksi`). Bila perangkat belum
tersambung, atau pembacaan sheet terakhir gagal, aplikasi menampilkan spanduk peringatan di atas halaman —
data lama tidak lagi tampil tanpa penjelasan.

Skrip membaca posisi kolom dari baris judul dan mencari baris berdasarkan **tim + tanggal**, sehingga aman
bila ada baris/kolom yang disisipkan. Kolom lampiran dikenali dari judul kolomnya (cadangan: kolom pertama
yang berisi tautan), jadi tab baru yang masih kosong tetap ditulisi di kolom yang benar. Setiap kiriman
dicatat di tab tersembunyi `_audit`.

## Baris rekap bagian D (Apps Script v2.3)

Baris rekap di tabel Realisasi Anggaran (mis. `032.12.DL`, `7948`, `2378`, `2378.EBA`, baris
`Total`) boleh diisi dari aplikasi. Karena sel itu biasanya berisi rumus jumlah di sheet:

- aplikasi meminta konfirmasi lebih dulu (rumus akan diganti angka yang diketik);
- kiriman diberi tanda `paksa: true`, sehingga skrip **hanya** mengganti rumus pada baris yang
  benar-benar diubah pengguna — baris lain tetap dilindungi (angka 0 tidak menimpa isian lama);
- pergantian rumus dilaporkan terpisah (`diganti`) dari kegagalan, jadi tidak dikira gagal kirim.

Skrip **v2.3** wajib dipasang agar `paksa` dihormati; pada v2.2 baris rekap tetap dilaporkan
"tidak ditimpa".

## Halaman pilih saat alamat utama dibuka

Membuka alamat utama (`/` tanpa hash) menampilkan **halaman pilih** (bukan langsung dashboard): dua kartu,
**Laporan Mingguan** (menu di aplikasi ini) dan **Laporan WFH** (aplikasi Apps Script terpisah, dibuka di tab
baru). Alamat aplikasi ini:

| Alamat | Isi |
| --- | --- |
| `/` (tanpa hash) | halaman pilih — tanpa sidebar |
| `/#/isi` | langsung ke Isi laporan mingguan |
| `/#/dashboard` | dashboard (rekap, pratinjau, sinkronisasi lewat menu) |

Logikanya di `src/lib/rute.ts` (`ruteDariHash`, `VIEW_AWAL`); halaman pilih ada di `src/views/LandingView.tsx`
dan dirender di luar `Shell` (`src/App.tsx`). Hash tak dikenal juga diarahkan ke halaman pilih, bukan halaman kosong.
Halaman pilih tidak punya tombol Dashboard di kanan atas — jalan ke dashboard ada di tautan kaki halaman.
Logo di sidebar, logo di bilah atas HP, dan tautan **Halaman pilih** di kaki sidebar membawa kembali ke `/`.

## Tim dalam laporan mingguan

Daftar tim ada di `TIMS` (`src/lib/model.ts`) dan **mengikuti penomoran di sheet**:

| No | Tim |
| --- | --- |
| I–VII | Keuangan, Umum, Arsiparis, Kepegawaian, Program dan Monev, Humas Datin, Hukum |
| VIII | Sertifikasi Kompetensi SDMKP |
| IX | Standardisasi Kompetensi |
| X | Penjamin Mutu LSP |

Tiga tim terakhir (`sertifikasi`, `standardisasi`, `mutu`) tampil di dashboard, isian, rencana, dan pratinjau
sejak v2.4 aplikasi, **tetapi tulisan ke sheet butuh barisnya ada lebih dulu**:

- tab yang belum punya baris tim itu → sel dashboard bertanda **n/a** (dengan keterangan "belum ada di tab"),
  dan form rencana menampilkan "belum ada di sheet" (isian tidak dikirim, jadi tidak ada kiriman gagal);
- begitu baris `VIII. Sertifikasi Kompetensi SDMKP` dan seterusnya ditambahkan di bagian A (5 baris tanggal) dan
  bagian B (1 baris rencana) — di tab mana pun — aplikasi langsung mengenalinya tanpa perubahan kode.
- Menu **Pratinjau & Cetak** punya pilihan kelompok cetak: **Semua** (A–D, sepuluh tim — seperti sebelumnya),
  **Tim Dukman** (tim I–VII) dan **Tim Teknis** (tim VIII–X). Dua pilihan terakhir dicetak terpisah dan
  **hanya sampai tabel B (rencana kegiatan minggu depan)** — bagian C (presensi) dan D (keuangan) tidak ikut.
  Pilihannya tersimpan di alamat: `#/pratinjau?cetak=dukman` atau `#/pratinjau?cetak=teknis`.
- Pemilih tim di Form cepat dan Asisten chat memakai baris yang **membungkus** (flex-wrap), bukan geser
  menyamping — 10 tim tetap terlihat semua tanpa menggeser layar, termasuk di HP.
- Nama tim di sheet dikenali dari kata kuncinya (`sertifikasi`, `standardisasi`, `mutu`), jadi penulisan
  "VIII. Sertifikasi Kompetensi SDM KP" atau "Penjaminan Mutu LSP" tetap terbaca.

## Tautan aplikasi Laporan WFH

Aplikasi **Laporan WFH Pegawai** (Google Apps Script) sengaja **tidak** dijadikan menu di dashboard
ini — ia berdiri sendiri. Tautannya hanya muncul sebagai kartu kedua di halaman pilih
(`src/views/LandingView.tsx`) dan langsung membuka formulir WFH di tab baru (Google menolak
aplikasi Apps Script ditampilkan dalam iframe).

- Alamat formulir: `WFH_URL_BAWAAN` di `src/lib/wfh.ts` (satu-satunya tempat yang perlu diubah
  bila alamat formulir berganti).
- Tautan lama `…/#/wfh` tidak lagi punya halaman sendiri; alamat itu jatuh ke halaman pilih,
  di mana kartu Laporan WFH tetap tersedia.

## Pengamanan (Apps Script v2.2)

Isian tetap boleh dikirim kapan saja (pagi, malam, akhir pekan) — yang dibatasi adalah **periode**,
**identitas**, dan **tumpang-tindih tulisan**, bukan jam. Semua aturan di bawah ditegakkan **di skrip**,
jadi tidak bisa dilewati dari tampilan:

| Aturan | Perilaku |
|---|---|
| **Minggu lama terkunci** | Hanya tab minggu **terbaru** yang bisa ditulisi. Urutan ditentukan dari **judul** tab (`LAPORAN MINGGU II BULAN NOVEMBER 2026`), bukan posisi tab. Minggu lama bisa dibuka admin untuk koreksi. |
| **Nama pengisi wajib** | Kiriman tanpa nama (≥ 2 huruf) ditolak; nama masuk ke tab `_audit`. |
| **Aksi berisiko = admin** | `buatTab`, buka/kunci minggu, dan "kirim ulang seluruh isian" butuh **PIN admin** yang disetel di Script Properties (`PIN_ADMIN`), bukan di kode. |
| **Batas kiriman** | Maksimal 400 sel per kiriman, 60 kiriman / 5 menit, 5 baris baru per kiriman. |
| **Anti-timpa** | Aplikasi mengirim teks sel saat terakhir dibaca; bila isi sheet sudah diubah rekan, skrip **menolak menimpa**, aplikasi memberi tahu dan memuat ulang dari sheet. |

Penyiapan setelah memperbarui ke v2.2 (urutan ini penting — PIN diverifikasi oleh skrip):

1. **Sinkronisasi → Koneksi → Salin kode**, tempel di Apps Script, lalu
   **Terapkan → Kelola deployment → Edit → Versi baru** (URL `/exec` tidak berubah).
   Selama skrip di sheet belum v2.2 (atau `PIN_ADMIN` belum diisi), tombol *Salin kode* sengaja
   tetap terbuka untuk semua pengguna supaya pengurus tidak terkunci di luar; setelah itu tombol
   kembali khusus mode admin.
2. Di Apps Script: **Project Settings (ikon gear) → Script Properties → Add**:
   - `PIN_ADMIN` = kode rahasia admin (wajib; tanpa ini mode admin tidak bisa dibuka)
   - `MINGGU_BUKA` = daftar gid yang dibuka kembali, dipisah koma (dibuat otomatis oleh tombol admin)
3. **Sinkronisasi → Mode admin**: masukkan PIN admin (diverifikasi skrip) untuk membuka pengaturan
   koneksi, tautan siap pakai, minggu baru, dan kirim ulang seluruh isian. Token kini tampil tersamar.

Bila skrip masih v2.1, aplikasi tetap berjalan seperti biasa; hanya fitur pengamanan di atas yang belum aktif
dan aplikasi menampilkan pengingat untuk memperbarui kode.

## Pengembangan

```bash
npm install
npm run dev     # http://localhost:5173
npm run build   # dist/ (single-file HTML)
```

Data laporan tersimpan di `localStorage` perangkat; sheet dijadikan sumber baca (CSV ekspor publik)
dan tujuan tulis (Apps Script Web App).

**Kesegaran data.** Tab aktif dibaca ulang dari sheet saat aplikasi/tab dibuka, saat jendela kembali aktif,
saat ditinggal terbuka (tiap 2 menit), dan setiap kali **Pratinjau & Cetak** dibuka — perubahan yang dibuat
langsung di spreadsheet atau oleh rekan ikut terlihat tanpa perlu menekan apa pun. Halaman pratinjau
menampilkan jam **“Data sheet dibaca …”** dan tombol **Ambil data terbaru**; isian lokal yang belum terkirim
tetap dipertahankan saat pembacaan ulang (tidak tertimpa).

## Struktur singkat

| Berkas | Isi |
| --- | --- |
| `src/lib/model.ts` | Model data tab mingguan, daftar tim, util tanggal & teks, saran nama minggu |
| `src/lib/sheet.ts` | Parser CSV tab, penulisan & pembuatan tab via Apps Script, kode `Kode.gs` siap tempel |
| `src/lib/sync.ts` | Mesin sinkron: paket kiriman, penanda terkirim, verifikasi |
| `src/lib/store.tsx` | State aplikasi + pengatur sinkron otomatis (jeda, ulang, offline) |
| `src/lib/rute.ts` | Routing hash: alamat utama = halaman pilih, `#/isi`, `#/dashboard` |
| `src/views/` | Halaman pilih (landing), Dashboard, Isi laporan, Presensi, Pratinjau, Sinkronisasi |
