(function(){
  const M = window.Motion;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function anim(t, k, o){
    if (typeof HTMLCollection !== 'undefined' && t instanceof HTMLCollection) t = Array.from(t);
    if (!M){ const els = t instanceof Element ? [t] : Array.from(t); els.forEach(e => { for (const p in k){ if (p === 'x' || p === 'y' || p === 'scale' || p === 'scaleX') continue; const v = Array.isArray(k[p]) ? k[p][k[p].length-1] : k[p]; e.style[p] = v; } }); return Promise.resolve(); }
    if (reduce) o = Object.assign({}, o, { duration:0, delay:0 });
    return Promise.resolve(M.animate(t, k, o || {}));
  }
  const wait = ms => new Promise(r => setTimeout(r, reduce ? 0 : ms));
  const dl = (b, s) => (i) => b + i * s;
  const lines = (code, lang) => (window.__prismLines ? window.__prismLines(code, lang) : code.split('\n').map(x => x.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')));
  function render(pre, code, lang){ pre.innerHTML = lines(code, lang).map(l => '<span class="ln">' + (l || ' ') + '</span>').join(''); }
  function drawIn(paths, delay0){
    Array.from(paths).forEach((p, i) => {
      const len = p.getTotalLength(); p.style.strokeDasharray = len; p.style.strokeDashoffset = len;
      anim(p, { strokeDashoffset:[len, 0] }, { duration:0.5, delay:(delay0 || 0) + i * 0.12 }).then(() => { p.style.strokeDasharray = ''; p.style.strokeDashoffset = ''; });
    });
  }

  const STEPS = [
    { t:'The story', keys:['A real card-not-present payment, and its dispute','These are instances: things that happened','The ontology defines what kinds of things they are'] },
    { t:'OWL', keys:['OWL, the Web Ontology Language, defines classes and relationships','Classes form a hierarchy: a Chargeback is a DisputeEvent','It describes meaning, not individual payments'] },
    { t:'Turtle', keys:['Turtle is a plain-text way to write OWL','Each statement is a sentence: subject, predicate, object','Prefixes are short names for full web addresses'] },
    { t:'Git', keys:['The Turtle files live in a Git repository','Every change is a pull request that people review','Tags mark releases that other teams can pin'] },
    { t:'SHACL', keys:['SHACL, the Shapes Constraint Language, checks data','A shape lists what a valid Chargeback must have','Data that fails never reaches Neptune'] },
    { t:'OWL vs SHACL', keys:['OWL: missing information is unknown','SHACL: missing information is an error','You need both: meaning to share, rules to enforce'] },
    { t:'Four forms', keys:['The same Chargeback appears in four places','Only the Turtle and SHACL are written by hand','The generator produces the rest'] }
  ];

  const steps = document.getElementById('ddsteps'), keys = document.getElementById('ddkeys');
  const panels = Array.from(document.querySelectorAll('.dpanel'));
  const btns = STEPS.map((s, i) => {
    const b = document.createElement('button'); b.type = 'button';
    b.innerHTML = '<span class="num">' + (i + 1) + '</span>' + s.t;
    b.addEventListener('click', () => show(i + 1)); steps.appendChild(b); return b;
  });
  let cur = 1;
  function show(n, play){
    cur = n;
    btns.forEach((b, i) => { if (i === n - 1) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current'); });
    const s = STEPS[n - 1];
    keys.innerHTML = '<h3>' + s.t + '</h3><ul>' + s.keys.map(k => '<li>' + k + '</li>').join('') + '</ul>' +
      (n < STEPS.length ? '<button type="button" class="vbtn go ddnext">Next: ' + STEPS[n].t + '</button>' : '<a class="vbtn go ddnext" href="#v1h">Next: how version 1 gets made</a>');
    const nx = keys.querySelector('button.ddnext'); if (nx) nx.addEventListener('click', () => show(n + 1));
    anim(keys, { opacity:[0,1], x:[-8,0] }, { duration:0.3 });
    panels.forEach(p => { p.hidden = Number(p.dataset.d) !== n; });
    const pn = panels[n - 1]; anim(pn, { opacity:[0,1] }, { duration:0.25 });
    stopTtl();
    if (RUN[n] && play !== false) RUN[n]();
  }

  // 1: story
  function p1(){
    const svg = document.getElementById('ddStory');
    anim(svg.querySelectorAll('.sc'), { opacity:[0,1], y:[8,0] }, { duration:0.4, delay: dl(0, 0.08) });
    const ev = svg.querySelectorAll('.se'), ar = svg.querySelectorAll('.sa');
    Array.from(ev).forEach(g => g.style.opacity = 0);
    anim(ev[0], { opacity:[0,1], y:[10,0] }, { duration:0.4, delay:0.5 });
    drawIn([ar[0]], 1.0);
    anim(ev[1], { opacity:[0,1], y:[10,0] }, { duration:0.4, delay:1.4 });
    drawIn([ar[1]], 1.9);
    anim(ev[2], { opacity:[0,1], y:[10,0], scale:[0.96,1] }, { duration:0.45, delay:2.3 });
  }

  // 2: OWL
  function p2(){
    const svg = document.getElementById('ddOwl');
    const cls = svg.querySelectorAll('.cls'); Array.from(cls).forEach(g => g.style.opacity = 0);
    anim(cls, { opacity:[0,1], y:[8,0] }, { duration:0.35, delay: dl(0, 0.1) });
    drawIn(svg.querySelectorAll('.isa'), 0.8);
    drawIn(svg.querySelectorAll('.rel'), 1.4);
    const rl = svg.querySelectorAll('.rl'); Array.from(rl).forEach(t => t.style.opacity = 0);
    anim(rl, { opacity:[0,1] }, { duration:0.3, delay: dl(1.8, 0.12) });
  }

  // 3: Turtle
  const TTL = [
    '@prefix pay:  <https://ontology.example.com/payments/> .',
    '@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .',
    '@prefix owl:  <http://www.w3.org/2002/07/owl#> .',
    '',
    'pay:Chargeback  a                owl:Class .',
    'pay:Chargeback  rdfs:subClassOf  pay:DisputeEvent .',
    'pay:Chargeback  rdfs:label       "Chargeback"@en .',
    '',
    'pay:disputes    a                owl:ObjectProperty ;',
    '                rdfs:domain      pay:Chargeback ;',
    '                rdfs:range       pay:Capture .'
  ].join('\n');
  const TS = [
    { a:0, z:2, p:['pay:', 'stands for', 'https://ontology.example.com/payments/'], labels:['Prefix','',"Full address (IRI)"], r:'Prefixes are short names. pay: stands for your ontology\u2019s web address, its IRI.' },
    { a:4, z:4, p:['pay:Chargeback', 'a', 'owl:Class'], r:'Chargeback is a class: a kind of thing.' },
    { a:5, z:5, p:['pay:Chargeback', 'rdfs:subClassOf', 'pay:DisputeEvent'], r:'Every Chargeback is also a DisputeEvent.' },
    { a:6, z:6, p:['pay:Chargeback', 'rdfs:label', '"Chargeback"@en'], r:'Its name for people, in English.' },
    { a:8, z:8, p:['pay:disputes', 'a', 'owl:ObjectProperty'], r:'disputes is a relationship between two things.' },
    { a:9, z:9, p:['pay:disputes', 'rdfs:domain', 'pay:Chargeback'], r:'The semicolon reuses the subject. The relationship starts at a Chargeback\u2026' },
    { a:10, z:10, p:['pay:disputes', 'rdfs:range', 'pay:Capture'], r:'\u2026and points to a Capture. That is the DISPUTES arrow from the OWL step.' }
  ];
  const ttlPre = document.getElementById('ddTtl'), ttlBox = document.getElementById('ddTtlBox'), band = document.getElementById('ddTtlBand');
  const triple = document.getElementById('ddTriple'), reading = document.getElementById('ddReading');
  render(ttlPre, TTL, 'turtle');
  const tl = Array.from(ttlPre.querySelectorAll('.ln'));
  let ti = 0, ttlRun = 0;
  function setT(i){
    ti = i; const s = TS[i];
    const base = ttlBox.getBoundingClientRect().top - ttlBox.scrollTop;
    const top = tl[s.a].getBoundingClientRect().top - base, h = tl[s.z].getBoundingClientRect().bottom - tl[s.a].getBoundingClientRect().top;
    anim(band, { top: top + 'px', height: h + 'px', opacity: 1 }, { duration:0.4, ease:[0.22,1,0.36,1] });
    const L = s.labels || ['Subject', 'Predicate', 'Object'], C = ['var(--onto)', 'var(--graph)', 'var(--search)'];
    triple.innerHTML = s.p.map((x, k) => '<div class="part" style="--c:' + C[k] + '"><small>' + (L[k] || '&nbsp;') + '</small><code>' + x.replace(/</g, '&lt;') + '</code></div>' + (k < 2 ? '<span class="tar">\u2192</span>' : '')).join('');
    anim(triple.querySelectorAll('.part'), { opacity:[0,1], y:[6,0] }, { duration:0.3, delay: dl(0, 0.08) });
    reading.textContent = s.r; anim(reading, { opacity:[0,1] }, { duration:0.3, delay:0.2 });
  }
  function stopTtl(){ ttlRun++; }
  async function playTtl(){ const my = ++ttlRun; for (let i = 0; i < TS.length; i++){ if (my !== ttlRun) return; setT(i); await wait(2600); } }
  document.getElementById('ddTtlNext').addEventListener('click', () => { stopTtl(); setT((ti + 1) % TS.length); });
  document.getElementById('ddTtlPrev').addEventListener('click', () => { stopTtl(); setT((ti - 1 + TS.length) % TS.length); });
  document.getElementById('ddTtlPlay').addEventListener('click', playTtl);
  tl.forEach((ln, i) => ln.addEventListener('click', () => { const k = TS.findIndex(s => i >= s.a && i <= s.z); if (k >= 0){ stopTtl(); setT(k); } }));
  function p3(){ requestAnimationFrame(() => setT(0)); }

  // 4: Git
  async function p4(){
    const svg = document.getElementById('ddGit');
    drawIn([svg.querySelector('.gmain')], 0);
    const main = Array.from(svg.querySelectorAll('.gc:not(.br):not(.mg)')), tags = svg.querySelectorAll('.gtag:not(.new)');
    Array.from(svg.querySelectorAll('.gc, .gtag')).forEach(g => g.style.opacity = 0);
    anim(main, { opacity:[0,1], scale:[0.4,1] }, { duration:0.3, delay: dl(0.3, 0.15) });
    anim(tags, { opacity:[0,1], y:[-6,0] }, { duration:0.3, delay: dl(0.4, 0.15) });
    drawIn([svg.querySelector('.gbranch')], 0.9);
    anim(svg.querySelectorAll('.gc.br'), { opacity:[0,1], scale:[0.4,1] }, { duration:0.3, delay: dl(1.3, 0.25) });
    const ck = Array.from(document.querySelectorAll('#ddGck li'));
    ck.forEach(li => li.classList.remove('ok'));
    const mg = document.getElementById('ddMerge'); mg.style.opacity = 0;
    await wait(1900);
    for (const li of ck){ if (cur !== 4) return; li.classList.add('ok'); anim(li.querySelector('i'), { scale:[0.4,1] }, { duration:0.25 }); await wait(420); }
    anim(svg.querySelector('.gc.mg'), { opacity:[0,1], scale:[0.3,1.2,1] }, { duration:0.45 });
    anim(svg.querySelector('.gtag.new'), { opacity:[0,1], y:[-8,0] }, { duration:0.35, delay:0.2 });
    anim(mg, { opacity:[0,1], x:[-6,0] }, { duration:0.3, delay:0.3 });
  }

  // 5: SHACL
  const REPORT = [
    '# validation report',
    'conforms     false',
    'focus node   pay:cb991',
    'path         pay:disputes',
    'message      A Chargeback must dispute exactly one Capture'
  ].join('\n');
  const SHAPE = [
    'pay:ChargebackShape  a  sh:NodeShape ;',
    '    sh:targetClass  pay:Chargeback ;',
    '    sh:property [',
    '        sh:path      pay:disputes ;',
    '        sh:class     pay:Capture ;',
    '        sh:minCount  1 ;  sh:maxCount  1 ;',
    '        sh:message   "A Chargeback must dispute exactly one Capture" ] ;',
    '    sh:property [ sh:path pay:hasReason ; sh:class pay:ReasonCode ; sh:minCount 1 ] ;',
    '    sh:property [ sh:path pay:openedAt ; sh:datatype xsd:dateTime ; sh:minCount 1 ] .'
  ].join('\n');
  render(document.getElementById('ddReportPre'), REPORT, 'walktext');
  render(document.getElementById('ddShape'), SHAPE, 'turtle');
  const report = document.getElementById('ddReport');
  const RES = { a:[1,1,1], b:[0,1,1] };
  let vRun = 0;
  async function validate(){
    const my = ++vRun;
    document.querySelectorAll('.mk').forEach(m => { m.className = 'mk'; m.textContent = ''; });
    document.getElementById('recA').classList.remove('pass', 'fail'); document.getElementById('recB').classList.remove('pass', 'fail');
    report.style.opacity = 0; report.hidden = true;
    const rows = Array.from(document.querySelectorAll('.rrow:not(.rh)'));
    for (let r = 0; r < 3; r++){
      if (my !== vRun) return;
      anim(rows[r], { backgroundColor:['rgba(175,169,236,0.25)', 'rgba(175,169,236,0)'] }, { duration:0.8 });
      for (const c of ['a', 'b']){
        await wait(260); if (my !== vRun) return;
        const m = document.querySelector('.mk[data-r="' + r + '"][data-c="' + c + '"]'), ok = RES[c][r] === 1;
        m.className = 'mk ' + (ok ? 'ok' : 'no'); m.textContent = ok ? '\u2713' : '\u2715';
        anim(m, { scale:[0.3,1] }, { duration:0.25 });
      }
    }
    await wait(300); if (my !== vRun) return;
    document.getElementById('recA').classList.add('pass'); document.getElementById('recB').classList.add('fail');
    anim(document.getElementById('recB'), { x:[0,-6,6,-4,4,0] }, { duration:0.45 });
    report.hidden = false; anim(report, { opacity:[0,1], y:[8,0] }, { duration:0.35, delay:0.2 });
  }
  document.getElementById('ddValidate').addEventListener('click', validate);
  const shapeBtn = document.getElementById('ddShapeBtn'), shapeBox = document.getElementById('ddShapeBox');
  shapeBtn.addEventListener('click', () => {
    const open = shapeBox.hidden; shapeBox.hidden = !open;
    shapeBtn.textContent = open ? 'Hide the shape' : 'Show the shape in SHACL'; shapeBtn.setAttribute('aria-expanded', open);
    if (open) anim(shapeBox, { opacity:[0,1], y:[6,0] }, { duration:0.3 });
  });
  function p5(){ setTimeout(() => { if (cur === 5) validate(); }, reduce ? 0 : 500); }

  // 6: open vs closed world
  const wBtns = Array.from(document.querySelectorAll('#ddWorlds button'));
  const ghost = document.getElementById('wGhost'), wEdge = document.getElementById('wEdge'), wX = document.getElementById('wX'), wNode = document.getElementById('wNode'), wText = document.getElementById('ddWorldText');
  let wRun = 0;
  function world(w){
    wBtns.forEach(b => b.setAttribute('aria-pressed', b.dataset.w === w));
    const owl = w === 'owl';
    wEdge.classList.toggle('bad', !owl); wNode.classList.toggle('badn', !owl);
    anim(ghost, { opacity: owl ? 1 : 0.12 }, { duration:0.4 });
    anim(wX, { opacity: owl ? 0 : 1, scale: owl ? 0.6 : [0.4, 1] }, { duration:0.35 });
    wText.textContent = owl ? 'OWL: a capture probably exists; we just haven\u2019t been told about it. Nothing is wrong, the knowledge is incomplete.'
                            : 'SHACL: the required DISPUTES link is missing, so cb:991 is invalid and is stopped at the load gate.';
    anim(wText, { opacity:[0,1] }, { duration:0.3 });
  }
  wBtns.forEach(b => b.addEventListener('click', () => { wRun++; world(b.dataset.w); }));
  function p6(){ const my = ++wRun; world('owl'); setTimeout(() => { if (my === wRun && cur === 6) world('shacl'); }, reduce ? 0 : 2600); }

  // 7: four forms
  const F = [
    ['turtle', 'pay:Chargeback  a  owl:Class ;\n    rdfs:subClassOf  pay:DisputeEvent ;\n    rdfs:label  "Chargeback"@en .'],
    ['turtle', 'pay:ChargebackShape  a  sh:NodeShape ;\n    sh:targetClass  pay:Chargeback ;\n    sh:property [ sh:path pay:disputes ;\n        sh:minCount 1 ; sh:maxCount 1 ] .'],
    ['cypher', "MERGE (cb:Chargeback:DisputeEvent:PaymentEvent\n       {id: 'cb:1001'})\nSET cb.opened_at =\n      datetime('2026-08-19T14:05:00Z'),\n    cb.ontology_version = '1.6.0'\nMERGE (cap:Capture:PaymentEvent {id:'cap:7731'})\nMERGE (cb)-[:DISPUTES]->(cap)"],
    ['json', '{\n  "neptune_id": "cb:1001",\n  "labels": ["Chargeback", "DisputeEvent",\n             "PaymentEvent"],\n  "codes": ["10.4"],\n  "summary": "Chargeback, Harbor Grill order",\n  "ontology_version": "1.6.0"\n}']
  ];
  F.forEach((f, i) => render(document.getElementById('ddF' + i), f[1], f[0]));
  function p7(){
    const forms = document.querySelectorAll('.form'), gen = document.getElementById('ddGen');
    Array.from(forms).forEach(f => f.style.opacity = 0); gen.style.opacity = 0;
    anim([forms[0], forms[1]], { opacity:[0,1], y:[10,0] }, { duration:0.4, delay: dl(0.1, 0.2) });
    anim(gen, { opacity:[0,1], scaleX:[0.2,1] }, { duration:0.5, delay:0.8 });
    anim([forms[2], forms[3]], { opacity:[0,1], y:[-10,0] }, { duration:0.4, delay: dl(1.4, 0.2) });
  }

  const RUN = { 1:p1, 2:p2, 3:p3, 4:p4, 5:p5, 6:p6, 7:p7 };
  show(1, false);
  let seen = false;
  const dd = document.getElementById('dd1');
  if (M && M.inView) M.inView(dd, () => { if (!seen && cur === 1){ seen = true; p1(); } }, { amount:0.3 });
})();
