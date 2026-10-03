// SQLite for the warehouse lane of a proof, loaded the first time someone proves a Snowflake question. The page is one
// file, so its WebAssembly is inlined as base64 (vite.config.ts) rather than fetched.
import type { SqlJsStatic } from 'sql.js';

let loading: Promise<SqlJsStatic> | null = null;
export function loadSql(): Promise<SqlJsStatic> {
  loading ??= (async () => {
    const [{ default: init }, { default: wasm }] = await Promise.all([import('sql.js'), import('sql.js/dist/sql-wasm-browser.wasm?base64')]);
    return init({ wasmBinary: Uint8Array.from(atob(wasm), (c) => c.charCodeAt(0)).buffer });
  })();
  loading.catch(() => { loading = null; });
  return loading;
}
