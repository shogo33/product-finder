import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path' // 👈 追加

export default defineConfig({
  plugins: [react(), tailwindcss()],
  root: path.resolve(__dirname, './'), // 👈 Vercelにコードの場所を教える魔法の1行
})
