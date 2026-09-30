(function(){
  const NS = 'http://www.w3.org/2000/svg';
  const M = window.Motion;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function anim(t, k, o){
    if (typeof HTMLCollection !== 'undefined' && t instanceof HTMLCollection) t = Array.from(t);
    if (!M){ const els = t instanceof Element ? [t] : Array.from(t); els.forEach(e => { for (const p in k){ if (['x','y','scale','scaleX','rotate'].includes(p)) continue; const v = Array.isArray(k[p]) ? k[p][k[p].length-1] : k[p]; e.style[p] = v; } }); return Promise.resolve(); }
    if (reduce) o = Object.assign({}, o, { duration:0, delay:0 });
    return Promise.resolve(M.animate(t, k, o || {}));
  }
  function tween(o){ if (!M || reduce){ o.onUpdate && o.onUpdate(1); return Promise.resolve(); } return Promise.resolve(M.animate(0, 1, o)); }
  const wait = ms => new Promise(r => setTimeout(r, reduce ? 0 : ms));
  const dl = (b, s) => (i) => b + i * s;
  const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  function el(tag, attrs, parent){ const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; }

  const P = window.Prism;
  if (P && P.languages){
    P.languages.mcphttp = P.languages.extend('json', {});
    P.languages.insertBefore('mcphttp', 'property', {
      'request-line': { pattern: /^(?:POST|GET)\s+\S+\s+HTTP\/[\d.]+$/m, inside: { 'keyword': /^\w+/ } },
      'header': { pattern: /^[A-Za-z][\w-]*:[^\n{]*$/m, inside: { 'keyword': /^[\w-]+(?=:)/, 'punctuation': /:/ } }
    });
    P.languages.cedar = {
      'comment': /\/\/.*/,
      'string': { pattern: /"[^"]*"/, greedy: true },
      'class-name': /\b[A-Z]\w*(?=::)/,
      'keyword': /\b(?:permit|forbid|when|unless|in|like|principal|action|resource|context)\b/,
      'punctuation': /[()\[\]{};,.:]/,
      'operator': /==|!=|&&|\|\|/
    };
  }
  const lines = (code, lang) => (window.__prismLines ? window.__prismLines(code, lang) : code.split('\n').map(esc));
  function render(pre, code, lang){ pre.innerHTML = lines(code, lang).map(l => '<span class="ln">' + (l || ' ') + '</span>').join(''); }
  function drawIn(paths, d0){
    Array.from(paths).forEach((p, i) => {
      const len = p.getTotalLength(); p.style.strokeDasharray = len; p.style.strokeDashoffset = len;
      anim(p, { strokeDashoffset:[len, 0] }, { duration:0.5, delay:(d0 || 0) + i * 0.12 }).then(() => { p.style.strokeDasharray = ''; p.style.strokeDashoffset = ''; });
    });
  }
  function hideAll(list){ Array.from(list).forEach(e => e.style.opacity = 0); }

  function DD(id, steps, runners){
    const root = document.getElementById(id); if (!root) return null;
    const stepsEl = root.querySelector('.xsteps'), keys = root.querySelector('.xkeys');
    const panels = Array.from(root.querySelectorAll('.xpanel'));
    const api = { stops: [], cur: 1 };
    const btns = steps.map((s, i) => {
      const b = document.createElement('button'); b.type = 'button';
      b.innerHTML = '<span class="num">' + (i + 1) + '</span>' + s.t;
      b.addEventListener('click', () => show(i + 1)); stepsEl.appendChild(b); return b;
    });
    function show(n, play){
      api.cur = n; api.stops.forEach(f => f());
      btns.forEach((b, i) => { if (i === n - 1) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current'); });
      const s = steps[n - 1];
      keys.innerHTML = '<h3>' + s.t + '</h3><ul>' + s.k.map(x => '<li>' + x + '</li>').join('') + '</ul>' +
        (n < steps.length ? '<button type="button" class="vbtn go ddnext">Next: ' + steps[n].t + '</button>'
                          : '<a class="vbtn go ddnext" href="' + root.dataset.next + '">' + root.dataset.nextLabel + '</a>');
      const nx = keys.querySelector('button.ddnext'); if (nx) nx.addEventListener('click', () => show(n + 1));
      anim(keys, { opacity:[0,1], x:[-8,0] }, { duration:0.3 });
      panels.forEach(p => { p.hidden = Number(p.dataset.d) !== n; });
      anim(panels[n - 1], { opacity:[0,1] }, { duration:0.25 });
      if (play !== false && runners[n]) runners[n](api);
    }
    api.show = show;
    show(1, false);
    let seen = false;
    if (M && M.inView) M.inView(root, () => { if (!seen && api.cur === 1){ seen = true; runners[1] && runners[1](api); } }, { amount:0.3 });
    return api;
  }

  function Tour(box, stops, cap, api){
    const pre = box.querySelector('pre'), band = box.querySelector('.ddband');
    let run = 0;
    function set(i){
      const s = stops[i], L = Array.from(pre.querySelectorAll('.ln'));
      const base = box.getBoundingClientRect().top - box.scrollTop;
      const top = L[s[0]].getBoundingClientRect().top - base, h = L[s[1]].getBoundingClientRect().bottom - L[s[0]].getBoundingClientRect().top;
      anim(band, { top: top + 'px', height: h + 'px', opacity: 1 }, { duration:0.4, ease:[0.22,1,0.36,1] });
      if (cap){ cap.textContent = s[2]; anim(cap, { opacity:[0,1] }, { duration:0.3 }); }
    }
    async function play(){ const my = ++run; for (let i = 0; i < stops.length; i++){ if (my !== run) return; set(i); await wait(2500); } }
    function stop(){ run++; }
    if (api) api.stops.push(stop);
    return { set, play, stop };
  }

  /* ================= Chapter 4 ================= */
  (function(){
    if (!document.getElementById('dd4')) return;
    const DOCS = { A:'Visa rules: 10.4 card-absent fraud', B:'Runbook: orders the customer didn’t place', C:'Glossary: reason code formats', D:'Case notes: “not my order” claims' };
    const KW = { A:12.4, B:9.1, C:3.2 }, VEC = { B:0.83, D:0.79, A:0.61 };
    const norm = o => { const v = Object.values(o), lo = Math.min(...v), hi = Math.max(...v); const r = {}; for (const k in o) r[k] = (o[k] - lo) / (hi - lo); return r; };
    const KWN = norm(KW), VECN = norm(VEC);
    function cols(el, kw, vec, fmtK, fmtV, maxK, maxV){
      const col = (title, sub, o, fmt, max, cls) => '<div class="scol"><b>' + title + '</b><small>' + sub + '</small>' +
        Object.keys(o).map(k => '<div class="srow"><span class="sdoc"><i>' + k + '</i>' + DOCS[k] + '</span><div class="strack"><div class="sbar ' + cls + '" data-w="' + (o[k] / max * 100).toFixed(1) + '"></div></div><span class="sval" data-v="' + o[k] + '">' + fmt(o[k]) + '</span></div>').join('') + '</div>';
      el.innerHTML = col('Keyword (BM25)', fmtK === 'raw' ? 'scores roughly 0 to 15' : 'rescaled to 0 to 1', kw, fmtK === 'raw' ? (v => v.toFixed(1)) : (v => v.toFixed(2)), maxK, 'kw') +
                     col('Vector (k-NN)', fmtV === 'raw' ? 'similarity 0 to 1' : 'rescaled to 0 to 1', vec, v => v.toFixed(2), maxV, 'vec');
    }
    const raw = document.getElementById('x4raw'), nrm = document.getElementById('x4norm');
    cols(raw, KW, VEC, 'raw', 'raw', 15, 1);
    cols(nrm, KW, VEC, 'norm', 'norm', 15, 1);
    function grow(container, fromRaw){
      container.querySelectorAll('.sbar').forEach((b, i) => { anim(b, { width:['0%', b.dataset.w + '%'] }, { duration:0.6, delay:0.1 + i * 0.08, ease:[0.22,1,0.36,1] }); if (!M || reduce) b.style.width = b.dataset.w + '%'; });
    }
    async function normalize(){
      const bars = nrm.querySelectorAll('.srow');
      bars.forEach(r => { const b = r.querySelector('.sbar'); b.style.width = b.dataset.w + '%'; });
      await wait(700);
      nrm.querySelectorAll('.scol').forEach((col, ci) => {
        const src = ci === 0 ? KWN : VECN;
        col.querySelectorAll('.srow').forEach(r => {
          const k = r.querySelector('i').textContent, b = r.querySelector('.sbar'), v = r.querySelector('.sval');
          anim(b, { width: (src[k] * 100).toFixed(1) + '%' }, { duration:0.7, ease:[0.22,1,0.36,1] }); if (!M || reduce) b.style.width = (src[k] * 100) + '%';
          const from = Number(v.dataset.v), to = src[k];
          tween({ duration:0.7, onUpdate: t => { v.textContent = (from + (to - from) * t).toFixed(2); } });
        });
      });
      nrm.querySelectorAll('.scol small').forEach(s => s.textContent = 'rescaled to 0 to 1');
    }
    // combine with slider
    const combo = document.getElementById('x4combo'), w = document.getElementById('x4w'), wv = document.getElementById('x4wv');
    const ORDER = ['A','B','C','D'];
    combo.innerHTML = ORDER.map(k => '<div class="crow" data-k="' + k + '"><span class="sdoc"><i>' + k + '</i>' + DOCS[k] + '</span><div class="ctrack"><div class="cpart kw"></div><div class="cpart vec"></div></div><span class="ctot">0.00</span></div>').join('');
    function combine(animate){
      const wk = Number(w.value), wvv = 1 - wk;
      wv.textContent = 'keyword ' + wk.toFixed(2) + ', vector ' + wvv.toFixed(2);
      const rows = Array.from(combo.children);
      const first = new Map(rows.map(r => [r, r.getBoundingClientRect().top]));
      const scored = ORDER.map(k => ({ k, kw: wk * (KWN[k] || 0), ve: wvv * (VECN[k] || 0) })).map(s => Object.assign(s, { tot: s.kw + s.ve })).sort((a, b) => b.tot - a.tot);
      scored.forEach(s => {
        const r = combo.querySelector('.crow[data-k="' + s.k + '"]');
        const kwp = r.querySelector('.cpart.kw'), vep = r.querySelector('.cpart.vec');
        if (animate){ anim(kwp, { width:(s.kw * 100) + '%' }, { duration:0.4 }); anim(vep, { width:(s.ve * 100) + '%' }, { duration:0.4 }); }
        if (!animate || !M || reduce){ kwp.style.width = (s.kw * 100) + '%'; vep.style.width = (s.ve * 100) + '%'; }
        r.querySelector('.ctot').textContent = s.tot.toFixed(2);
        combo.appendChild(r);
      });
      rows.forEach(r => { const d = first.get(r) - r.getBoundingClientRect().top; if (d && animate) anim(r, { y:[d, 0] }, { duration:0.45, ease:[0.22,1,0.36,1] }); });
    }
    w.addEventListener('input', () => combine(true));
    // config tour
    const CFG = [
      'PUT /_search/pipeline/hybrid-minmax',
      '{',
      '  "description": "Blend keyword and vector scores",',
      '  "phase_results_processors": [',
      '    { "normalization-processor": {',
      '        "normalization": { "technique": "min_max" },',
      '        "combination": {',
      '          "technique": "arithmetic_mean",',
      '          "parameters": { "weights": [0.4, 0.6] }',
      '        } } }',
      '  ]',
      '}'
    ].join('\n');
    const box = document.getElementById('x4box');
    render(document.getElementById('x4code'), CFG, 'opensearch');
    let tour;
    const api = DD('dd4', [
      { t:'Two searches', k:['Keyword search scores matching terms (BM25)','Vector search scores closeness in meaning','Their scores sit on different scales'] },
      { t:'Normalize', k:['Min-max rescales each list to 0 to 1','Top result becomes 1, bottom becomes 0','Now the two lists can be compared'] },
      { t:'Combine', k:['Each part is weighted, then added','Drag the weight and watch the ranking change','B wins: strong on words and on meaning'] },
      { t:'The config', k:['A search pipeline holds the recipe','The query names it with search_pipeline','Weights follow the order of the sub-queries'] },
      { t:'Why both', k:['Keywords nail exact codes and names','Vectors catch meaning in other words','Hybrid gets both'] }
    ], {
      1: () => { raw.querySelectorAll('.sbar').forEach(b => b.style.width = '0%'); grow(raw); },
      2: () => { normalize(); },
      3: () => { requestAnimationFrame(() => combine(true)); },
      4: () => { tour.play(); },
      5: () => { const mk = document.querySelectorAll('#x4why .mk'); mk.forEach(m => { m.className = 'mk'; m.textContent = ''; }); mk.forEach((m, i) => setTimeout(() => { const ok = m.dataset.v === '1'; m.className = 'mk ' + (ok ? 'ok' : 'no'); m.textContent = ok ? '\u2713' : '\u2715'; anim(m, { scale:[0.3,1] }, { duration:0.25 }); }, reduce ? 0 : 200 + i * 180)); }
    });
    tour = Tour(box, [
      [0, 0, 'Create a search pipeline named hybrid-minmax.'],
      [5, 5, 'First: rescale each result list to 0 to 1.'],
      [6, 8, 'Then: a weighted average, keyword 0.4 and vector 0.6.'],
      [8, 8, 'The weights line up with the order of the queries inside “hybrid”.']
    ], document.getElementById('x4cap'), api);
    document.getElementById('x4play').addEventListener('click', () => tour.play());
    combine(false);
  })();

  /* ================= Chapter 5 ================= */
  (function(){
    if (!document.getElementById('dd5')) return;
    const TOOLS = [
      ['search_entities', 'Find entities by name, code or meaning. Returns Neptune IDs.'],
      ['expand_subgraph', 'Return the neighbourhood of an ID, a few hops deep.'],
      ['run_validated_cypher', 'Run a read-only query, checked against the ontology.'],
      ['get_ontology_class', 'Look up a class definition and its allowed relationships.']
    ];
    const tc = document.getElementById('x5tools');
    tc.innerHTML = TOOLS.map((t, i) => '<div class="tcard' + (i === 0 ? ' on' : '') + '"><code>' + t[0] + '</code><span>' + t[1] + '</span></div>').join('');
    const DEF = [
      '{',
      '  "name": "search_entities",',
      '  "description": "Find payment entities by name, code or meaning. Returns Neptune IDs.",',
      '  "inputSchema": {',
      '    "type": "object",',
      '    "properties": {',
      '      "query":  { "type": "string" },',
      '      "labels": { "type": "array", "items": { "type": "string" } },',
      '      "limit":  { "type": "integer", "default": 10 }',
      '    },',
      '    "required": ["query"]',
      '  },',
      '  "outputSchema": {',
      '    "type": "object",',
      '    "properties": {',
      '      "hits": { "type": "array" }',
      '    }',
      '  }',
      '}'
    ].join('\n');
    const box = document.getElementById('x5box');
    render(document.getElementById('x5def'), DEF, 'json');
    const REQ = [
      'POST /mcp HTTP/1.1',
      'MCP-Protocol-Version: 2026-07-28',
      'Mcp-Method: tools/call',
      'Mcp-Name: search_entities',
      'Authorization: Bearer <token>',
      '',
      '{ "jsonrpc": "2.0", "id": 7, "method": "tools/call",',
      '  "params": { "name": "search_entities",',
      '    "arguments": { "query": "Harbor Grill", "labels": ["Merchant"] },',
      '    "_meta": { "io.modelcontextprotocol/clientInfo":',
      '               { "name": "disputes-agent", "version": "1.4" } } } }'
    ].join('\n');
    const RES = [
      '{ "jsonrpc": "2.0", "id": 7,',
      '  "result": { "resultType": "complete", "isError": false,',
      '    "content": [ { "type": "text", "text": "m:88213  Harbor Grill #4" } ],',
      '    "structuredContent": {',
      '      "hits": [ { "neptune_id": "m:88213", "labels": ["Merchant"] } ] } } }'
    ].join('\n');
    const ERR = [
      '{ "jsonrpc": "2.0", "id": 12,',
      '  "result": { "resultType": "complete", "isError": true,',
      '    "content": [ { "type": "text",',
      '      "text": "Denied by policy: writes are not allowed." } ] } }'
    ].join('\n');
    const POL = [
      '// Default deny: nothing runs unless a rule allows it',
      'permit (',
      '  principal in Group::"dispute-analysts",',
      '  action in [Action::"search_entities", Action::"expand_subgraph",',
      '             Action::"run_validated_cypher"],',
      '  resource',
      ');',
      '// Forbid wins over permit',
      'forbid (principal, action == Action::"run_validated_cypher", resource)',
      '  when { context.input.cypher like "*DELETE*" };'
    ].join('\n');
    render(document.getElementById('x5err'), ERR, 'json');
    render(document.getElementById('x5pol'), POL, 'cedar');
    const jsonPre = document.getElementById('x5json'), jsonLab = document.getElementById('x5jl');
    function move(pk, p, reverse, dur){
      const len = p.getTotalLength();
      const g = el('g', {}, pk); const c = el('circle', { r:6 }, g); c.style.fill = 'var(--onto)';
      return tween({ duration: dur || 0.7, ease:[0.45,0,0.2,1], onUpdate: v => { const pt = p.getPointAtLength((reverse ? 1 - v : v) * len); g.setAttribute('transform', 'translate(' + pt.x + ',' + pt.y + ')'); } }).then(() => g.remove());
    }
    let seqRun = 0;
    async function seq(){
      const my = ++seqRun;
      const svg = document.getElementById('x5seq'), pk = document.getElementById('x5pk');
      const msgs = svg.querySelectorAll('.msg'), labs = svg.querySelectorAll('.mlab');
      hideAll(msgs); hideAll(labs); pk.replaceChildren();
      jsonLab.textContent = 'The request, under the 2026-07-28 spec';
      render(jsonPre, REQ, 'mcphttp'); anim(jsonPre, { opacity:[0,1] }, { duration:0.3 });
      for (let i = 0; i < msgs.length; i++){
        if (my !== seqRun) return;
        if (i === msgs.length - 1){ jsonLab.textContent = 'The response: text plus structured content'; render(jsonPre, RES, 'json'); anim(jsonPre, { opacity:[0,1] }, { duration:0.3 }); }
        msgs[i].style.opacity = 1; drawIn([msgs[i]], 0); anim(labs[i], { opacity:[0,1] }, { duration:0.3 });
        await move(pk, msgs[i], false, 0.6);
        await wait(260);
      }
    }
    document.getElementById('x5again').addEventListener('click', seq);
    const CHAIN = [
      ['search_entities', '{ "query": "Harbor Grill chargeback Aug 19", "labels": ["Chargeback"] }', 'cb:1001'],
      ['expand_subgraph', '{ "id": "cb:1001", "hops": 2 }', 'cap:7731, auth:5521, m:88213, rc:visa:10.4'],
      ['run_validated_cypher', '{ "template": "chargebacks_by_reason", "params": { "merchant": "m:88213", "reason": "rc:visa:10.4" } }', '41 this month']
    ];
    const chain = document.getElementById('x5chain');
    chain.innerHTML = CHAIN.map((c, i) => '<div class="ccall"><span class="cn2">' + (i + 1) + '</span><div><code class="cname">' + c[0] + '</code><pre class="cargs">' + esc(c[1]) + '</pre><div class="cres">returns <code>' + c[2] + '</code></div></div></div>').join('');
    async function chainRun(){
      const calls = chain.querySelectorAll('.ccall'), ans = document.getElementById('x5ans');
      hideAll(calls); ans.style.opacity = 0;
      for (let i = 0; i < calls.length; i++){
        if (api.cur !== 3) return;
        await anim(calls[i], { opacity:[0,1], x:[-12,0] }, { duration:0.35 });
        const r = calls[i].querySelector('.cres'); anim(r, { opacity:[0,1] }, { duration:0.3, delay:0.4 });
        await wait(900);
      }
      anim(ans, { opacity:[0,1], y:[10,0] }, { duration:0.4 });
    }
    const RES2 = { a:['ok','ok','ok','ok'], b:['ok','no','fade','fade'] };
    let gRun = 0;
    async function guard(){
      const my = ++gRun;
      document.querySelectorAll('#x5g .mk').forEach(m => { m.className = 'mk'; m.textContent = ''; m.removeAttribute('title'); });
      const eb = document.getElementById('x5errbox'); eb.style.opacity = 0;
      const rows = Array.from(document.querySelectorAll('#x5g .rrow:not(.rh)'));
      for (let r = 0; r < rows.length; r++){
        if (my !== gRun) return;
        anim(rows[r], { backgroundColor:['rgba(175,169,236,0.25)', 'rgba(175,169,236,0)'] }, { duration:0.8 });
        for (const c of ['a', 'b']){
          await wait(260); if (my !== gRun) return;
          const m = document.querySelector('#x5g .mk[data-r="' + r + '"][data-c="' + c + '"]'), st = RES2[c][r];
          if (st === 'ok'){ m.className = 'mk ok'; m.textContent = '\u2713'; }
          else if (st === 'no'){ m.className = 'mk no'; m.textContent = '\u2715'; }
          else { m.className = 'mk no fade'; m.textContent = '\u2715'; m.title = 'Never reached, but it would refuse the call too'; }
          anim(m, { scale:[0.3,1] }, { duration:0.25 });
        }
      }
      anim(eb, { opacity:[0,1], y:[8,0] }, { duration:0.35, delay:0.2 });
    }
    document.getElementById('x5check').addEventListener('click', guard);
    const polBtn = document.getElementById('x5polBtn'), polBox = document.getElementById('x5polBox');
    polBtn.addEventListener('click', () => {
      const open = polBox.hidden; polBox.hidden = !open;
      polBtn.textContent = open ? 'Hide the policy' : 'Show the policy'; polBtn.setAttribute('aria-expanded', open);
      if (open) anim(polBox, { opacity:[0,1], y:[6,0] }, { duration:0.3 });
    });
    const CARD = [
      '{',
      '  "name": "Disputes agent",',
      '  "description": "Explains chargebacks and dispute history for a merchant or card.",',
      '  "url": "https://agents.example.com/disputes",',
      '  "version": "1.2.0",',
      '  "skills": [',
      '    { "id": "explain_chargeback", "name": "Explain a chargeback" },',
      '    { "id": "merchant_dispute_history", "name": "Merchant dispute history" }',
      '  ]',
      '}'
    ].join('\n');
    render(document.getElementById('x5card'), CARD, 'json');
    let aRun = 0;
    async function a2a(){
      const my = ++aRun;
      const svg = document.getElementById('x5a2a'), pk = document.getElementById('a2apk');
      const A = document.getElementById('a2aA'), B = document.getElementById('a2aB');
      const states = Array.from(document.querySelectorAll('#x5ts [data-s]'));
      const setState = s => states.forEach(x => { const on = x.dataset.s === s; x.classList.toggle('on', on); if (on) anim(x, { scale:[0.85,1] }, { duration:0.3 }); });
      pk.replaceChildren(); states.forEach(x => x.classList.remove('on'));
      anim(svg.querySelectorAll('.a2n'), { opacity:[0,1], y:[8,0] }, { duration:0.35, delay: dl(0, 0.12) });
      await wait(600); if (my !== aRun) return;
      setState('submitted'); await move(pk, A, false, 0.8); if (my !== aRun) return;
      setState('working');
      for (let i = 0; i < 2; i++){ await move(pk, B, false, 0.5); if (my !== aRun) return; await move(pk, B, true, 0.5); if (my !== aRun) return; }
      await move(pk, A, true, 0.8); if (my !== aRun) return;
      setState('completed');
    }
    document.getElementById('x5a2aBtn').addEventListener('click', a2a);
    let tour;
    const api = DD('dd5', [
      { t:'The toolbox', k:['An MCP server lists its tools','Each has a name, a description, an input schema and now an output schema','The agent picks tools by reading the descriptions'] },
      { t:'One call', k:['Since the 2026-07-28 spec each call stands alone: no session, no handshake','Headers name the method and tool, so the gateway can route and check it','Results carry structured content as well as text'] },
      { t:'A chain', k:['Agents chain small tools instead of one big query','Without sessions, each call passes the IDs it needs','Every call is logged for audit'] },
      { t:'Guardrails', k:['AgentCore Policy checks every call at the gateway','Default deny: only what a rule allows gets through','The IAM role can only read, even if everything else fails'] },
      { t:'Agent to agent', k:['MCP connects an agent to tools','A2A connects an agent to another agent','Both now sit under the Linux Foundation\u2019s Agentic AI Foundation'] }
    ], {
      1: () => { anim(tc.children, { opacity:[0,1], y:[8,0] }, { duration:0.3, delay: dl(0, 0.08) }); tour.play(); },
      2: () => seq(),
      3: () => chainRun(),
      4: () => guard(),
      5: () => a2a()
    });
    tour = Tour(box, [
      [1, 1, 'The name the agent will call.'],
      [2, 2, 'The description: the agent reads this to decide when the tool fits.'],
      [3, 11, 'The input schema: which arguments are allowed, and their types.'],
      [12, 17, 'New in the 2026 spec: an output schema, so results can come back as structured data.']
    ], document.getElementById('x5cap'), api);
  })();

  /* ================= Chapter 6 ================= */
  (function(){
    if (!document.getElementById('dd6')) return;
    const ver = [1, 6, 0];
    const digits = Array.from(document.querySelectorAll('#x6ver .vd b'));
    const why = document.getElementById('x6why');
    function paint(){ digits.forEach((d, i) => d.textContent = ver[i]); }
    document.querySelectorAll('#x6chg button').forEach(b => b.addEventListener('click', async () => {
      const k = Number(b.dataset.k);
      ver[k]++; for (let j = k + 1; j < 3; j++) ver[j] = 0;
      const moved = digits.slice(k);
      await anim(moved, { y:[0,-14], opacity:[1,0] }, { duration:0.18 });
      paint();
      anim(moved, { y:[14,0], opacity:[0,1] }, { duration:0.25 });
      anim(digits[k].parentElement, { scale:[1, 1.12, 1] }, { duration:0.4 });
      document.querySelectorAll('#x6ver .vd').forEach((v, i) => v.classList.toggle('hot', i === k));
      why.textContent = b.dataset.t; anim(why, { opacity:[0,1] }, { duration:0.3 });
    }));
    async function release(){
      const mj = document.getElementById('x6major'), m1 = document.getElementById('x6mig1'), m2 = document.getElementById('x6mig2');
      mj.style.opacity = 0; m1.style.opacity = 0; m2.style.opacity = 0;
      await wait(300);
      await anim(mj, { opacity:[0,1], scale:[0.4,1.2,1] }, { duration:0.5 });
      anim(m1, { opacity:[0,1], x:[-10,0] }, { duration:0.35, delay:0.2 });
      anim(m2, { opacity:[0,1], x:[-10,0] }, { duration:0.35, delay:0.4 });
    }
    document.getElementById('x6rel').addEventListener('click', release);
    const JSWAP = 'POST /_aliases\n{\n  "actions": [\n    { "remove": { "index": "entities_v1_6", "alias": "entities" } },\n    { "add":    { "index": "entities_v1_7", "alias": "entities" } }\n  ]\n}';
    const JBACK = 'POST /_aliases\n{\n  "actions": [\n    { "remove": { "index": "entities_v1_7", "alias": "entities" } },\n    { "add":    { "index": "entities_v1_6", "alias": "entities" } }\n  ]\n}';
    const jpre = document.getElementById('x6json');
    render(jpre, JSWAP, 'opensearch');
    const bBuild = document.getElementById('x6build'), bSwap = document.getElementById('x6swap'), bBack = document.getElementById('x6back');
    const arA = document.getElementById('x6arA'), arB = document.getElementById('x6arB'), ixA = document.getElementById('x6ixA'), ixB = document.getElementById('x6ixB');
    const stA = document.getElementById('x6stA'), stB = document.getElementById('x6stB'), fill = document.getElementById('x6fill');
    function resetAlias(){
      arA.style.opacity = 1; arB.style.opacity = 0; ixA.style.opacity = 1; ixB.style.opacity = 0.35;
      stA.textContent = 'live'; stB.textContent = 'not built yet'; fill.setAttribute('width', 0);
      bBuild.disabled = false; bSwap.disabled = true; bBack.disabled = true;
      bBuild.classList.add('go'); bSwap.classList.remove('go'); bBack.classList.remove('go');
      render(jpre, JSWAP, 'opensearch');
    }
    bBuild.addEventListener('click', async () => {
      if (bBuild.dataset.reset === '1'){ delete bBuild.dataset.reset; bBuild.textContent = '1. Build v1.7'; resetAlias(); return; }
      bBuild.disabled = true; bBuild.classList.remove('go');
      anim(ixB, { opacity:[0.35, 1] }, { duration:0.3 });
      stB.textContent = 'backfilling from Neptune';
      await tween({ duration:1.6, onUpdate: v => fill.setAttribute('width', (100 * v).toFixed(1)) });
      stB.textContent = 'built, competency questions pass';
      bSwap.disabled = false; bSwap.classList.add('go');
    });
    bSwap.addEventListener('click', async () => {
      bSwap.disabled = true; bSwap.classList.remove('go');
      render(jpre, JSWAP, 'opensearch'); anim(jpre, { opacity:[0.3,1] }, { duration:0.3 });
      anim(document.getElementById('x6pill'), { scale:[1, 1.08, 1] }, { duration:0.4 });
      anim(arA, { opacity:0 }, { duration:0.3 }); await anim(arB, { opacity:[0,1] }, { duration:0.4 });
      stA.textContent = 'standby, kept for rollback'; stB.textContent = 'live'; anim(ixA, { opacity:0.55 }, { duration:0.3 });
      bBack.disabled = false; bBack.classList.add('go');
    });
    bBack.addEventListener('click', async () => {
      bBack.disabled = true; bBack.classList.remove('go');
      render(jpre, JBACK, 'opensearch'); anim(jpre, { opacity:[0.3,1] }, { duration:0.3 });
      anim(arB, { opacity:0 }, { duration:0.3 }); await anim(arA, { opacity:[0,1] }, { duration:0.4 });
      anim(ixA, { opacity:1 }, { duration:0.3 });
      stA.textContent = 'live again'; stB.textContent = 'standby, investigate';
      setTimeout(() => { bBuild.disabled = false; bBuild.textContent = 'Start over'; bBuild.dataset.reset = '1'; bBuild.classList.add('go'); }, 400);
    });
    DD('dd6', [
      { t:'Version numbers', k:['Three numbers: major, minor, patch','The kind of change picks which one moves','Anything short of major is safe to take'] },
      { t:'Who pins what', k:['Each consumer pins a version or a range','Minor and patch releases flow in automatically','A major release needs a migration window'] },
      { t:'Alias swap', k:['Queries use the alias, never the index name','The new index is built and tested alongside','One atomic call moves the alias'] },
      { t:'Release runbook', k:['Snapshot first, swap last','Keep the old indexes until the new ones prove out','Rollback is the same call in reverse'] }
    ], {
      1: () => { anim(document.querySelectorAll('#x6ver .vd'), { opacity:[0,1], y:[10,0] }, { duration:0.35, delay: dl(0, 0.12) }); },
      2: () => release(),
      3: () => { if (bBuild.disabled && bSwap.disabled && bBack.disabled) resetAlias(); },
      4: () => { const li = document.querySelectorAll('#x6run li'), rb = document.getElementById('x6rb'); hideAll(li); rb.style.opacity = 0; anim(li, { opacity:[0,1], x:[-10,0] }, { duration:0.35, delay: dl(0.1, 0.3) }); anim(rb, { opacity:[0,1], y:[8,0] }, { duration:0.4, delay:1.8 }); }
    });
  })();
})();
