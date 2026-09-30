import './prism-manual';
import Prism from 'prismjs';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-cypher';
import 'prismjs/components/prism-yaml';
import 'prismjs/components/prism-sql';

// Custom grammars (docs/style-guide.md). Those only the platform page's unported chapters use
// (opensearch, cedar) still live in web/src/platform/legacy/ and move here as their
// chapters are ported.

/** An HTTP request line and headers, then a JSON body: an MCP call on the wire. */
Prism.languages.mcphttp = Prism.languages.extend('json', {});
Prism.languages.insertBefore('mcphttp', 'property', {
  'request-line': { pattern: /^(?:POST|GET)\s+\S+\s+HTTP\/[\d.]+$/m, inside: { keyword: /^\w+/ } },
  header: { pattern: /^[A-Za-z][\w-]*:[^\n{]*$/m, inside: { keyword: /^[\w-]+(?=:)/, punctuation: /:/ } },
});

/** Plain-text walkthroughs: comments, citations, pass marks, labels and IDs. */
Prism.languages.walktext = {
  comment: { pattern: /^#.*$/m, greedy: true },
  cite: { pattern: /\[(?:graph|chunk): [^\]]+\]/, alias: 'variable' },
  check: { pattern: /^pass\b/m, alias: 'string' },
  label: { pattern: /(^|\s):[A-Z]\w+/m, lookbehind: true, alias: 'class-name' },
  id: { pattern: /\b(?:rc|m|proc):[\w.:-]+|\b[\w-]+#c\d+/, alias: 'variable' },
};

/** A tree-sitter query: captures, predicates, fields and node types. */
Prism.languages.tsq = {
  comment: /;.*/, string: /"[^"]*"/, variable: /@[\w.]+/, function: /#[\w?!-]+/,
  property: /\b[a-z_]+(?=:)/, keyword: { pattern: /(\()[a-z_]+/, lookbehind: true }, punctuation: /[()\[\]:]/,
};

/** A file tree drawn with box characters, with a note after two or more spaces. */
Prism.languages.tree = { punctuation: /[├└│─]+/, comment: { pattern: /(\S {2,})\S[^\n]*$/m, lookbehind: true } };

/** A diff where only added lines are marked. */
Prism.languages.diffx = { inserted: /^\+.*$/m };

/** Shell commands: the command, flags, files and comments. */
Prism.languages.cli = {
  comment: /^#.*$/m, function: /^[a-z][\w.-]*/m,
  string: /\S+\.(?:ttl|yaml|py|json|tsv)\b|\S+\/(?=\s|$)/, property: /\s--?[a-z][\w-]*/, operator: />/,
};

/** A Neptune bulk-loader CSV: its header line and comments. */
Prism.languages.csvx = { comment: /^#.*$/m, keyword: /^:ID[^\n]*$/m };

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Highlighted HTML for `code`, or escaped plain text when `lang` has no grammar. */
export function highlight(code: string, lang: string): string {
  const grammar = Prism.languages[lang];
  return grammar ? Prism.highlight(code, grammar, lang) : escape(code);
}
