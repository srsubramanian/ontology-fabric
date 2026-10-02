// A stand-in for claude.ai's runtime, so tools/test_studio.py can walk the studio's whole flow headlessly. Its
// shapes follow runtime contract 0.2.45's type definitions, and its connector answers follow real list_environments
// and get_session answers. create_session's answer shape is undocumented: the studio looks for any session id in it.
(() => {
  const docs = new Map();           // path -> data
  const listeners = new Set();      // () => void
  const notify = () => setTimeout(() => listeners.forEach((f) => f()), 0);
  const snap = (path) => ({ id: path.split('/').pop(), exists: docs.has(path), data: () => docs.has(path) ? structuredClone(docs.get(path)) : undefined, metadata: {} });
  const merge = (a, b) => { const o = { ...a }; for (const [k, v] of Object.entries(b)) o[k] = v && typeof v === 'object' && !Array.isArray(v) && o[k] && typeof o[k] === 'object' ? merge(o[k], v) : v; return o; };
  const leases = new Map();
  const doc = (path) => ({
    id: path.split('/').pop(), path,
    get: async () => snap(path),
    set: async (d) => { docs.set(path, structuredClone(d)); notify(); },
    update: async (d) => { if (!docs.has(path)) throw { code: 'invalid_argument', message: 'no doc' }; docs.set(path, merge(docs.get(path), structuredClone(d))); notify(); },
    acquire: async ({ holder }) => { const h = leases.get(path); if (h && h !== holder) return { acquired: false }; leases.set(path, holder); return { acquired: true }; },
    onSnapshot: (next) => { const f = () => next(snap(path)); listeners.add(f); f(); return () => listeners.delete(f); },
  });
  const query = (coll, order) => ({
    orderBy: (field, dir) => query(coll, { field, dir }),
    limit: () => query(coll, order),
    onSnapshot: (next) => {
      const f = () => {
        let ds = [...docs.keys()].filter((p) => p.startsWith(coll + '/') && p.split('/').length === coll.split('/').length + 1).map(snap);
        if (order) ds.sort((a, b) => (a.data()[order.field] - b.data()[order.field]) * (order.dir === 'desc' ? -1 : 1));
        next({ docs: ds, size: ds.length, empty: !ds.length });
      };
      listeners.add(f); f(); return () => listeners.delete(f);
    },
  });
  const db = { doc, collection: (c) => ({ ...query(c), doc: (id) => doc(c + '/' + (id ?? Math.random().toString(36).slice(2))) }) };
  const me = { id: 'u_me', name: 'Ada Engineer', avatarUrl: '', color: '#888', email: null, isOwner: true, canEdit: true };
  const user = {
    me: async () => me, id: async () => me.id,
    profiles: async (ids) => Object.fromEntries([].concat(ids).map((id) => [id, { id, name: { u_me: 'Ada Engineer', u_ana: 'Ana Analyst' }[id] || '', avatarUrl: '', color: '#888', email: null, isMe: id === 'u_me' }])),
  };
  // Claude answers with what the test asked it to: a design for a question someone asked, or a test case that proves
  // one, using the page's tools first the way Claude would, or a query for a competency question.
  const answers = window.__studioClaude || {};
  const sample = async (input, opts = {}) => {
    window.__sampleCalls = (window.__sampleCalls || []).concat([input]);
    const asked = /design partner/.test(input), testing = /You write a test case/.test(input);
    if ((asked || testing) && opts.tools) {
      for (const call of (testing ? answers.testCalls : answers.inquiryCalls) || []) {
        await new Promise((r) => setTimeout(r, 150));
        const tool = opts.tools.find((t) => t.name === call.name);
        let out;
        try { out = await tool.execute(call.input, { signal: opts.signal || new AbortController().signal }); } catch (e) { out = 'Error: ' + e.message; }
        window.__toolResults = (window.__toolResults || []).concat([{ name: call.name, out }]);
      }
    }
    const reply = JSON.stringify(asked ? answers.inquiry : testing ? answers.test : /Write the query/.test(input) ? answers.query : answers.build);
    let text = '';
    for (const part of reply.match(/[\s\S]{1,200}/g)) {
      await new Promise((r) => setTimeout(r, 30));
      if (opts.signal?.aborted) throw { code: 'cancelled', message: 'stopped', text };
      text += part; opts.onText?.({ text, delta: part });
    }
    return { text, truncated: false, modelTierApplied: 'default' };
  };
  sample.json = async (input, opts) => JSON.parse((await sample(input, opts)).text);
  sample.limits = async () => ({ maxPromptBytes: 262144, tools: {} });
  const mcp = {
    callTool: async (server, tool, input) => {
      window.__mcpCalls = (window.__mcpCalls || []).concat([{ server, tool, input }]);
      if (server !== 'Claude Code Remote') throw { code: 'not_in_manifest', message: 'no' };
      if (tool === 'list_environments') return { content: [], payload: { environments: [{ environment_id: 'env_test1', name: 'Default', state: 'active', kind: 'anthropic_cloud' }], has_more: false } };
      if (tool === 'create_session') return { content: [], payload: window.__createShape === 'text' ? 'Created session session_01TESTabcdef123' : { ccr: { id: 'session_01TESTabcdef123', title: input.title } } };
      if (tool === 'get_session') return { content: [], payload: { ccr: { id: input.session_id, title: 'Studio: test', status_bucket: 'SESSION_STATUS_BUCKET_WORKING' } } };
      throw { code: 'tool_error', message: 'unknown tool' };
    },
  };
  // Who's here: this tab, plus anyone the test brings in with window.__stubRoom.set(peer, by, presence).
  const peers = new Map();
  const self = { peer: 'p_me', by: me.id, isMe: true, sameTab: true, kind: 'viewer', guest: false, presence: {}, updatedAt: Date.now() };
  peers.set(self.peer, self);
  const roomListeners = new Set();
  const tellPeers = () => setTimeout(() => {
    const list = Object.freeze([...peers.values()].map((p) => Object.freeze({ ...p, presence: Object.freeze({ ...p.presence }) })));
    roomListeners.forEach((f) => f({ peers: list, joined: [], left: [], updated: [] }));
  }, 0);
  const room = {
    presence: async (patch) => {
      const next = { ...self.presence };
      for (const [k, v] of Object.entries(patch)) { if (v === null) delete next[k]; else next[k] = v; }
      self.presence = next; window.__myPresence = next; tellPeers();
    },
    peers: () => [...peers.values()],
    onPeers: (h) => { roomListeners.add(h); tellPeers(); return () => roomListeners.delete(h); },
    connected: () => true,
  };
  window.__stubRoom = {
    set: (peer, by, presence) => { peers.set(peer, { peer, by, isMe: false, sameTab: false, kind: 'viewer', guest: false, presence, updatedAt: Date.now() }); tellPeers(); },
    leave: (peer) => { peers.delete(peer); tellPeers(); },
  };
  const caps = { db, user, sample, mcp, room };
  window.__stubDb = db;
  window.claude = { use: async (name) => caps[name] ?? null };
})();
