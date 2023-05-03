import { defineConfig } from 'vite'

export default defineConfig({
  // ...
  build: {
    
      lib: {
        fileName: 'player',
        formats: ['es'],
        entry: 'web/player.ts',
      }, 
      
      rollupOptions: {
        // make sure to externalize deps that shouldn't be bundled
        // into your library
        external: ['three'],
        output: {
          // Provide global variables to use in the UMD build
          // for externalized deps
          globals: {
            vue: 'THREE'
          }
        }
      },

      emptyOutDir: false
  }
})