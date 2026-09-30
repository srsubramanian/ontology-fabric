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
