import './prism-manual';
import Prism from 'prismjs';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-cypher';
import 'prismjs/components/prism-yaml';
import 'prismjs/components/prism-sql';

// Custom grammars (docs/style-guide.md). The others still live in site/platform.html
// and move here when that page is ported.

/** An HTTP request line and headers, then a JSON body: an MCP call on the wire. */
Prism.languages.mcphttp = Prism.languages.extend('json', {});
Prism.languages.insertBefore('mcphttp', 'property', {
  'request-line': { pattern: /^(?:POST|GET)\s+\S+\s+HTTP\/[\d.]+$/m, inside: { keyword: /^\w+/ } },
  header: { pattern: /^[A-Za-z][\w-]*:[^\n{]*$/m, inside: { keyword: /^[\w-]+(?=:)/, punctuation: /:/ } },
});

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Highlighted HTML for `code`, or escaped plain text when `lang` has no grammar. */
export function highlight(code: string, lang: string): string {
  const grammar = Prism.languages[lang];
  return grammar ? Prism.highlight(code, grammar, lang) : escape(code);
}
