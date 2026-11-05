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

Satu sel lampiran per tim/per minggu bisa memuat **lebih dari satu tautan**:

- Menambah tautan **tidak menghapus** tautan yang sudah ada di daftar.
- Bila tautan lebih dari satu, sel ditulis berurutan bernomor `1. … 2. … 3. …`; tautan tunggal ditulis apa adanya.
- Menempel beberapa tautan sekaligus (baris baru, spasi, atau koma) langsung dipecah dan dirapikan.
- Membaca ulang dari sheet tetap mengenali format bernomor, sehingga sinkron tidak menghapus isi lama.

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
bila ada baris/kolom yang disisipkan. Setiap kiriman dicatat di tab tersembunyi `_audit`.

## Pengembangan

```bash
npm install
npm run dev     # http://localhost:5173
npm run build   # dist/ (single-file HTML)
```

Data laporan tersimpan di `localStorage` perangkat; sheet hanya dijadikan sumber baca (CSV ekspor publik)
dan tujuan tulis (Apps Script Web App).

## Struktur singkat

| Berkas | Isi |
| --- | --- |
| `src/lib/model.ts` | Model data tab mingguan, daftar tim, util tanggal & teks |
| `src/lib/sheet.ts` | Parser CSV tab, penulisan via Apps Script, kode `Kode.gs` siap tempel |
| `src/lib/sync.ts` | Mesin sinkron: paket kiriman, penanda terkirim, verifikasi |
| `src/lib/store.tsx` | State aplikasi + pengatur sinkron otomatis (jeda, ulang, offline) |
| `src/views/` | Dashboard, Isi laporan, Presensi, Pratinjau, Sinkronisasi |
