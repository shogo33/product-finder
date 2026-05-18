import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'url'
import path from 'path'
import fs from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// https://vite.dev
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'serve-public-html',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const url = req.url?.split('?')[0]
          if (url && url.endsWith('.html') && url !== '/' && url !== '/index.html') {
            const filePath = path.join(__dirname, 'public', url)
            if (fs.existsSync(filePath)) {
              res.setHeader('Content-Type', 'text/html; charset=utf-8')
              res.end(fs.readFileSync(filePath))
              return
            }
          }
          next()
        })
      }
    }
  ],
  root: path.resolve(__dirname, './'),
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
})
