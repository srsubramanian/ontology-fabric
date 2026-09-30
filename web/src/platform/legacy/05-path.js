(function(){
  const NS = 'http://www.w3.org/2000/svg';
  const M = window.Motion;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function anim(t, k, o){
    if (typeof HTMLCollection !== 'undefined' && t instanceof HTMLCollection) t = Array.from(t);
    if (!M){ const els = t instanceof Element ? [t] : Array.from(t); els.forEach(e => { for (const p in k){ if (p === 'x' || p === 'y' || p === 'scale') continue; const v = Array.isArray(k[p]) ? k[p][k[p].length-1] : k[p]; e.style[p] = v; } }); return Promise.resolve(); }
    if (reduce) o = Object.assign({}, o, { duration:0, delay:0 });
    return Promise.resolve(M.animate(t, k, o || {}));
  }
  function tween(o){ if (!M || reduce){ o.onUpdate && o.onUpdate(1); return Promise.resolve(); } return Promise.resolve(M.animate(0, 1, o)); }
  function onView(elm, fn, amount){ if (M && M.inView) M.inView(elm, () => { fn(); }, { amount: amount || 0.35 }); else fn(); }
  function el(tag, attrs, parent){ const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; }
  function rounded(pts, r){
    let d = 'M' + pts[0][0] + ',' + pts[0][1];
    for (let i = 1; i < pts.length - 1; i++){
      const [x0,y0] = pts[i-1], [x1,y1] = pts[i], [x2,y2] = pts[i+1];
      const l1 = Math.hypot(x1-x0, y1-y0), l2 = Math.hypot(x2-x1, y2-y1); if (!l1 || !l2) continue;
      const rr = Math.min(r, l1/2, l2/2);
      d += ' L' + (x1-(x1-x0)/l1*rr) + ',' + (y1-(y1-y0)/l1*rr) + ' Q' + x1 + ',' + y1 + ' ' + (x1+(x2-x1)/l2*rr) + ',' + (y1+(y2-y1)/l2*rr);
    }
    const l = pts[pts.length-1]; return d + ' L' + l[0] + ',' + l[1];
  }

  const CH = [
    { n:1, title:'Design the ontology', short:'Ontology', c:'var(--onto)', nodes:['ontsrc','gen','pub'] },
    { n:2, title:'Fill the graph', short:'Ingest', c:'var(--graph)', nodes:['repos','events','docs','extract','stage','bedrock'] },
    { n:3, title:'Two stores, one join', short:'Stores', c:'var(--search)', nodes:['neptune','poller','opensearch'] },
    { n:4, title:'Answer a question', short:'Retrieval', c:'var(--query)', nodes:['api','opensearch','neptune','bedrock'] },
    { n:5, title:'Who uses it', short:'Users', c:'var(--query)', nodes:['agents','analysts','partners','api','pub'] },
    { n:6, title:'Keep it current', short:'Evolve', c:'var(--onto)', nodes:['extract','ontsrc','gen','pub'] },
    { n:7, title:'Build it', short:'Build', c:'var(--ink)', nodes:null }
  ];

  const QS = {
    1:[ { q:'Who writes the ontology?', o:['The extraction pipeline','People, through reviewed pull requests','Neptune, from the data it holds'], a:1, why:'Machines propose; people decide what things mean.' },
        { q:'What should version 1 start from?', o:['Importing all of FIBO','One system\u2019s database schema','Standards, measured against the teams\u2019 questions'], a:2, why:'Map to ISO 20022 and FIBO, then count how many questions the draft answers.' },
        { q:'A chargeback arrives with no capture link. What stops it?', o:['OWL, because it defines Chargeback','SHACL, because the shape requires one Capture','Git, because the change wasn\u2019t reviewed'], a:1, why:'OWL would call the capture unknown; SHACL calls it missing and rejects the record.' } ],
    2:[ { q:'What is the extraction pipeline\u2019s main job?', o:['Fill Neptune and OpenSearch with validated data','Write the ontology','Answer agents\u2019 questions'], a:0, why:'It follows the ontology; it never writes it.' },
        { q:'Code shows a dispute state the ontology lacks. What happens?', o:['It goes straight into the graph','The pipeline opens a pull request for review','It is dropped silently'], a:1, why:'Gaps become proposals that a person accepts or rejects.' } ],
    3:[ { q:'Which store is the system of record?', o:['OpenSearch','Neptune','Both equally'], a:1, why:'OpenSearch is derived and can be rebuilt from Neptune.' },
        { q:'What links an OpenSearch document to the graph?', o:['A shared embedding','The document title','neptune_id'], a:2, why:'It is the only join between the two stores.' } ],
    4:[ { q:'What does OpenSearch return during a question?', o:['IDs to start from in Neptune','The final answer','The Cypher query'], a:0, why:'Search finds entry points; the graph does the reasoning.' },
        { q:'Why does the retrieval service join the stores itself?', o:['Neptune is too slow for search','openCypher can\u2019t call OpenSearch from inside a query','OpenSearch has no IDs'], a:1, why:'So the service searches first, then passes IDs into Cypher.' } ],
    5:[ { q:'How do agents reach the knowledge layer?', o:['Direct Cypher on Neptune','Through MCP tools behind AgentCore Gateway','By reading OpenSearch indexes'], a:1, why:'The gateway checks identity and policy, and every query is validated and read-only.' },
        { q:'Which tool would engineers use first to explore the graph?', o:['Graph Explorer','Linkurious Enterprise','A spreadsheet export'], a:0, why:'It is free, supports openCypher, and runs inside your VPC.' } ],
    6:[ { q:'A new alias for an existing class. Which lane?', o:['Change board','Owner approves','Auto-merge'], a:2, why:'Additive, low-risk changes are patch releases.' },
        { q:'When does a change type move to auto-merge?', o:['From day one','When reviewers accept nearly all of its proposals','Never'], a:1, why:'Autonomy is earned per change type, and breaking changes never qualify.' } ],
    7:[ { q:'What comes first in the build order?', o:['Agents and MCP tools','Search indexes','The ontology core and its generator'], a:2, why:'Everything else is generated from it.' },
        { q:'Where is access control enforced?', o:['Inside Neptune','In layers: gateway policy, our validator and a read-only IAM role','In each agent'], a:1, why:'Neptune has no row-level security, so the checks sit in front of it, with read-only IAM as the last lock.' } ]
  };

  QS[2].push({ q:'What does tree-sitter give the pipeline?', o:['An ontology class','A syntax tree of classes, fields and annotations','A Cypher query'], a:1, why:'Structure first, exactly; Claude maps it to the ontology afterwards.' });
  QS[3].push({ q:'Why does \u201ccustomer says the order wasn\u2019t theirs\u201d find the 10.4 fraud chunk?', o:['They share keywords','Their embeddings sit close together','Neptune links them'], a:1, why:'Vector search matches meaning, not words.' });
  QS[4].push({ q:'What does min-max normalization do in hybrid search?', o:['Rescales each result list to 0 to 1 so they can be combined','Removes duplicate results','Picks keyword or vector, whichever scored higher'], a:0, why:'Different scales become comparable, then a weighted average blends them.' });
  QS[5].push({ q:'An agent sends a Cypher query that deletes nodes. What happens?', o:['Neptune deletes them','Policy at the gateway refuses it, and the IAM role could not write anyway','The agent is asked to confirm'], a:1, why:'Layers: gateway policy first, a read-only IAM role as the last lock.' });
  QS[5].push({ q:'What does A2A connect?', o:['An agent to a database','An agent to another agent','Neptune to OpenSearch'], a:1, why:'MCP connects agents to tools; A2A lets one agent hand work to another.' });
  QS[2].push({ q:'Every authorization, billions a year. Where does it live?', o:['All of it in Neptune','In the lake, linked by ID; a disputed one joins the graph','Only in OpenSearch'], a:1, why:'Materialize what questions walk through; leave the rest where it sits.' });
  QS[4].push({ q:'What do we try before building our own retrieval service?', o:['Bedrock managed GraphRAG','AWS Labs\u2019 BYOKG-RAG on our own graph','A raw Cypher tool for agents'], a:1, why:'It already combines four retrieval strategies over a graph you bring.' });
  QS[6].push({ q:'How do queries switch to a rebuilt OpenSearch index?', o:['Every client changes its index name','One atomic call moves the alias','The old index is deleted first'], a:1, why:'Queries use the alias, so they never notice the switch.' });
  QS[1].push({ q:'In LinkML, what makes a Chargeback need exactly one capture?', o:['A SHACL file written by hand','slot_usage with required: true on a single-valued slot','An OWL restriction'], a:1, why:'gen-shacl turns it into sh:minCount 1 and sh:maxCount 1 for you.' });
  const KEY = 'pkl-progress-v1';
  let state = { done: [], last: null };
  try { const raw = localStorage.getItem(KEY); if (raw) state = Object.assign(state, JSON.parse(raw)); } catch (e) {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} };
  const isDone = n => state.done.includes(n);
  const nextUp = () => { const c = CH.find(c => !isDone(c.n)); return c ? c.n : null; };

  // ---------- Path strip ----------
  const list = document.getElementById('pathlist'), resume = document.getElementById('resume');
  function renderPath(){
    const nu = nextUp();
    list.innerHTML = CH.map(c => {
      const d = isDone(c.n), cls = 'pcard' + (d ? ' done' : '') + (c.n === nu ? ' next' : '');
      const st = d ? '\u2713 Done' : (c.n === nu ? 'Up next' : 'Not started');
      return '<li><a class="' + cls + '" href="#ch' + c.n + '" style="--c:' + c.c + '"><span class="pn">' + c.n + '</span><b>' + c.title + '</b><span class="ps">' + st + '</span></a></li>';
    }).join('');
    const all = state.done.length === CH.length;
    resume.textContent = all ? 'All chapters done. Start again' : (state.done.length ? 'Continue with chapter ' + nu : 'Start chapter 1');
    document.querySelectorAll('#toc a[href^="#ch"]').forEach(a => a.classList.toggle('done', isDone(Number(a.getAttribute('href').slice(3)))));
    CH.forEach(c => {
      const nx = document.querySelector('.chnext[data-ch="' + c.n + '"] .chstat');
      if (nx) nx.textContent = isDone(c.n) ? '\u2713 Chapter ' + c.n + ' done' : '';
      const mk = document.querySelector('.chnext[data-ch="' + c.n + '"] .mark');
      if (mk) mk.hidden = isDone(c.n);
    });
  }
  resume.addEventListener('click', () => {
    if (state.done.length === CH.length){ state.done = []; save(); renderPath(); resetChecks(); }
    const n = nextUp() || 1;
    location.hash = '#ch' + n;
  });
  function markDone(n){
    if (isDone(n)) return;
    state.done.push(n); save(); renderPath();
    const card = list.querySelector('a[href="#ch' + n + '"]');
    if (card) anim(card, { scale:[1, 1.06, 1] }, { duration:0.45 });
  }

  // ---------- Mini-maps ----------
  const PM = window.__platformMap;
  function miniMap(svg, nodes, color){
    if (!PM) return;
    const on = new Set(nodes || PM.NODES.map(n => n.id));
    PM.EDGES.forEach(e => {
      const hot = on.has(e.f) && on.has(e.t);
      const p = el('path', { d: rounded(e.p, 14), fill:'none' }, svg);
      p.style.stroke = hot ? color : 'var(--line)'; p.style.strokeWidth = hot ? 7 : 3.5; p.style.opacity = hot ? 1 : 0.8;
    });
    PM.NODES.forEach(n => {
      const hot = on.has(n.id);
      const r = el('rect', { x:n.x, y:n.y, width:PM.W, height:n.h, rx:12 }, svg);
      r.style.fill = hot ? color : 'var(--faint)'; r.style.stroke = hot ? color : 'var(--line)'; r.style.strokeWidth = 3; r.style.opacity = hot ? 0.9 : 1;
    });
  }
  CH.forEach(c => {
    const svg = document.querySelector('.mini[data-ch="' + c.n + '"]');
    if (svg) miniMap(svg, c.nodes, c.c);
  });

  // ---------- Watch on the map ----------
  document.querySelectorAll('.watch').forEach(b => b.addEventListener('click', () => {
    location.hash = '#map';
    setTimeout(() => { document.getElementById('map').scrollIntoView({ block:'start' }); if (window.__playFlow) window.__playFlow(b.dataset.flow); }, reduce ? 50 : 350);
  }));

  // ---------- Quick checks ----------
  const checkState = {};
  function renderCheck(box){
    const n = Number(box.dataset.ch), qs = QS[n];
    checkState[n] = qs.map(() => false);
    box.innerHTML = '<h3>Check yourself</h3><div class="qgrid2">' + qs.map((q, i) =>
      '<div class="qc" data-i="' + i + '"><p class="q">' + q.q + '</p><div class="qopts">' +
      q.o.map((o, j) => '<button type="button" class="qopt" data-j="' + j + '">' + o + '</button>').join('') +
      '</div><p class="qfb" aria-live="polite"></p></div>').join('') + '</div>';
    box.querySelectorAll('.qc').forEach(qc => {
      const i = Number(qc.dataset.i), q = qs[i], fb = qc.querySelector('.qfb');
      qc.querySelectorAll('.qopt').forEach(btn => btn.addEventListener('click', () => {
        const j = Number(btn.dataset.j);
        qc.querySelectorAll('.qopt').forEach(b => b.classList.remove('right', 'wrong'));
        if (j === q.a){
          btn.classList.add('right'); fb.className = 'qfb ok'; fb.textContent = 'Right. ' + q.why;
          anim(btn, { scale:[0.97, 1] }, { duration:0.25 });
          checkState[n][i] = true;
          if (checkState[n].every(Boolean)) markDone(n);
        } else {
          btn.classList.add('wrong'); fb.className = 'qfb no'; fb.textContent = 'Not quite. Try another answer.';
          anim(btn, { x:[0,-5,5,-3,3,0] }, { duration:0.35 });
        }
      }));
    });
  }
  function resetChecks(){ document.querySelectorAll('.check[data-ch]').forEach(renderCheck); }
  resetChecks();

  // ---------- Next / mark done ----------
  document.querySelectorAll('.chnext[data-ch]').forEach(row => {
    const n = Number(row.dataset.ch), nx = CH.find(c => c.n === n + 1);
    row.innerHTML = '<span class="chstat"></span><span class="chbtns"><button type="button" class="vbtn mark">Mark as done</button>' +
      (nx ? '<a class="vbtn go nextch" href="#ch' + nx.n + '">Next: ' + nx.title + '</a>' : '<a class="vbtn go nextch" href="#path">Back to your path</a>') + '</span>';
    row.querySelector('.mark').addEventListener('click', () => markDone(n));
  });

  // ---------- Remember where you are ----------
  if ('IntersectionObserver' in window){
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting){ state.last = Number(e.target.dataset.ch); save(); } }), { rootMargin:'-40% 0px -55% 0px' });
    document.querySelectorAll('.chapter[data-ch]').forEach(s => io.observe(s));
  }
  renderPath();

})();
