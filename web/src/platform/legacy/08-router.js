(function(){
  const M = window.Motion;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function anim(t, k, o){
    if (!M || reduce) return Promise.resolve();
    return Promise.resolve(M.animate(t, k, o || {}));
  }
  const hero = document.querySelector('main > header');
  const home = document.getElementById('home');
  const chapters = Array.from(document.querySelectorAll('section.chapter'));
  if (!home || !chapters.length) return;
  const views = [home].concat(chapters);
  const TAB = { authh:'Turtle or LinkML', whereh:'What lives where', reuseh:'Build or reuse', watchh:'Watch list', dd1h:'Building blocks', v1h:'Version 1', dd2h:'Code to graph', evh:'Two jobs', dd3h:'Two stores', own:'Who owns what', ixh:'Indexes',
                dd4h:'Hybrid search', walkh:'One question', dd5h:'Tool calls', usersh:'Four ways in', dd6h:'Versions', loop:'The loop', phh:'Build order', dech:'Decisions' };

  // ---------- Build sub-pages, tabs and a pager for every chapter ----------
  const SUB = new Map();
  chapters.forEach(ch => {
    const blocks = Array.from(ch.children).filter(e => e.matches('section.block'));
    const check = ch.querySelector(':scope > .check'), next = ch.querySelector(':scope > .chnext');
    const pages = blocks.map(b => { const h = b.querySelector('.sech'); return { els:[b], label: (h && TAB[h.id]) || (h ? h.textContent : 'Section') }; });
    pages.push({ els:[check, next].filter(Boolean), label:'Check yourself' });
    const bar = document.createElement('nav');
    bar.className = 'subtabs'; bar.setAttribute('aria-label', 'Pages in this chapter');
    pages.forEach((p, i) => {
      const a = document.createElement('a');
      a.className = 'subtab'; a.href = '#' + ch.id + ':' + (i + 1);
      a.innerHTML = '<span class="num">' + (i + 1) + '</span>' + p.label;
      bar.appendChild(a); p.tab = a;
    });
    ch.querySelector('.chhead').after(bar);
    const pager = document.createElement('div'); pager.className = 'pager'; ch.appendChild(pager);
    SUB.set(ch, { pages, pager, cur: -1 });
  });

  function showSub(ch, i, dir){
    const S = SUB.get(ch);
    i = Math.max(0, Math.min(S.pages.length - 1, i));
    S.pages.forEach((p, k) => {
      p.els.forEach(e => { e.hidden = k !== i; });
      p.tab.classList.toggle('on', k === i);
      if (k === i) p.tab.setAttribute('aria-current', 'page'); else p.tab.removeAttribute('aria-current');
    });
    S.cur = i;
    const prev = S.pages[i - 1], nxt = S.pages[i + 1];
    S.pager.innerHTML = (prev ? '<a class="vbtn" href="#' + ch.id + ':' + i + '">Previous: ' + prev.label + '</a>' : '<span></span>') +
                        (nxt ? '<a class="vbtn go" href="#' + ch.id + ':' + (i + 2) + '">Next: ' + nxt.label + '</a>' : '');
    S.pager.hidden = !prev && !nxt;
    const shown = S.pages[i].els.concat([S.pager]);
    if (dir) anim(shown, { opacity:[0, 1], x:[dir * 32, 0] }, { duration:0.34, ease:[0.22, 1, 0.36, 1] });
    const tab = S.pages[i].tab, bar = tab.parentElement;
    if (bar.scrollWidth > bar.clientWidth) bar.scrollTo({ left: tab.offsetLeft - bar.clientWidth / 2 + tab.clientWidth / 2, behavior: reduce ? 'auto' : 'smooth' });
  }

  let cur = null;
  function showView(v){
    if (cur === v) return false;
    views.forEach(x => { x.hidden = x !== v; });
    if (hero) hero.hidden = v !== home;
    document.body.classList.toggle('in-chapter', v !== home);
    cur = v;
    const key = v === home ? '#map' : '#' + v.id;
    document.querySelectorAll('#toc a').forEach(a => a.classList.toggle('here', a.getAttribute('href') === key));
    return true;
  }

  function route(first){
    const h = decodeURIComponent(location.hash.replace(/^#/, ''));
    let view = home, idx = null, target = null;
    const m = h.match(/^(ch\d+)(?::(\d+))?$/);
    if (m){ view = document.getElementById(m[1]) || home; idx = m[2] ? Number(m[2]) - 1 : null; }
    else if (h){ target = document.getElementById(h); if (target) view = target.closest('section.chapter') || home; }
    const prevView = cur, changed = showView(view);
    if (view !== home){
      const S = SUB.get(view);
      if (idx === null && target) idx = Math.max(0, S.pages.findIndex(p => p.els.some(e => e.contains(target))));
      if (idx === null) idx = changed ? 0 : S.cur;
      const dir = changed ? 0 : (idx > S.cur ? 1 : idx < S.cur ? -1 : 0);
      showSub(view, idx, dir);
    }
    if (changed && !first){
      const order = views.indexOf(view) - views.indexOf(prevView);
      anim(view, { opacity:[0, 1], y:[order >= 0 ? 18 : -18, 0] }, { duration:0.38, ease:[0.22, 1, 0.36, 1] });
    }
    if (view === home && target && target.id !== 'map') target.scrollIntoView({ block:'start' });
    else window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', () => route(false));
  route(true);

  // ---------- Arrow keys page through a chapter ----------
  document.addEventListener('keydown', e => {
    if (cur === home || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    const tag = (document.activeElement && document.activeElement.tagName) || '';
    if (/INPUT|TEXTAREA|SELECT/.test(tag)) return;
    const S = SUB.get(cur); if (!S) return;
    if (e.key === 'ArrowRight' && S.cur < S.pages.length - 1){ location.hash = '#' + cur.id + ':' + (S.cur + 2); e.preventDefault(); }
    if (e.key === 'ArrowLeft' && S.cur > 0){ location.hash = '#' + cur.id + ':' + S.cur; e.preventDefault(); }
  });
})();
