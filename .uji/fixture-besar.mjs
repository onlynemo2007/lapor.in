/**
 * Tab tiruan seperti laporan user:
 *  - bagian A/B/C normal, lalu bagian D berisi beberapa tabel ber-kolom Kode/Pagu
 *  - tabel "Realisasi Anggaran" ada di baris 103 dst, didahului tabel lain ("Sisa Di Rekening")
 *  - ada baris data "A | Sisa Di Rekening" yang dulu salah dianggap judul bagian
 */
const U = (n) => `https://drive.google.com/file/d/${n}/view`;

export function grid() {
  const g = [];
  const isi = (row, col, val) => {
    while (g.length < row) g.push([]);
    const r = g[row - 1];
    while (r.length < col) r.push("");
    r[col - 1] = val;
  };

  isi(1, 1, "LAPORAN MINGGU I BULAN NOVEMBER 2026");
  isi(2, 3, "A");
  isi(2, 4, "KEGIATAN TIM");
  ["No", "Tim", "Tanggal", "Uraian"].forEach((t, i) => isi(3, i + 1, t));
  isi(3, 10, "Link Bukti Dukung");
  const tim = ["Humas", "Keuangan", "Umum"];
  let row = 4;
  tim.forEach((t) => {
    ["2 November 2026", "3 November 2026", "4 November 2026"].forEach((d) => {
      isi(row, 2, t);
      isi(row, 3, d);
      isi(row, 4, `Kegiatan ${t} ${d}`);
      isi(row, 10, `${d}: ${U(t + row)}`);
      row += 1;
    });
  });

  isi(row + 1, 3, "B");
  isi(row + 1, 4, "RENCANA KEGIATAN TIM");
  ["No", "Tim", "Uraian"].forEach((t, i) => isi(row + 2, i + 1, t));
  isi(row + 3, 2, "Humas");
  isi(row + 3, 3, "Rencana humas");

  const b = row + 5;
  isi(b, 3, "C");
  isi(b, 4, "REKAPITULASI KEHADIRAN");
  ["No", "Tanggal", "Kehadiran", "Tidak Masuk", "Dinas Luar", "Cuti"].forEach((t, i) => isi(b + 1, i + 1, t));
  isi(b + 2, 2, "2 November 2026");
  isi(b + 2, 3, 50);
  isi(b + 3, 2, "3 November 2026");
  isi(b + 3, 3, 51);
  isi(b + 4, 2, "4 November 2026");
  isi(b + 4, 3, 49);

  /* --- bagian D --- */
  isi(20, 3, "D");
  isi(20, 4, "REALISASI KEUANGAN");

  /* tabel lain yang juga punya kolom Kode/Pagu (bukan sumber utama) */
  isi(21, 1, "No");
  isi(21, 2, "Kode");
  isi(21, 3, "Uraian");
  isi(21, 4, "Pagu");
  isi(21, 5, "Realisasi");
  isi(22, 1, 1);
  isi(22, 2, "900.01");
  isi(22, 3, "Sisa di rekening");
  isi(22, 4, 9000000000);
  isi(22, 5, 0);

  isi(24, 1, "Sisa Di Rekening");
  isi(25, 1, "No");
  isi(25, 2, "Kode");
  isi(25, 3, "Uraian");
  isi(25, 4, "Pagu");
  isi(25, 5, "Realisasi");
  isi(26, 1, 1);
  isi(26, 2, "900.02");
  isi(26, 3, "Kas di bendahara");
  isi(26, 4, 1500000000);
  isi(26, 5, 500000000);

  /* baris yang dulu membajak judul bagian A */
  isi(28, 1, "A");
  isi(28, 2, "Sisa Di Rekening");

  /* tabel sumber pagu/realisasi — baris 103 dst */
  isi(102, 1, "Realisasi Anggaran");
  ["No", "Kode", "Uraian", "Pagu", "Realisasi"].forEach((t, i) => isi(103, i + 1, t));
  for (let i = 0; i < 24; i++) {
    const r = 104 + i;
    isi(r, 1, i + 1);
    isi(r, 2, `032.12.${String(i + 1).padStart(2, "0")}`);
    isi(r, 3, `Belanja ${i + 1}`);
    isi(r, 4, 10000000 * (i + 1));
    isi(r, 5, 2500000 * (i + 1));
  }
  isi(128, 3, "Total");
  isi(128, 4, 0); // rumus di sheet — tidak ikut dihitung sebagai baris kode

  return g;
}

export function csv() {
  return grid()
    .map((r) => {
      const sel = [...r];
      while (sel.length < 10) sel.push("");
      return sel
        .map((v) => {
          const t = v === undefined || v === null ? "" : String(v);
          return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
        })
        .join(",");
    })
    .join("\n");
}
