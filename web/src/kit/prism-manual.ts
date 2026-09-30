// Runs before prismjs loads (see prism.ts), so Prism never highlights the page on its own.
(globalThis as { Prism?: { manual?: boolean } }).Prism = { manual: true };
