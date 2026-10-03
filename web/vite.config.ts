import { readFileSync } from 'node:fs';
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

/** Imports a file as a base64 string, so binary such as SQLite's WebAssembly is inlined in the one HTML file. */
const base64: Plugin = {
  name: 'base64',
  enforce: 'pre',
  load(id) {
    if (!id.endsWith('?base64')) return null;
    return { code: 'export default ' + JSON.stringify(readFileSync(id.slice(0, -'?base64'.length)).toString('base64')) + ';', map: null };
  },
};

// The page (index.html: the overview, retrieval and the class explorer) builds into one
// self-contained HTML file, ../site/index.html. Only Google Fonts load from outside it.
export default defineConfig({
  plugins: [react(), viteSingleFile(), yaml, base64],
  server: { fs: { allow: ['..'] } },
  build: {
    outDir: '../site',
    emptyOutDir: false,
  },
});
