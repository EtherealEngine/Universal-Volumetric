import { defineConfig } from 'vite'

export default defineConfig({
  // ...
  build: {
    
    lib: {
      fileName: 'worker.build',
      formats: ['es'],
      entry: 'web/worker.ts'
    },

    emptyOutDir: false
  }
})