import { defineConfig } from 'vite';

export default defineConfig({
  // ...
  build: {
    lib: {
      fileName: 'V1/worker.build',
      formats: ['es'],
      entry: 'src/V1/worker.ts',
    },

    emptyOutDir: false,
  },
});
