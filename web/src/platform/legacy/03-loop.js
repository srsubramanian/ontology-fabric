(function(){
  const NS = 'http://www.w3.org/2000/svg';
  const M = window.Motion;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wait = ms => new Promise(r => setTimeout(r, reduce ? Math.min(ms, 400) : ms));
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
  function onView(elm, fn, amount){ if (M && M.inView) M.inView(elm, () => { fn(); }, { amount: amount || 0.35 }); else fn(); }
  function el(tag, attrs, parent){ const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; }
  function roundedPath(pts, r){
    r = r || 9;
    let d = 'M' + pts[0][0] + ',' + pts[0][1];
    for (let i = 1; i < pts.length - 1; i++){
      const [x0,y0] = pts[i-1], [x1,y1] = pts[i], [x2,y2] = pts[i+1];
      const l1 = Math.hypot(x1-x0, y1-y0), l2 = Math.hypot(x2-x1, y2-y1);
      if (!l1 || !l2) continue;
      const rr = Math.min(r, l1/2, l2/2);
      d += ' L' + (x1 - (x1-x0)/l1*rr) + ',' + (y1 - (y1-y0)/l1*rr) + ' Q' + x1 + ',' + y1 + ' ' + (x1 + (x2-x1)/l2*rr) + ',' + (y1 + (y2-y1)/l2*rr);
    }
    const last = pts[pts.length-1];
    return d + ' L' + last[0] + ',' + last[1];
  }

  const svg = document.getElementById('loopsvg');
  if (!svg) return;
  const gP = document.getElementById('lpaths'), gN = document.getElementById('lnodes'), gK = document.getElementById('lpk');

  const LN = {
    s0:{x:20, y:20, w:160,h:54, t:'Code merged', s:'Bitbucket webhook', c:'var(--muted)'},
    s1:{x:200,y:20, w:160,h:54, t:'Data won\u2019t fit', s:'SHACL violations', c:'var(--muted)'},
    s2:{x:380,y:20, w:160,h:54, t:'Failed questions', s:'RAG query logs', c:'var(--muted)'},
    s3:{x:560,y:20, w:160,h:54, t:'Network bulletins', s:'Visa, Mastercard', c:'var(--muted)'},
    bot:{x:20,y:118,w:700,h:54, t:'Proposal bot', s:'Drafts a pull request with evidence', c:'var(--query)', bar:true},
    chk:{x:20,y:216,w:700,h:54, t:'Automated checks', s:'SHACL, consistency, near duplicates, competency questions, impact', c:'var(--query)', bar:true},
    auto:{x:20, y:334,w:220,h:74, t:'Auto-merge', s:'Patch: aliases, code values', s2:'minutes', c:'var(--query)', bar:true},
    owner:{x:260,y:334,w:220,h:74, t:'Owner approves', s:'Minor: new class or relationship', s2:'about a day', c:'var(--onto)', bar:true},
    board:{x:500,y:334,w:220,h:74, t:'Change board', s:'Major: rename, remove, split', s2:'one release, with notice', c:'var(--ink)', bar:true},
    rel:{x:170,y:452,w:400,h:56, t:'Release train', s:'Regenerate, reindex, swap aliases', c:'var(--onto)', bar:true}
  };
  const E = {
    e_s0:[[100,74],[100,117]], e_s1:[[280,74],[280,117]], e_s2:[[460,74],[460,117]], e_s3:[[640,74],[640,117]],
    e_bc:[[370,172],[370,215]],
    e_ca:[[370,270],[370,302],[130,302],[130,333]],
    e_co:[[370,270],[370,333]],
    e_cb:[[370,270],[370,302],[610,302],[610,333]],
    e_ar:[[130,408],[130,430],[330,430],[330,451]],
    e_or:[[370,408],[370,451]],
    e_br:[[610,408],[610,430],[410,430],[410,451]]
  };
  const edgeEl = {};
  Object.keys(E).forEach(k => { edgeEl[k] = el('path', { d: roundedPath(E[k], 10), class:'le', 'marker-end':'url(#mg-line)' }, gP); });
  const nodeEl = {};
  let verEl;
  Object.keys(LN).forEach(k => {
    const n = LN[k];
    const g = el('g', { class:'ln' }, gN); g.style.setProperty('--c', n.c);
    const halo = el('rect', { class:'halo', x:n.x-5, y:n.y-5, width:n.w+10, height:n.h+10, rx:11 }, g);
    el('rect', { class:'box', x:n.x, y:n.y, width:n.w, height:n.h, rx:8 }, g);
    const tx = n.bar ? n.x + 20 : n.x + 14;
    if (n.bar) el('rect', { class:'lbar', x:n.x + 8, y:n.y + 10, width:3, height:n.h - 20, rx:1.5 }, g);
    const tall = n.h > 60;
    el('text', { class:'lnt', x:tx, y:n.y + (tall ? 25 : 23) }, g).textContent = n.t;
    el('text', { class:'lns', x:tx, y:n.y + (tall ? 43 : 41) }, g).textContent = n.s;
    if (n.s2) el('text', { class:'lnx', x:tx, y:n.y + 61 }, g).textContent = n.s2;
    if (k === 'rel'){ verEl = el('text', { class:'relver', x:n.x + n.w - 16, y:n.y + 35 }, g); verEl.textContent = 'v1.5.0'; }
    nodeEl[k] = { g, halo };
  });

  function light(nodes, edges){
    Object.keys(nodeEl).forEach(k => {
      const on = nodes.includes(k);
      nodeEl[k].g.classList.toggle('on', on);
      anim(nodeEl[k].g, { opacity: nodes.length && !on ? 0.45 : 1 }, { duration:0.3 });
    });
    Object.keys(edgeEl).forEach(k => {
      const on = edges.includes(k);
      edgeEl[k].classList.toggle('on', on);
      edgeEl[k].setAttribute('marker-end', on ? 'url(#mg-onto)' : 'url(#mg-line)');
    });
  }
  function pulse(k){ if (!reduce) anim(nodeEl[k].halo, { opacity:[0.9,0], scale:[1,1.05] }, { duration:0.6 }); }

  function makePacket(){
    const g = el('g', {}, gK);
    const h = el('circle', { r:10, opacity:0.22 }, g); h.style.fill = 'var(--onto)';
    const c = el('circle', { r:5 }, g); c.style.fill = 'var(--onto)'; c.style.stroke = 'var(--raised)'; c.style.strokeWidth = '1.5';
    return g;
  }
  function place(pk, x, y){ pk.setAttribute('transform', 'translate(' + x + ',' + y + ')'); }
  function go(pk, pts, dur){
    const path = el('path', { d: roundedPath(pts, 10), fill:'none' }, gP);
    const len = path.getTotalLength();
    const step = v => { const p = path.getPointAtLength(v * len); place(pk, p.x, p.y); };
    step(0);
    return tween({ duration: dur || Math.min(1.2, 0.3 + len / 450), ease:[0.45,0,0.2,1], onUpdate: step }).then(() => { step(1); path.remove(); });
  }

  const CHECKS = ['SHACL shapes valid', 'Ontology stays consistent', 'No near-duplicate classes', 'Competency questions pass', 'Impact report'];
  const TIERC = { patch:'var(--query)', minor:'var(--onto)', major:'var(--ink)' };
  const LANE = {
    auto:{ x:130, edge:'e_ca', rel:'e_ar', relX:330 },
    owner:{ x:370, edge:'e_co', rel:'e_or', relX:370 },
    board:{ x:610, edge:'e_cb', rel:'e_br', relX:410 }
  };
  const SIGX = [100, 280, 460, 640];
  const SCEN = {
    bulletin:{ sig:3, lane:'auto', tier:'patch', title:'Add a new value to the Mastercard reason code list',
      signal:'Network bulletin', evidence:'Bulletin text, plus the same value already appearing in clearing files', change:'New code value on ReasonCode',
      impact:'no queries or indexes change', status:['Merged automatically'] },
    state:{ sig:0, lane:'owner', tier:'minor', title:'Add PreArbitration as a kind of DisputeEvent',
      signal:'disputes-svc merge', evidence:'New state in the dispute state machine; 14 events in last week\u2019s data', change:'New class under an existing parent',
      impact:'3 competency questions touch DisputeEvent', status:['Waiting for the disputes owner', 'Approved by the disputes owner'] },
    dup:{ sig:0, lane:'auto', tier:'minor', title:'Add ChargebackCase as a new class',
      signal:'cb-portal merge', evidence:'New JPA entity ChargebackCase', change:'New class', failAt:2,
      failMsg:'Blocked: near duplicate of Chargeback. Converting to an alias.',
      conv:{ tier:'patch', title:'Add \u201cChargebackCase\u201d as an alias of Chargeback', change:'New alias on an existing class', evidence:'Same fields and lifecycle as Chargeback' },
      impact:'no queries change; search now finds the new name', status:['Merged automatically as an alias'] },
    split:{ sig:2, lane:'board', tier:'major', title:'Split Merchant into Merchant and SubMerchant',
      signal:'RAG query logs', evidence:'38 unanswered questions about payment facilitators\u2019 sub-merchants this month', change:'Changes what existing Merchant nodes mean',
      impact:'12 queries, 2 indexes, 3 consuming teams', status:['Sent to the change board', 'Deprecation notice sent to consumers', 'Approved for the next major release'] }
  };

  const card = document.getElementById('prcard');
  const hist = document.getElementById('hist');
  let ver = [1,5,0], prNum = 230, runId = 0;
  const scenBtns = Array.from(document.querySelectorAll('#scen button'));

  function renderCard(sc, tier, title, change, evidence){
    card.innerHTML =
      '<div class="prhead"><span class="prnum">PR #' + prNum + '</span><span class="tier" style="--c:' + TIERC[tier] + '">' + tier + '</span></div>' +
      '<h4>' + title + '</h4>' +
      '<dl class="prf"><dt>Signal</dt><dd>' + sc.signal + '</dd><dt>Evidence</dt><dd>' + evidence + '</dd><dt>Change</dt><dd>' + change + '</dd></dl>' +
      '<ol class="prchecks">' + CHECKS.map((c, i) => '<li><span class="ck" data-i="' + i + '">\u00b7</span>' + (i === 4 ? c + ': ' + sc.impact : c) + '</li>').join('') + '</ol>' +
      '<p class="prstatus" id="prstatus">Proposal drafted</p>';
    anim(card.children, { opacity:[0,1], y:[6,0] }, { duration:0.3, delay:(i) => i * 0.05 });
  }
  function setStatus(txt, bad){
    const st = document.getElementById('prstatus'); if (!st) return;
    st.textContent = txt; st.classList.toggle('bad', !!bad);
    anim(st, { opacity:[0,1], x:[-6,0] }, { duration:0.25 });
  }
  async function runChecks(my, failAt){
    const cks = Array.from(card.querySelectorAll('.ck'));
    for (let i = 0; i < cks.length; i++){
      await wait(300); if (my !== runId) return false;
      const fail = i === failAt;
      cks[i].classList.add(fail ? 'fail' : 'pass'); cks[i].textContent = fail ? '\u2715' : '\u2713';
      anim(cks[i], { scale:[0.4,1] }, { duration:0.25 });
      if (fail) return i;
    }
    return true;
  }

  async function run(key){
    const my = ++runId;
    const sc = SCEN[key];
    prNum++;
    scenBtns.forEach(b => b.setAttribute('aria-pressed', b.dataset.s === key));
    gK.replaceChildren();
    nodeEl.chk.g.classList.remove('flag');
    let tier = sc.tier, title = sc.title, change = sc.change, evidence = sc.evidence;
    renderCard(sc, tier, title, change, evidence);
    const sid = 's' + sc.sig, sx = SIGX[sc.sig];
    const pk = makePacket();
    light([sid], ['e_s' + sc.sig]); pulse(sid);
    await go(pk, E['e_s' + sc.sig], 0.5); if (my !== runId) return;
    light([sid, 'bot'], ['e_s' + sc.sig]); pulse('bot');
    await go(pk, [[sx,118],[sx,145],[370,145],[370,172]], 0.6); if (my !== runId) return;
    light(['bot', 'chk'], ['e_bc']);
    await go(pk, [[370,172],[370,216],[370,243]], 0.45); if (my !== runId) return;
    pulse('chk'); setStatus('Running checks');
    const res = await runChecks(my, sc.failAt); if (my !== runId || res === false) return;
    if (typeof res === 'number'){
      nodeEl.chk.g.classList.add('flag');
      anim(nodeEl.chk.g, { x:[0,-6,6,-4,4,0] }, { duration:0.45 });
      setStatus(sc.failMsg, true);
      await wait(1600); if (my !== runId) return;
      nodeEl.chk.g.classList.remove('flag');
      tier = sc.conv.tier; title = sc.conv.title; change = sc.conv.change; evidence = sc.conv.evidence;
      renderCard(sc, tier, title, change, evidence);
      setStatus('Rechecking the alias');
      const again = await runChecks(my, -1); if (my !== runId || again === false) return;
    }
    const ln = LANE[sc.lane];
    setStatus(tier.charAt(0).toUpperCase() + tier.slice(1) + ' change: routed to ' + LN[sc.lane].t.toLowerCase());
    light(['chk', sc.lane], [ln.edge]);
    await go(pk, E[ln.edge].concat([[ln.x, 371]]), 0.8); if (my !== runId) return;
    pulse(sc.lane);
    for (const st of sc.status){ setStatus(st); await wait(sc.lane === 'auto' ? 500 : 1000); if (my !== runId) return; }
    light([sc.lane, 'rel'], [ln.rel]);
    await go(pk, [[ln.x,371],[ln.x,408]].concat(E[ln.rel].slice(1)).concat([[ln.relX, 480]]), 0.8); if (my !== runId) return;
    pulse('rel');
    if (tier === 'patch') ver[2]++; else if (tier === 'minor'){ ver[1]++; ver[2] = 0; } else { ver[0]++; ver[1] = 0; ver[2] = 0; }
    const vs = 'v' + ver.join('.');
    await anim(verEl, { opacity:[1,0], y:[0,-8] }, { duration:0.18 });
    verEl.textContent = vs;
    anim(verEl, { opacity:[0,1], y:[8,0], scale:[1.3,1] }, { duration:0.4 });
    anim(pk, { opacity:[1,0] }, { duration:0.3 }).then(() => pk.remove());
    const chip = document.createElement('span'); chip.className = 'hv';
    chip.innerHTML = '<b>' + vs + '</b>' + tier;
    hist.appendChild(chip);
    anim(chip, { opacity:[0,1], scale:[0.7,1] }, { duration:0.35 });
    setStatus('Released as ' + vs);
    light([], []);
  }
  scenBtns.forEach(b => b.addEventListener('click', () => run(b.dataset.s)));

  onView(document.getElementById('arows'), () => {
    document.querySelectorAll('#arows .fillbar').forEach((f, i) => {
      anim(f, { width:['0%', f.dataset.p + '%'] }, { duration:0.8, delay:0.1 + i * 0.12, ease:[0.22,1,0.36,1] });
      if (!M || reduce) f.style.width = f.dataset.p + '%';
    });
  }, 0.4);
  onView(document.getElementById('tiles'), () => {
    document.querySelectorAll('#tiles .spark path').forEach((p, i) => {
      const len = p.getTotalLength(); p.style.strokeDasharray = len;
      anim(p, { strokeDashoffset:[len, 0] }, { duration:0.9, delay:0.15 + i * 0.2 }).then(() => { p.style.strokeDasharray = ''; p.style.strokeDashoffset = ''; });
    });
  }, 0.4);
})();
