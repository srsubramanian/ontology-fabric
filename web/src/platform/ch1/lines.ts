import Prism from 'prismjs';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-turtle';
import '../../kit/prism';

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Highlighted HTML for each line of `code`. Prism's token tree is split at every newline,
 * closing and reopening the open spans, so each line stands alone and can be lit on its own.
 */
export function highlightLines(code: string, lang: string): string[] {
  const grammar = Prism.languages[lang];
  if (!grammar) return code.split('\n').map(escape);
  const lines: string[][] = [[]];
  const stack: string[] = [];
  const open = (cls: string) => '<span class="' + cls + '">';
  const text = (t: string) => t.split('\n').forEach((part, i) => {
    if (i > 0) {
      lines[lines.length - 1].push('</span>'.repeat(stack.length));
      lines.push([stack.map(open).join('')]);
    }
    if (part) lines[lines.length - 1].push(escape(part));
  });
  const walk = (t: string | Prism.Token | (string | Prism.Token)[]) => {
    if (typeof t === 'string') { text(t); return; }
    if (Array.isArray(t)) { t.forEach(walk); return; }
    const cls = 'token ' + t.type + (t.alias ? ' ' + ([] as string[]).concat(t.alias).join(' ') : '');
    lines[lines.length - 1].push(open(cls));
    stack.push(cls);
    walk(t.content);
    stack.pop();
    lines[lines.length - 1].push('</span>');
  };
  walk(Prism.tokenize(code, grammar));
  return lines.map((l) => l.join(''));
}

/** The same lines as one block of `<span class="ln">` rows, for a `<pre>`. */
export function linesHtml(code: string, lang: string): string {
  return highlightLines(code, lang).map((l) => '<span class="ln">' + (l || ' ') + '</span>').join('');
}
