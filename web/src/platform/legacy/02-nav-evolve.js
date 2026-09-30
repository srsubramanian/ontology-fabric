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
