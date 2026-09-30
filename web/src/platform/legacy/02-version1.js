(function(){
  const NS = 'http://www.w3.org/2000/svg';
  const M = window.Motion;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wait = ms => new Promise(r => setTimeout(r, reduce ? 0 : ms));
  const SKIP = { x:1, y:1, scale:1, rotate:1 };
  function anim(target, kf, opts){
    if (typeof HTMLCollection !== 'undefined' && target instanceof HTMLCollection) target = Array.from(target);
    if (!M){ const els = target instanceof Element ? [target] : Array.from(target);
      els.forEach(e => { for (const k in kf){ if (SKIP[k]) continue; const v = Array.isArray(kf[k]) ? kf[k][kf[k].length - 1] : kf[k]; e.style[k] = v; } });
      return Promise.resolve();
    }
    if (reduce) opts = Object.assign({}, opts, { duration:0, delay:0 });
    return Promise.resolve(M.animate(target, kf, opts || {}));
  }
  function tween(opts){
    if (!M || reduce){ opts.onUpdate && opts.onUpdate(1); return Promise.resolve(); }
    return Promise.resolve(M.animate(0, 1, opts));
  }
  const dl = (base, step) => (i) => base + i * step;
  function onView(elm, fn, amount){
    if (M && M.inView) M.inView(elm, () => { fn(); }, { amount: amount || 0.35 });
    else fn();
  }
  function el(tag, attrs, parent){ const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; }
  function roundedPath(pts, r){
    r = r || 9;
    let d = 'M' + pts[0][0] + ',' + pts[0][1];
    for (let i = 1; i < pts.length - 1; i++){
      const [x0,y0] = pts[i-1], [x1,y1] = pts[i], [x2,y2] = pts[i+1];
      const l1 = Math.hypot(x1-x0, y1-y0), l2 = Math.hypot(x2-x1, y2-y1);
      const rr = Math.min(r, l1/2, l2/2);
      d += ' L' + (x1 - (x1-x0)/l1*rr) + ',' + (y1 - (y1-y0)/l1*rr) + ' Q' + x1 + ',' + y1 + ' ' + (x1 + (x2-x1)/l2*rr) + ',' + (y1 + (y2-y1)/l2*rr);
    }
    const last = pts[pts.length-1];
    return d + ' L' + last[0] + ',' + last[1];
  }
  function packet(layer, path, color, dur){
    if (reduce || !M) return Promise.resolve();
    const len = path.getTotalLength();
    const g = el('g', {}, layer);
    const h = el('circle', { r:9, opacity:0.22 }, g); h.style.fill = color;
    const c = el('circle', { r:4.5 }, g); c.style.fill = color; c.style.stroke = 'var(--raised)'; c.style.strokeWidth = '1.5';
    const place = v => { const p = path.getPointAtLength(v * len); g.setAttribute('transform', 'translate(' + p.x + ',' + p.y + ')'); };
    place(0);
    return tween({ duration: dur || Math.min(1.4, 0.4 + len / 500), ease:[0.45,0,0.2,1], onUpdate: place }).then(() => g.remove());
  }

  // ================= Section nav =================
  const links = Array.from(document.querySelectorAll('#toc a'));
  const targets = links.map(a => { const t = document.querySelector(a.getAttribute('href')); return t ? (t.tagName === 'SECTION' ? t : t.closest('section')) : null; });
  if ('IntersectionObserver' in window){
    const io = new IntersectionObserver(entries => {
      entries.forEach(en => { if (en.isIntersecting){ const i = targets.indexOf(en.target); links.forEach((a, j) => a.classList.toggle('here', j === i)); const cur = links[i], toc = document.getElementById('toc'); if (cur && toc && toc.scrollWidth > toc.clientWidth) toc.scrollTo({ left: cur.offsetLeft - toc.clientWidth / 2 + cur.clientWidth / 2, behavior: 'smooth' }); } });
    }, { rootMargin:'-22% 0px -70% 0px' });
    targets.forEach(t => t && io.observe(t));
  }

  // ================= v1 overview =================
  const v1svg = document.getElementById('v1map');
  const gE = document.getElementById('v1edges'), gN = document.getElementById('v1nodes'), gP = document.getElementById('v1pk');
  const V1N = {
    n1:{x:40, y:62, w:200,h:64, t:'Competency questions', s:'What must it answer?', step:1, badge:true},
    n3:{x:290,y:62, w:200,h:64, t:'Top level + standards', s:'FIBO and ISO 20022 as guides', step:3, badge:true},
    n2a:{x:40,y:224,w:200,h:64, t:'Code, schemas, specs', s:'Repos, ISO 8583, reason codes', step:2, badge:true},
    n2b:{x:290,y:224,w:200,h:64, t:'Term inventory', s:'Names, sources, synonyms', step:2},
    n4:{x:575,y:142,w:190,h:52, t:'Modeling patterns', s:'Rules before names', step:4, badge:true},
    n5:{x:575,y:208,w:190,h:52, t:'Definitions + shapes', s:'Meaning and constraints', step:5, badge:true},
    n6:{x:840,y:138,w:150,h:82, t:'Prove with data', s:'Run every question', s2:'as Cypher', step:6, badge:true}
  };
  const V1E = {
    tests:{ p:[[215,62],[215,29],[915,29],[915,138]], dash:true },
    e1:{ p:[[240,94],[290,94]] },
    e2:{ p:[[240,256],[290,256]] },
    e3:{ p:[[490,94],[525,94],[525,150],[560,150]] },
    e4:{ p:[[490,256],[525,256],[525,212],[560,212]] },
    e6:{ p:[[780,179],[840,179]] },
    e7:{ p:[[990,179],[1020,179]] },
    loop:{ p:[[915,220],[915,300],[670,300],[670,274]], dash:true }
  };
  const vEdge = {};
  Object.keys(V1E).forEach(k => { vEdge[k] = el('path', { d: roundedPath(V1E[k].p), class:'v1e' + (V1E[k].dash ? ' dash' : ''), 'marker-end':'url(#mg-line)' }, gE); });
  const vNode = {};
  Object.keys(V1N).forEach(k => {
    const n = V1N[k];
    const g = el('g', { class:'v1n', tabindex:'0', role:'button', 'aria-label':'Step ' + n.step + ': ' + n.t }, gN);
    el('rect', { class:'box', x:n.x, y:n.y, width:n.w, height:n.h, rx:9 }, g);
    const tx = n.x + 20;
    const tall = n.h > 70;
    const t1 = el('text', { class:'n-title', x:tx, y:n.y + (tall ? 30 : 27) }, g); t1.textContent = n.t;
    const t2 = el('text', { class:'n-sub', x:tx, y:n.y + (tall ? 49 : 45) }, g); t2.textContent = n.s;
    if (n.s2){ const t3 = el('text', { class:'n-sub', x:tx, y:n.y + 65 }, g); t3.textContent = n.s2; }
    if (n.badge){ el('circle', { class:'badge', cx:n.x, cy:n.y, r:11 }, g); const b = el('text', { class:'bnum', x:n.x, y:n.y + 4 }, g); b.textContent = n.step; }
    g.addEventListener('click', () => selectV1(n.step, true));
    g.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' '){ ev.preventDefault(); selectV1(n.step, true); } });
    vNode[k] = g;
  });
  const v10 = el('g', { class:'v1n v10', tabindex:'0', role:'button', 'aria-label':'Tag version 1.0' }, gN);
  el('circle', { cx:1052, cy:179, r:32 }, v10);
  const v10t = el('text', { x:1052, y:185 }, v10); v10t.textContent = '1.0';
  v10.addEventListener('click', () => selectV1(6, true));
  vNode.v10 = v10;

  const V1STEP = {
    1:{ n:['n1'], e:['tests'], title:'Write competency questions', keys:['30 to 50 real questions from the teams','No question needs it? It stays out of v1','Each question becomes a test'] },
    2:{ n:['n2a','n2b'], e:['e2','e4'], title:'Mine the evidence', keys:['One extraction run over repos and specs','Output: a term inventory, not Turtle','Claude clusters names; a person decides'] },
    3:{ n:['n3'], e:['e1','e3'], title:'Sketch the top level', keys:['About six top categories','Align to FIBO and ISO 20022 with mappings','Don\u2019t import them wholesale'] },
    4:{ n:['n4'], e:[], title:'Settle the patterns', keys:['Decide the rules before naming classes','Five rules cover most choices','Pick a rule to compare'] },
    5:{ n:['n5'], e:[], title:'Define and constrain', keys:['Label, definition, example, owner, status','SHACL says what valid data looks like','People and Claude both read definitions'] },
    6:{ n:['n6','v10'], e:['e6','e7','loop','tests'], title:'Prove it with data', keys:['Load a sample week, run every question','Can\u2019t write it? Something is missing','Five-hop workaround? A pattern is wrong'] }
  };

  const stepper = document.getElementById('v1steps');
  const keys = document.getElementById('v1keys');
  const panels = Array.from(document.querySelectorAll('.vpanel'));
  const sBtns = {};
  Object.keys(V1STEP).forEach(k => {
    const b = document.createElement('button');
    b.type = 'button'; b.innerHTML = '<span class="num">' + k + '</span>' + V1STEP[k].title;
    b.addEventListener('click', () => selectV1(Number(k), true));
    stepper.appendChild(b); sBtns[k] = b;
  });
  const replay = document.createElement('button');
  replay.type = 'button'; replay.className = 'vbtn replay'; replay.textContent = 'Play the overview';
  replay.addEventListener('click', () => v1intro());
  stepper.appendChild(replay);

  let v1cur = 0;
  function selectV1(step, fromUser){
    v1cur = step;
    const st = V1STEP[step];
    Object.keys(sBtns).forEach(k => { if (Number(k) === step) sBtns[k].setAttribute('aria-current', 'step'); else sBtns[k].removeAttribute('aria-current'); });
    Object.keys(vNode).forEach(k => {
      const on = st.n.includes(k);
      vNode[k].classList.toggle('on', on);
      anim(vNode[k], { opacity: on ? 1 : 0.4 }, { duration:0.3 });
    });
    Object.keys(vEdge).forEach(k => {
      const on = st.e.includes(k);
      vEdge[k].classList.toggle('on', on);
      vEdge[k].setAttribute('marker-end', on ? 'url(#mg-onto)' : 'url(#mg-line)');
    });
    keys.innerHTML = '<h3>' + st.title + '</h3><ul>' + st.keys.map(x => '<li>' + x + '</li>').join('') + '</ul>';
    anim(keys, { opacity:[0,1], x:[-8,0] }, { duration:0.3 });
    panels.forEach(p => { p.hidden = Number(p.dataset.v) !== step; });
    const pnl = panels.find(p => Number(p.dataset.v) === step);
    anim(pnl, { opacity:[0,1] }, { duration:0.25 });
    if (PANEL[step]) PANEL[step]();
  }

  async function v1intro(){
    const c = 'var(--onto)';
    Object.keys(vNode).forEach(k => anim(vNode[k], { opacity:1 }, { duration:0.2 }));
    packet(gP, vEdge.tests, c, 2.4);
    await Promise.all([packet(gP, vEdge.e1, c, 0.6), packet(gP, vEdge.e2, c, 0.6)]);
    await Promise.all([packet(gP, vEdge.e3, c, 0.8), packet(gP, vEdge.e4, c, 0.8)]);
    anim([vNode.n4, vNode.n5], { opacity:[0.4,1] }, { duration:0.4 });
    await packet(gP, vEdge.e6, c, 0.6);
    for (let i = 0; i < 2; i++){ await packet(gP, vEdge.loop, c, 1.1); await packet(gP, vEdge.e6, c, 0.5); }
    await packet(gP, vEdge.e7, c, 0.4);
    await anim(v10, { scale:[1,1.3,1] }, { duration:0.6, ease:'easeOut' });
    selectV1(v1cur || 1);
  }

  // ---------- Step 1 ----------
  function p1(){
    const pnl = panels[0];
    anim(pnl.querySelectorAll('.qcard'), { opacity:[0,1], y:[14,0] }, { duration:0.45, delay: dl(0, 0.07), ease:[0.22,1,0.36,1] });
    anim(pnl.querySelector('.scope'), { opacity:[0,1], scaleX:[0,1] }, { duration:0.5, delay:0.5 });
    anim(pnl.querySelectorAll('.outs span'), { opacity:[0,1], y:[-16,0] }, { duration:0.4, delay: dl(0.8, 0.08) });
  }

  // ---------- Step 2 ----------
  const pool = document.getElementById('pool');
  const chipOrder = Array.from(pool.children);
  const drops = {}; document.querySelectorAll('.drop').forEach(d => drops[d.dataset.drop] = d);
  const invRows = Array.from(document.querySelectorAll('#inv tbody tr'));
  let clustered = false, clusterRun = 0;
  function flip(elm, dest){
    const a = elm.getBoundingClientRect(); dest.appendChild(elm); const b = elm.getBoundingClientRect();
    return anim(elm, { x:[a.left - b.left, 0], y:[a.top - b.top, 0] }, { duration:0.55, ease:[0.22,1,0.36,1] });
  }
  function resetCluster(){
    clusterRun++; clustered = false;
    chipOrder.forEach(c => { pool.appendChild(c); c.style.transform = ''; });
    invRows.forEach(r => r.style.opacity = '0');
  }
  async function cluster(){
    if (clustered) return;
    clustered = true; const my = ++clusterRun;
    for (const ch of chipOrder){
      if (my !== clusterRun) return;
      flip(ch, ch.dataset.to === 'other' ? drops.cb : drops[ch.dataset.to]);
      await wait(200);
    }
    await wait(800); if (my !== clusterRun) return;
    const odd = chipOrder.find(c => c.dataset.to === 'other');
    await flip(odd, drops.other);
    anim(odd, { rotate:[0,-5,5,0] }, { duration:0.4 });
    await wait(300); if (my !== clusterRun) return;
    anim(document.querySelectorAll('.cl .who'), { scale:[1,1.15,1] }, { duration:0.4, delay: dl(0, 0.1) });
    anim(invRows, { opacity:[0,1], x:[-10,0] }, { duration:0.35, delay: dl(0.2, 0.12) });
  }
  document.getElementById('clusterBtn').addEventListener('click', () => { resetCluster(); requestAnimationFrame(() => cluster()); });
  document.getElementById('clusterReset').addEventListener('click', resetCluster);
  function p2(){ if (!clustered){ resetCluster(); setTimeout(() => { if (v1cur === 2) cluster(); }, reduce ? 0 : 500); } }
  invRows.forEach(r => r.style.opacity = '0');

  // ---------- Step 3 ----------
  const CATS = [
    ['Party','Cardholder, Merchant, Issuer, Acquirer','fibo'],
    ['Agreement','MerchantAgreement','fibo'],
    ['PaymentInstrument','Card, NetworkToken','iso'],
    ['PaymentEvent','Authorization, Capture, Settlement, Refund, Chargeback','iso'],
    ['Code','MCC, ReasonCode, ResponseCode',null],
    ['Network','CardNetwork, MethodOfPayment',null]
  ];
  const gCats = document.getElementById('cats'), gMaps = document.getElementById('maps'), gDots = document.getElementById('dots'), ovl = document.getElementById('ovl');
  const catEls = [], mapEls = [];
  let fiboY = 50, isoY = 160;
  CATS.forEach((c, i) => {
    const y = 14 + i * 48, cy = y + 20;
    const g = el('g', { class:'cat' }, gCats);
    el('rect', { class:'box', x:20, y:y, width:490, height:40, rx:8 }, g);
    const t = el('text', { class:'t', x:36, y:cy + 5 }, g); t.textContent = c[0];
    const s = el('text', { class:'s', x:198, y:cy + 4 }, g); s.textContent = c[1];
    catEls.push(g);
    if (c[2]){
      const ty = c[2] === 'fibo' ? fiboY : isoY; if (c[2] === 'fibo') fiboY += 30; else isoY += 30;
      mapEls.push(el('path', { class:'mapl', d:'M510,' + cy + ' C545,' + cy + ' 545,' + ty + ' 580,' + ty }, gMaps));
    }
  });
  let mode3 = 'align';
  function rnd(seed){ return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }
  function setMode3(m){
    mode3 = m;
    document.getElementById('modeAlign').setAttribute('aria-pressed', m === 'align');
    document.getElementById('modeImport').setAttribute('aria-pressed', m === 'import');
    if (m === 'import'){
      anim(catEls, { opacity:0.3 }, { duration:0.3 });
      anim(mapEls, { opacity:0 }, { duration:0.2 });
      gDots.replaceChildren();
      const r = rnd(7); const dots = [];
      for (let i = 0; i < 520; i++) dots.push(el('circle', { cx:(r() * 750 + 5).toFixed(1), cy:(r() * 296 + 5).toFixed(1), r:1.9, opacity:0 }, gDots));
      anim(dots, { opacity:[0,0.55], scale:[0,1] }, { duration:0.3, delay:(i) => (i / 520) * 1.2 });
      anim(ovl, { opacity:[0,1] }, { duration:0.3, delay:1.1 });
    } else {
      anim(ovl, { opacity:0 }, { duration:0.2 });
      const d = Array.from(gDots.children);
      if (d.length) anim(d, { opacity:0 }, { duration:0.3 }).then(() => { if (mode3 === 'align') gDots.replaceChildren(); });
      anim(catEls, { opacity:[0,1], x:[-10,0] }, { duration:0.35, delay: dl(0, 0.06) });
      mapEls.forEach((m, i) => { const len = m.getTotalLength(); m.style.opacity = 1; m.style.strokeDasharray = len; anim(m, { strokeDashoffset:[len, 0] }, { duration:0.6, delay:0.4 + i * 0.12 }).then(() => { m.style.strokeDasharray = ''; m.style.strokeDashoffset = ''; }); });
    }
  }
  document.getElementById('modeAlign').addEventListener('click', () => setMode3('align'));
  document.getElementById('modeImport').addEventListener('click', () => setMode3('import'));
  function p3(){ setMode3('align'); }

  // ---------- Step 4 ----------
  const ruleBtns = Array.from(document.querySelectorAll('#ruleTabs button'));
  const rules = Array.from(document.querySelectorAll('.rule'));
  function showRule(r){
    ruleBtns.forEach(b => b.setAttribute('aria-pressed', b.dataset.r === r));
    rules.forEach(x => x.hidden = x.dataset.r !== r);
    const cur = rules.find(x => x.dataset.r === r);
    anim(cur.querySelector('.avoid'), { opacity:[0,1], x:[-10,0] }, { duration:0.35 });
    const parts = cur.querySelectorAll('.do .mn, .do .ml, .do .el, .do code');
    anim(parts, { opacity:[0,1], y:[8,0] }, { duration:0.35, delay: dl(0.35, 0.09) });
  }
  ruleBtns.forEach(b => b.addEventListener('click', () => showRule(b.dataset.r)));
  function p4(){ const on = ruleBtns.find(b => b.getAttribute('aria-pressed') === 'true'); showRule(on ? on.dataset.r : 'a'); }

  // ---------- Step 5 ----------
  let rejRun = 0;
  async function p5(){
    const my = ++rejRun;
    anim(document.querySelectorAll('#ccard .row'), { opacity:[0,1], x:[-10,0] }, { duration:0.35, delay: dl(0.05, 0.1) });
    anim(document.querySelectorAll('#readers span'), { opacity:[0,1], scale:[0.9,1] }, { duration:0.3, delay: dl(0.7, 0.12) });
    document.querySelectorAll('#shapesvg .sh-e').forEach((ln, i) => {
      const len = Math.hypot(ln.x2.baseVal.value - ln.x1.baseVal.value, ln.y2.baseVal.value - ln.y1.baseVal.value);
      ln.style.strokeDasharray = len;
      anim(ln, { strokeDashoffset:[len, 0] }, { duration:0.5, delay:0.2 + i * 0.15 }).then(() => { ln.style.strokeDasharray = ''; ln.style.strokeDashoffset = ''; });
    });
    anim(document.querySelectorAll('#shapesvg .cbadge'), { opacity:[0,1] }, { duration:0.3, delay: dl(0.6, 0.15) });
    const ghost = document.getElementById('ghost'), rej = document.getElementById('rej');
    ghost.setAttribute('opacity', 0); rej.setAttribute('opacity', 0); ghost.style.opacity = ''; rej.style.opacity = '';
    await wait(1400); if (my !== rejRun) return;
    await anim(ghost, { opacity:[0,1], x:[-30,0] }, { duration:0.45 });
    await wait(300); if (my !== rejRun) return;
    anim(rej, { opacity:[0,1] }, { duration:0.25 });
    await anim(ghost, { x:[0,-7,7,-5,5,0] }, { duration:0.45 });
    anim(ghost, { opacity:0.4 }, { duration:0.4 });
  }
  const ttlBtn = document.getElementById('ttlBtn'), ttl = document.getElementById('ttl');
  ttlBtn.addEventListener('click', () => {
    const open = ttl.hidden; ttl.hidden = !open;
    ttlBtn.textContent = open ? 'Hide the Turtle' : 'Show the Turtle';
    ttlBtn.setAttribute('aria-expanded', open);
    if (open) anim(ttl, { opacity:[0,1], y:[6,0] }, { duration:0.3 });
  });

  // ---------- Step 6 ----------
  const board = document.getElementById('board');
  const sqs = [];
  for (let i = 0; i < 42; i++){ const d = document.createElement('div'); d.className = 'sq'; board.appendChild(d); sqs.push(d); }
  const ROUNDS = [
    { bad:[5,17,29,38], awk:[2,9,13,21,26,33,35,40], label:'Round 1: 30 pass, 8 awkward, 4 can\u2019t be written',
      notes:[['bad','Which captures haven\u2019t settled after 3 days?','Capture has no link to Settlement','Add SETTLES'],
             ['bad','Which merchants share devices with a flagged one?','No Device class','Add Device'],
             ['awk','Show the full lifecycle of this authorization','Five hops through a generic Transaction node','Link the events directly']] },
    { bad:[17], awk:[9,26,35], label:'Round 2: 38 pass, 3 awkward, 1 can\u2019t be written',
      notes:[['bad','What evidence did we send for this chargeback?','Evidence is a free-text field','Add Representment and Document'],
             ['awk','Which response codes spiked for this BIN range?','BIN range is a string property','Make BinRange a node']] },
    { bad:[], awk:[], label:'Round 3: all 42 pass',
      notes:[['pass','Every question now runs as a Cypher test in CI','Nothing missing, nothing awkward','Tag 1.0']] }
  ];
  const runBtn = document.getElementById('runBtn'), rcount = document.getElementById('rcount'), rnotes = document.getElementById('rnotes'), tag10 = document.getElementById('tag10');
  const stripSt = Array.from(document.querySelectorAll('#strip .st'));
  let round = -1, tagged = false;
  function reset6(){
    round = -1; tagged = false;
    sqs.forEach(q => q.className = 'sq');
    rcount.textContent = 'Illustrative run with 42 competency questions.';
    rnotes.replaceChildren(); tag10.style.display = 'none';
    stripSt.forEach(x => x.classList.remove('now'));
    runBtn.textContent = 'Run the questions';
  }
  async function highlightStrip(list){
    for (const i of list){ stripSt.forEach((x, j) => x.classList.toggle('now', j === i)); anim(stripSt[i], { scale:[0.94,1] }, { duration:0.25 }); await wait(380); }
    stripSt.forEach(x => x.classList.remove('now'));
  }
  runBtn.addEventListener('click', async () => {
    if (tagged){ reset6(); return; }
    if (round === 2){
      tagged = true; tag10.style.display = 'flex';
      anim(tag10, { scale:[0,1.15,1], opacity:[0,1] }, { duration:0.6 });
      runBtn.textContent = 'Start over'; return;
    }
    runBtn.disabled = true;
    round++;
    await highlightStrip(round === 0 ? [0,1,2] : [3,0,1,2]);
    const R = ROUNDS[round];
    sqs.forEach((q, i) => { q.className = 'sq ' + (R.bad.includes(i) ? 'bad' : R.awk.includes(i) ? 'awk' : 'pass'); });
    anim(sqs, { scale:[0.3,1] }, { duration:0.3, delay: dl(0, 0.018) });
    rcount.textContent = R.label;
    rnotes.replaceChildren();
    R.notes.forEach(n => {
      const li = document.createElement('li');
      li.innerHTML = '<i class="sq ' + n[0] + '"></i><div><b>' + n[1] + '</b><br><span class="rwhy">' + n[2] + '.</span> <span class="rfix">' + n[3] + '</span></div>';
      rnotes.appendChild(li);
    });
    anim(rnotes.children, { opacity:[0,1], y:[8,0] }, { duration:0.3, delay: dl(0.5, 0.1) });
    runBtn.textContent = round < 2 ? 'Fix the model and rerun' : 'Tag 1.0';
    runBtn.disabled = false;
  });
  function p6(){}

  const PANEL = { 1:p1, 2:p2, 3:p3, 4:p4, 5:p5, 6:p6 };
  selectV1(1);
  let v1seen = false;
  onView(v1svg, () => { if (!v1seen){ v1seen = true; v1intro(); } }, 0.45);

  // ================= People ring =================
  const tdots = document.getElementById('tdots'), revs = document.getElementById('revs'), pd = document.getElementById('pdots');
  const outer = [], ticks = [], inner = [];
  for (let i = 0; i < 12; i++){
    const a = -Math.PI / 2 + i * (2 * Math.PI / 12);
    outer.push(el('circle', { class:'tdot', cx:(150 + 124 * Math.cos(a)).toFixed(1), cy:(150 + 124 * Math.sin(a)).toFixed(1), r:9 }, tdots));
    ticks.push(el('line', { class:'rv', x1:(150 + 110 * Math.cos(a)).toFixed(1), y1:(150 + 110 * Math.sin(a)).toFixed(1), x2:(150 + 74 * Math.cos(a)).toFixed(1), y2:(150 + 74 * Math.sin(a)).toFixed(1), 'marker-end':'url(#mg-mut)' }, revs));
  }
  for (let i = 0; i < 5; i++){
    const a = -Math.PI / 2 + i * (2 * Math.PI / 5);
    inner.push(el('circle', { class:'pdot', cx:(150 + 26 * Math.cos(a)).toFixed(1), cy:(142 + 26 * Math.sin(a)).toFixed(1), r:8 }, pd));
  }
  onView(document.getElementById('peoplesvg'), () => {
    anim(inner, { scale:[0,1] }, { duration:0.4, delay: dl(0, 0.08) });
    anim(outer, { scale:[0,1], opacity:[0,1] }, { duration:0.35, delay: dl(0.4, 0.05) });
    anim(ticks, { opacity:[0,1] }, { duration:0.3, delay: dl(1.0, 0.04) });
    anim(document.querySelectorAll('.trow .tk'), { opacity:[0,1], y:[6,0] }, { duration:0.3, delay: dl(0.2, 0.04) });
  }, 0.4);

  // ================= Evolve =================
  const evsvg = document.getElementById('evsvg'), evp = document.getElementById('evpaths'), evpk = document.getElementById('evpk');
  const mk = (pts, cls, marker) => el('path', { d: roundedPath(pts, 10), class: cls, 'marker-end': marker || '' }, evp);
  mk([[570,155],[816,155]], 'evtrack');
  const pSrc = mk([[470,238],[470,191]], 'evl muted', 'url(#mg-mut)');
  const pCon = mk([[240,155],[369,155]], 'evl onto', 'url(#mg-onto)');
  const pMain = mk([[570,155],[819,155]], 'evl graph', 'url(#mg-graph8)');
  mk([[470,120],[470,48],[140,48],[140,119]], 'evl onto dash', 'url(#mg-onto)');
  const seg1 = el('path', { d: roundedPath([[470,120],[470,48],[426,48]], 10), fill:'none' }, evp);
  const seg2 = el('path', { d:'M334,48 L256,48', fill:'none' }, evp);
  const seg3 = el('path', { d: roundedPath([[224,48],[140,48],[140,120]], 10), fill:'none' }, evp);
  const ver = document.getElementById('ver'), prc = document.getElementById('prc'), gt = document.getElementById('gt');
  let evRun = 0;
  async function evolve(){
    const my = ++evRun;
    ver.textContent = 'v1.4'; gt.classList.remove('ok'); gt.querySelector('.chk').style.opacity = 0;
    evpk.replaceChildren();
    await packet(evpk, pCon, 'var(--onto)', 0.7);
    if (my !== evRun) return;
    const stream = [];
    for (let i = 0; i < 12; i++){
      stream.push(wait(i * 260).then(() => my === evRun && packet(evpk, pSrc, 'var(--muted)', 0.35)).then(() => my === evRun && packet(evpk, pMain, 'var(--graph)', 1.1)));
    }
    await wait(1300); if (my !== evRun) return;
    await packet(evpk, seg1, 'var(--onto)', 0.9);
    anim(prc.querySelector('rect'), { scale:[1,1.12,1] }, { duration:0.45 });
    await wait(500); if (my !== evRun) return;
    await packet(evpk, seg2, 'var(--onto)', 0.5);
    await wait(250); if (my !== evRun) return;
    gt.classList.add('ok'); anim(gt.querySelector('.chk'), { opacity:[0,1] }, { duration:0.3 });
    await wait(400); if (my !== evRun) return;
    await packet(evpk, seg3, 'var(--onto)', 0.7);
    if (my !== evRun) return;
    await anim(ver, { opacity:[1,0], y:[0,-8] }, { duration:0.2 });
    ver.textContent = 'v1.5';
    anim(ver, { opacity:[0,1], y:[8,0], scale:[1.3,1] }, { duration:0.4 });
    await Promise.all(stream);
  }
  let evSeen = false;
  onView(evsvg, () => { if (!evSeen){ evSeen = true; evolve(); } }, 0.5);
  document.getElementById('evReplay').addEventListener('click', evolve);

  // why cards
  onView(document.getElementById('whys'), async () => {
    anim(document.getElementById('wq'), { rotate:[0,-12,12,-8,8,0] }, { duration:0.8, delay:0.2 });
    await wait(700);
    const brk = document.getElementById('brk');
    brk.classList.add('broken');
    anim(document.getElementById('brkx'), { opacity:[0,1], scale:[0.5,1] }, { duration:0.3 });
    await wait(700);
    const tgt = document.getElementById('aliasTgt');
    await anim(tgt, { opacity:[1,0], y:[0,-10] }, { duration:0.25 });
    tgt.textContent = 'entities_v1_5';
    anim(tgt, { opacity:[0,1], y:[10,0] }, { duration:0.3 });
  }, 0.4);
})();
