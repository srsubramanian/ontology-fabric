import './prism-manual';
import Prism from 'prismjs';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-cypher';
import 'prismjs/components/prism-yaml';
import 'prismjs/components/prism-sql';
// The lineage view shows each hop's code in its layer's language: TSX on the screen, Java in the backend.
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-tsx';

// Custom grammars (docs/style-guide.md).

/** An OpenSearch request: the method and path, then a JSON body. */
Prism.languages.opensearch = Prism.languages.extend('json', {});
Prism.languages.insertBefore('opensearch', 'property', {
  request: { pattern: /^(?:GET|POST|PUT|DELETE)\s+\S+/m, inside: { keyword: /^\w+/, url: /\S+/ } },
});

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

/** An AgentCore Policy rule in Cedar: permit and forbid, entity types, conditions. */
Prism.languages.cedar = {
  comment: /\/\/.*/,
  string: { pattern: /"[^"]*"/, greedy: true },
  'class-name': /\b[A-Z]\w*(?=::)/,
  keyword: /\b(?:permit|forbid|when|unless|in|like|principal|action|resource|context)\b/,
  punctuation: /[()\[\]{};,.:]/,
  operator: /==|!=|&&|\|\|/,
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
