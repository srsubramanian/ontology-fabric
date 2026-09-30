import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { parse } from 'yaml';

/** Imports a .yaml file, such as the ontology, as plain data at build time. */
const yaml: Plugin = {
  name: 'yaml',
  transform(source, id) {
    if (!id.endsWith('.yaml')) return null;
    return { code: 'export default ' + JSON.stringify(parse(source)) + ';', map: null };
  },
};

// Each page builds into one self-contained HTML file in ../site, next to the pages
// that are still hand-written. Only Google Fonts load from outside the file.
// build.mjs runs this once per page, since a single-file build takes one entry.
export default defineConfig({
  plugins: [react(), viteSingleFile(), yaml],
  server: { fs: { allow: ['..'] } },
  build: {
    outDir: '../site',
    emptyOutDir: false,
  },
});
