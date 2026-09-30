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

// The page (index.html: the overview, retrieval and the class explorer) builds into one
// self-contained HTML file, ../site/index.html. Only Google Fonts load from outside it.
export default defineConfig({
  plugins: [react(), viteSingleFile(), yaml],
  server: { fs: { allow: ['..'] } },
  build: {
    outDir: '../site',
    emptyOutDir: false,
  },
});
