(function(){
  const M = window.Motion;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function anim(t, k, o){
    if (typeof HTMLCollection !== 'undefined' && t instanceof HTMLCollection) t = Array.from(t);
    if (!M){ const els = t instanceof Element ? [t] : Array.from(t); els.forEach(e => { for (const p in k){ if (['x','y','scale','scaleX'].includes(p)) continue; const v = Array.isArray(k[p]) ? k[p][k[p].length-1] : k[p]; e.style[p] = v; } }); return Promise.resolve(); }
    if (reduce) o = Object.assign({}, o, { duration:0, delay:0 });
    return Promise.resolve(M.animate(t, k, o || {}));
  }
  const wait = ms => new Promise(r => setTimeout(r, reduce ? 0 : ms));
  const dl = (b, s) => (i) => b + i * s;
  function onView(elm, fn, amount){ if (!elm) return; if (M && M.inView) M.inView(elm, () => { fn(); }, { amount: amount || 0.35 }); else fn(); }
  function drawIn(paths, d0){
    Array.from(paths).forEach((p, i) => {
      const len = p.getTotalLength(); p.style.strokeDasharray = len; p.style.strokeDashoffset = len;
      anim(p, { strokeDashoffset:[len, 0] }, { duration:0.55, delay:(d0 || 0) + i * 0.12 }).then(() => { p.style.strokeDasharray = ''; p.style.strokeDashoffset = ''; });
    });
  }

  // ---------- Chapter 2: what lives where ----------
  const pool = document.getElementById('wlPool');
  if (pool){
    const chips = Array.from(pool.children);
    const drops = {}; document.querySelectorAll('.wldrop').forEach(d => drops[d.dataset.bin] = d);
    const note = document.getElementById('wlNote');
    let sorted = false, run = 0;
    function flip(elm, dest){
      const a = elm.getBoundingClientRect(); dest.appendChild(elm); const b = elm.getBoundingClientRect();
      return anim(elm, { x:[a.left - b.left, 0], y:[a.top - b.top, 0] }, { duration:0.55, ease:[0.22,1,0.36,1] });
    }
    function reset(){ run++; sorted = false; pool.classList.remove('empty'); chips.forEach(c => { pool.appendChild(c); c.style.transform = ''; }); if (M && !reduce) note.style.opacity = 0; }
    async function sort(){
      if (sorted) return; sorted = true; const my = ++run;
      for (const c of chips){ if (my !== run) return; flip(c, drops[c.dataset.to]); await wait(230); }
      await wait(400); if (my !== run) return;
      pool.classList.add('empty');
      anim(note, { opacity:[0,1], y:[8,0] }, { duration:0.4 });
    }
    if (M && !reduce) note.style.opacity = 0;
    document.getElementById('wlSort').addEventListener('click', () => { reset(); requestAnimationFrame(sort); });
    document.getElementById('wlReset').addEventListener('click', reset);
    onView(document.getElementById('where'), () => { if (!sorted) setTimeout(sort, 400); }, 0.3);
  }

  // ---------- Chapter 4: build or reuse ----------
  const rmap = document.getElementById('rmap');
  if (rmap){
    let seen = false;
    onView(rmap, () => {
      if (seen) return; seen = true;
      const boxes = rmap.querySelectorAll('.rb'); Array.from(boxes).forEach(b => b.style.opacity = 0);
      anim(boxes, { opacity:[0,1], y:[8,0] }, { duration:0.35, delay: dl(0, 0.07) });
      drawIn(rmap.querySelectorAll('.rline'), 0.7);
      const chips = document.querySelectorAll('#reuse .rchips span');
      anim(chips, { opacity:[0,1], scale:[0.85,1] }, { duration:0.3, delay: dl(1.3, 0.05) });
    }, 0.3);
  }

  // ---------- Chapter 3: storage tiers ----------
  const tiers = document.getElementById('tiers');
  if (tiers){
    onView(tiers, () => {
      tiers.querySelectorAll('.mtrack i').forEach((b, i) => {
        if (!M || reduce){ b.style.width = b.dataset.w + '%'; return; }
        anim(b, { width:['0%', b.dataset.w + '%'] }, { duration:0.8, delay:0.1 + i * 0.12, ease:[0.22,1,0.36,1] });
      });
    }, 0.4);
  }

  // ---------- Chapter 7: watch list ----------
  const wtl = document.getElementById('wtl');
  if (wtl){
    let seen = false;
    onView(wtl, () => {
      if (seen) return; seen = true;
      drawIn(wtl.querySelectorAll('.gmain'), 0);
      const ev = wtl.querySelectorAll('.wev'); Array.from(ev).forEach(e => e.style.opacity = 0);
      anim(ev, { opacity:[0,1], y:[6,0] }, { duration:0.35, delay: dl(0.4, 0.18) });
      const cards = document.querySelectorAll('#watch .wcard');
      anim(cards, { opacity:[0,1], y:[10,0] }, { duration:0.35, delay: dl(1.5, 0.1) });
    }, 0.3);
  }
})();
