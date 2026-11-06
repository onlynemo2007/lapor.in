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

Fitur ini memakai aksi `buatTab` pada Apps Script **v1.6**. Bila skrip di spreadsheet masih versi lama,
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

Skrip membaca posisi kolom dari baris judul dan mencari baris berdasarkan **tim + tanggal**, sehingga aman
bila ada baris/kolom yang disisipkan. Kolom lampiran dikenali dari judul kolomnya (cadangan: kolom pertama
yang berisi tautan), jadi tab baru yang masih kosong tetap ditulisi di kolom yang benar. Setiap kiriman
dicatat di tab tersembunyi `_audit`.

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
| `src/views/` | Dashboard, Isi laporan, Presensi, Pratinjau, Sinkronisasi |
