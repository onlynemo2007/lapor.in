/// <reference types="vite/client" />

/** Koneksi bawaan yang bisa diisi saat build (mis. Environment Variables di Vercel). */
interface ImportMetaEnv {
  readonly VITE_SCRIPT_URL?: string;
  readonly VITE_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
