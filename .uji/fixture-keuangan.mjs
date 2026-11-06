/** Tab tiruan dengan bagian D: Rekapitulasi UP, Pembayaran Melalui LS, Realisasi Anggaran, Rencana Penarikan. */
export function grid() {
  const g = [];
  const isi = (row, col, val) => {
    while (g.length < row) g.push([]);
    const r = g[row - 1];
    while (r.length < col) r.push("");
    r[col - 1] = val;
  };
  isi(1, 1, "LAPORAN MINGGU I BULAN NOVEMBER 2026");
  isi(2, 3, "D");
  isi(2, 4, "REALISASI KEUANGAN");

  isi(3, 1, "Rekapitulasi UP");
  ["No", "Uraian", "Pagu", "Realisasi", "Sisa"].forEach((t, i) => isi(4, i + 1, t));
  isi(5, 1, 1); isi(5, 2, "UP Januari"); isi(5, 3, 100000000); isi(5, 4, 20000000); isi(5, 5, 80000000);
  isi(6, 1, 2); isi(6, 2, "UP Februari"); isi(6, 3, 50000000); isi(6, 4, 10000000); isi(6, 5, 40000000);

  isi(8, 1, "Pembayaran Melalui LS");
  ["No", "Uraian", "Nilai", "Keterangan"].forEach((t, i) => isi(9, i + 1, t));
  isi(10, 1, 1); isi(10, 2, "Honor narasumber"); isi(10, 3, 15000000); isi(10, 4, "Lunas");

  isi(12, 1, "Realisasi Anggaran");
  ["Kode", "Uraian", "Pagu", "Realisasi"].forEach((t, i) => isi(13, i + 1, t));
  isi(14, 1, "032.12.01"); isi(14, 2, "Perjalanan dinas"); isi(14, 3, 100000000); isi(14, 4, 25000000);
  isi(15, 1, "032.12.02"); isi(15, 2, "Sewa kendaraan"); isi(15, 3, 50000000); isi(15, 4, 10000000);

  isi(17, 1, "Rencana Penarikan");
  ["Bulan", "Jumlah", "Keterangan"].forEach((t, i) => isi(18, i + 1, t));
  isi(19, 1, "November"); isi(19, 2, 75000000);

  return g;
}

export function csv() {
  const g = grid();
  return g
    .map((r) => {
      const sel = [...r];
      while (sel.length < 5) sel.push("");
      return sel
        .map((v) => {
          const t = v === undefined || v === null ? "" : String(v);
          return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
        })
        .join(",");
    })
    .join("\n");
}
