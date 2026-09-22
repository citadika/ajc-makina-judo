import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
//
// Le backend FastAPI tourne sur http://localhost:8000 en
// développement. Le frontend (Vite, port 5173) et le backend étant
// sur deux ports différents, un appel direct du navigateur vers
// localhost:8000 serait une requête cross-origin. On évite tout
// souci de CORS en faisant transiter /api et /uploads par le
// serveur de développement Vite lui-même (même principe que
// proxy.conf.json côté Angular) : le navigateur ne parle qu'à
// localhost:5173, et c'est Vite qui relaie vers le backend.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
      },
      '/uploads': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
