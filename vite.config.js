import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: './', // 👈 Vercelでのファイルの読み込み迷子を防ぐ魔法の1行
  resolve: {
    dedupe: ['react', 'react-dom']
  }
})