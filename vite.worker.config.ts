import { defineConfig } from 'vite';

export default defineConfig({
  // ...
  build: {
    lib: {
      fileName: 'worker.build',
      formats: ['es'],
      entry: 'src/UVOLPlayerWorker.ts',
    },

    emptyOutDir: false,
  },
});
