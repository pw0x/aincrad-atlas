import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  build: {
    assetsInlineLimit: 0,
    rollupOptions: {
      input: { castle: 'index.html', town: 'floor-01.html', cabin: 'floor-22.html' },
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/three/build/')) return 'three-core'
        }
      }
    }
  }
})
