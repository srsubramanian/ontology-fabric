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
