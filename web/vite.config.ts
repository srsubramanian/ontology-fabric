import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Each page builds into one self-contained HTML file in ../site, next to the pages
// that are still hand-written. Only Google Fonts load from outside the file.
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  build: {
    outDir: '../site',
    emptyOutDir: false,
    rollupOptions: { input: 'retrieval.html' },
  },
});
