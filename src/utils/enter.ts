/**
 * Enter "final" — aman untuk pengguna yang mengetik dengan IME (Jepang, China, Korea).
 *
 * Saat IME masih menyusun huruf, tombol Enter dipakai untuk **mengonfirmasi kandidat**
 * dan `KeyboardEvent.isComposing` bernilai `true`. Safari lama punya bug urutan event
 * (WebKit 165004): `isComposing` sudah kembali `false` saat Enter pengonfirmasi tiba,
 * tetapi browser melaporkan `keyCode === 229` (VK_PROCESSKEY). Keduanya harus dicek,
 * kalau tidak isian yang belum selesai diketik ikut terkirim/ditambahkan.
 *
 * Catatan: pintasan `Ctrl/Cmd + Enter` tidak bertabrakan dengan Enter pengonfirmasi IME,
 * jadi tidak perlu pemeriksaan ini.
 */
export function enterFinal(e: React.KeyboardEvent): boolean {
  return e.key === "Enter" && !e.nativeEvent.isComposing && e.keyCode !== 229;
}
