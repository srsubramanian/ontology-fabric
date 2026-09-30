// Builds each page into its own self-contained file in ../site.
import { build } from 'vite';

const PAGES = ['retrieval', 'ontology'];

for (const page of PAGES) {
  await build({ build: { rollupOptions: { input: page + '.html' } } });
}
