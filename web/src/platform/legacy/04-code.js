(function(){
  const P = window.Prism;
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  if (P){
    P.languages.opensearch = P.languages.extend('json', {});
    P.languages.insertBefore('opensearch', 'property', { 'request': { pattern: /^(?:GET|POST|PUT|DELETE)\s+\S+/m, inside: { 'keyword': /^\w+/, 'url': /\S+/ } } });
    P.languages.walktext = {
      'comment': { pattern: /^#.*$/m, greedy: true },
      'cite': { pattern: /\[(?:graph|chunk): [^\]]+\]/, alias: 'variable' },
      'check': { pattern: /^pass\b/m, alias: 'string' },
      'label': { pattern: /(^|\s):[A-Z]\w+/m, lookbehind: true, alias: 'class-name' },
      'id': { pattern: /\b(?:rc|m|proc):[\w.:-]+|\b[\w-]+#c\d+/, alias: 'variable' }
    };
  }

  // Split Prism's token tree into lines, closing and reopening spans at each newline
  function toLines(code, lang){
    if (!P || !P.languages[lang]) return code.split('\n').map(esc);
    const lines = [[]], stack = [];
    const open = c => '<span class="' + c + '">';
    function text(t){
      t.split('\n').forEach((part, i) => {
        if (i > 0){ lines[lines.length - 1].push('</span>'.repeat(stack.length)); lines.push([stack.map(open).join('')]); }
        if (part) lines[lines.length - 1].push(esc(part));
      });
    }
    function walk(t){
      if (typeof t === 'string'){ text(t); return; }
      if (Array.isArray(t)){ t.forEach(walk); return; }
      const cls = 'token ' + t.type + (t.alias ? ' ' + [].concat(t.alias).join(' ') : '');
      lines[lines.length - 1].push(open(cls)); stack.push(cls);
      walk(t.content);
      stack.pop(); lines[lines.length - 1].push('</span>');
    }
    walk(P.tokenize(code, P.languages[lang]));
    return lines.map(l => l.join(''));
  }
  window.__prismLines = toLines;
})();
