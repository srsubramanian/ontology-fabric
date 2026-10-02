// A small sample world built from the ontology, to prove a design with data (decision 25, stage 4). Every concrete
// class gets instances, every field a plausible value, every relationship links real instances, all from a seed, so
// the same question always sees the same world. A test case plants its own instances on top: the ones the question
// should find, and the ones it shouldn't. Everything here is illustrative, and the page says so.
import type { Model, RawSchema } from '../explorer/model.ts';

export type Node = { id: string; cls: string; labels: string[]; props: Record<string, unknown> };
export type Edge = { from: Node; to: Node; type: string; slot: string; props: Record<string, unknown> };
export type World = {
  nodes: Node[]; edges: Edge[]; now: string;
  byLabel: Map<string, Node[]>; out: Map<Node, Edge[]>; inn: Map<Node, Edge[]>; byId: Map<string, Node>;
  /** A test case's references, to the ids its instances got, and which instances it planted. */
  refs: Map<string, string>; planted: Set<string>;
  /** Instances on a seeded copy of the question's own path. */
  seeded: Set<string>;
};

/**
 * The path a question walks, read from its query, so the sample world can hold a few instances that follow it end
 * to end: variables with their class and the values the query asks for, the links between them, links the query
 * says mustn't exist, times that must come in order, and codes a link must reach.
 */
export type Shape = {
  vars: Record<string, { cls?: string; props: Record<string, unknown> }>;
  links: { from: string; to: string; type?: string; slot?: string }[];
  unlink: { v: string; type: string; dir: 'out' | 'in' }[];
  before: { a: [string, string]; b: [string, string] }[];
  codes: { v: string; slot: string; code: string }[];
};
export const emptyShape = (): Shape => ({ vars: {}, links: [], unlink: [], before: [], codes: [] });

/** What a test case plants: instances by a reference of its own, the links between them, and what to expect. */
export type Scenario = {
  story?: string;
  nodes?: { ref: string; class: string; props?: Record<string, unknown> }[];
  links?: { from: string; rel: string; to: string; props?: Record<string, unknown> }[];
  /** Values for the query's parameters; "@ref" means the id of a planted instance. */
  params?: Record<string, unknown>;
  /** Rows the answer should and shouldn't hold: column to value, with "@ref" for a planted instance's id. */
  expect?: { include?: Record<string, unknown>[]; exclude?: Record<string, unknown>[] };
};

/** A small, fast, seeded random number generator (mulberry32), so a world is the same every time. */
export function rng(seed: string) {
  let a = [...seed].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 2654435761) >>> 0, 1779033703);
  const next = () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  return { next, int: (lo: number, hi: number) => lo + Math.floor(next() * (hi - lo + 1)), pick: <T,>(xs: T[]) => xs[Math.floor(next() * xs.length)] };
}

const DAY = 86_400_000;
export const iso = (t: number) => new Date(t).toISOString().replace(/\.\d{3}Z$/, 'Z');
const snake = (s: string) => s.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();

/** How many of each class: a handful of parties and codes, more of the events. Classes the question adds get a few. */
const COUNT: Record<string, number> = {
  Merchant: 12, Acquirer: 3, Issuer: 4, Cardholder: 20, Organization: 8, Person: 10, Card: 24, BinRange: 6, Device: 14,
  Authorization: 160, Authentication: 60, Capture: 120, Settlement: 18, Payout: 10, Refund: 12, Reversal: 8, Adjustment: 5,
  FraudReport: 14, Chargeback: 26, Representment: 13, PreArbitration: 5, Arbitration: 3, DisputeOutcome: 10, RetrievalRequest: 6,
  MonitoringNotice: 4, ClearingBatch: 6, Reconciliation: 4, FeeCollection: 4, FeeProgram: 5, ResponseCode: 5, Document: 10, Chunk: 30,
};
/** Values a payments person would recognize, by field name. Merchant names follow the page's running examples. */
const VALUES: Record<string, string[]> = {
  mcc: ['5812', '7922', '5411', '4511', '5999'], country: ['US', 'GB', 'DE', 'FR', 'CA'], currency: ['USD', 'USD', 'EUR', 'GBP'],
  token_requestor: ['40010030273', '40010075001'],
};
const NAMES: Record<string, string[]> = {
  Merchant: ['Harbor Grill', 'Sunset Tickets', 'Corner Books', 'Blue Fern Spa', 'Metro Parking', 'Pine Hardware', 'Quick Fuel', 'Lumen Electronics', 'Tidal Surf Co', 'Orchard Market', 'Atlas Travel', 'Nova Fitness'],
  Organization: ['Northbank', 'Harbor Holdings', 'Sunset Events Ltd', 'Pinecrest Group', 'Meridian Bank', 'Orbit Payments', 'Lakeside Retail', 'Summit Partners'],
};
const RESPONSE = ['00', '05', '10', '51', '54', '91'];
/** How long ago each seeded copy of a question's path happened, and the gap between its steps, so every window a
 *  question asks about (today, yesterday, last week, this month, last month, last quarter) holds one. */
const SEEDS: [number, number][] = [[0.125, 0.02], [1, 0.25], [4, 1], [12, 2], [35, 3], [70, 5]];

export type WorldOptions = { seed?: string; now?: number; scenario?: Scenario; shape?: Shape };

export function buildWorld(model: Model, schema: RawSchema, opts: WorldOptions = {}): World {
  const { seed = 'ontology-fabric', now: nowMs = Date.parse('2026-08-31T12:00:00Z'), scenario, shape } = opts;
  const r = rng(seed);
  const now = Math.floor(nowMs / DAY) * DAY + 12 * 3_600_000;
  const nodes: Node[] = [], edges: Edge[] = [];
  const enumValues = (range: string) => Object.keys(schema.enums?.[range]?.permissible_values ?? {});
  const fieldValue = (cls: string, name: string, range: string, i: number): unknown => {
    if (VALUES[name]) return r.pick(VALUES[name]);
    if (cls === 'ResponseCode' && name === 'code') return RESPONSE[i % RESPONSE.length];
    if (name === 'name' && NAMES[cls]) return NAMES[cls][i % NAMES[cls].length];
    if (name === 'month') return iso(now - (i % 3) * 30 * DAY).slice(0, 7);
    if (name === 'prefix') return String(400000 + i * 1111);
    if (enumValues(range).length) return r.pick(enumValues(range));
    switch (range) {
      case 'datetime': return iso(name.endsWith('_by') ? now + r.int(0, 30) * DAY : now - r.int(0, 120) * DAY - r.int(0, 86_000) * 1000);
      case 'date': return iso(now - r.int(0, 120) * DAY).slice(0, 10);
      case 'decimal': return name.includes('rate') || name.includes('ratio') || name.includes('score') ? Math.round(r.next() * 1000) / 1000 : Math.round(r.int(500, 50_000)) / 100;
      case 'integer': return r.int(1, 100);
      case 'boolean': return r.next() < 0.5;
      case 'uri': return `https://example.com/${snake(cls)}/${i}`;
      default: return name === 'code' ? String(10 + i) : `${cls} ${i + 1}`;
    }
  };
  const idFor = (cls: string, rule: string | undefined, props: Record<string, unknown>, n: number) =>
    (rule ?? `${snake(cls)}:{id}`).replace(/\{([a-z_]+)\}/g, (_, k: string) => (props[k] != null && k !== 'id' ? String(props[k]) : String(n)));
  const make = (cls: string, i: number, n: number, over: Record<string, unknown> = {}): Node => {
    const c = model.classes[cls];
    const props: Record<string, unknown> = {};
    for (const s of c.slots) if (!s.relationship && !s.identifier && s.name !== 'id') props[s.name] = fieldValue(cls, s.name, s.range, i);
    Object.assign(props, over);
    // The running examples' merchants keep their ids, so sample rows read like the rest of the page.
    const fixed = cls === 'Merchant' && i < 2 && !Object.keys(over).length ? ['m:88213', 'm:10442'][i] : null;
    const id = String(over.id ?? fixed ?? idFor(cls, c.idRule, props, n));
    const node: Node = { id, cls, labels: c.chain, props: { ...props, id } };
    nodes.push(node);
    return node;
  };

  // Instances: code lists give the codes; everything else gets a count by kind.
  for (const c of Object.values(model.classes)) {
    if (c.abstract) continue;
    if (c.codeList?.values.length) {
      c.codeList.values.forEach((v, i) => make(c.name, i, 1001 + i, { code: v.code, ...(c.slots.some((s) => s.name === 'network') ? { network: 'visa' } : {}) }));
      continue;
    }
    const n = COUNT[c.name] ?? (c.chain.includes('PaymentEvent') ? 30 : 10);
    for (let i = 0; i < n; i++) make(c.name, i, 1001 + i);
  }
  const index = () => {
    const byLabel = new Map<string, Node[]>(), byId = new Map<string, Node>();
    for (const n of nodes) { byId.set(n.id, n); for (const l of n.labels) byLabel.set(l, [...(byLabel.get(l) ?? []), n]); }
    return { byLabel, byId };
  };
  let { byLabel, byId } = index();

  // Links: each instance of a relationship's class links to one of the target class's instances, or a few when
  // it's multivalued. A link open to any class (a chunk's mentions) picks any instance.
  const edgeProps = (slot: string) => String((schema.slots?.[slot] as { annotations?: Record<string, unknown> } | undefined)?.annotations?.edge_properties ?? '').split(',').map((x) => x.trim()).filter(Boolean)
    .map((x) => x.split(':').map((y) => y.trim()) as [string, string]);
  const link = (from: Node, to: Node, rel: { slot: string; type: string }, over: Record<string, unknown> = {}) => {
    const props: Record<string, unknown> = {};
    for (const [k, t] of edgeProps(rel.slot)) props[k] = /date/i.test(t) ? iso(k.startsWith('first') ? now - r.int(20, 120) * DAY : now - r.int(0, 19) * DAY) : r.int(1, 40);
    const e: Edge = { from, to, type: rel.type, slot: rel.slot, props: { ...props, ...over } };
    edges.push(e);
    return e;
  };
  const planted = new Set<string>(), refs = new Map<string, string>();
  for (const rel of model.relationships) {
    const sources = byLabel.get(rel.from) ?? [];
    const targets = rel.open ? nodes : (byLabel.get(rel.to) ?? []);
    if (!targets.length) continue;
    for (const s of sources) {
      const k = rel.multivalued ? r.int(1, 3) : 1;
      const seen = new Set<Node>();
      for (let j = 0; j < k; j++) {
        const t = r.pick(targets);
        if (t === s && rel.from === rel.to) continue;
        if (!seen.has(t)) { seen.add(t); link(s, t, rel); }
      }
    }
  }

  // A few copies of the question's own path, each at a different time, so the question has something to find.
  const seeded = new Set<string>();
  if (shape) seedShape(shape);
  function seedShape(sh: Shape) {
    const vars = Object.entries(sh.vars);
    const relFor = (a: Node | string, b: Node | string | undefined, l: Shape['links'][number]) => model.relationships.find((x) =>
      (typeof a === 'string' ? model.classes[a]?.chain.includes(x.from) : a.labels.includes(x.from)) && (l.type ? x.type === l.type : x.slot === l.slot)
      && (!b || x.open || (typeof b === 'string' ? model.classes[b]?.chain.includes(x.to) || model.classes[x.to]?.chain.includes(b) : b.labels.includes(x.to))));
    // A variable without a class takes it from a link: the far end of a relationship it's on.
    const cls = new Map(vars.filter(([, v]) => v.cls && model.classes[v.cls]).map(([k, v]) => [k, v.cls!]));
    for (let pass = 0; pass < 4; pass++) for (const l of sh.links) {
      const a = cls.get(l.from), b = cls.get(l.to);
      if (a && !b) { const x = relFor(a, undefined, l); if (x && !x.open) cls.set(l.to, x.to); }
      if (b && !a) { const x = model.relationships.find((y) => (l.type ? y.type === l.type : y.slot === l.slot) && (y.open || model.classes[b].chain.includes(y.to))); if (x) cls.set(l.from, x.from); }
    }
    // How late each variable's event is: the longest run of links from it, since a later event points at an earlier one.
    const depth = new Map<string, number>();
    const deep = (v: string, seen: Set<string>): number => {
      if (depth.has(v)) return depth.get(v)!;
      if (seen.has(v)) return 0;
      seen.add(v);
      const d = Math.max(0, ...sh.links.filter((l) => l.from === v && l.to !== v).map((l) => 1 + deep(l.to, seen)));
      depth.set(v, d);
      return d;
    };
    for (const [v] of vars) deep(v, new Set());
    const D = Math.max(0, ...depth.values());
    const taken = new Set<Node>();
    for (const [ago, gap] of SEEDS) {
      const T = now - ago * DAY;
      const bound = new Map<string, Node>();
      for (const [v] of vars) {
        const c = cls.get(v);
        const pool = (c ? byLabel.get(c) : nodes)?.filter((n) => !model.classes[n.cls].abstract) ?? [];
        if (!pool.length) continue;
        const free = pool.filter((n) => !taken.has(n));
        // Once every instance is on a copy, a class gets a new one, so copies never overwrite each other; codes are shared.
        const fresh = !free.length && c && !model.classes[c].abstract && !model.classes[c].codeList?.values.length;
        const n = fresh ? make(c, nodes.length, 5001 + nodes.length) : r.pick(free.length ? free : pool);
        taken.add(n); bound.set(v, n); seeded.add(n.id);
        const t = T - (D - (depth.get(v) ?? 0)) * gap * DAY;
        for (const s of model.classes[n.cls].slots) {
          if (s.range !== 'datetime' && s.range !== 'date') continue;
          const at = s.name.endsWith('_by') ? t + 10 * DAY : t - r.int(0, 40) * 60_000;
          n.props[s.name] = s.range === 'date' ? iso(at).slice(0, 10) : iso(at);
        }
        for (const [k, x] of Object.entries(sh.vars[v].props)) if (k !== 'id') n.props[k] = x;
      }
      const single = (from: Node, slot: string) => { for (let i = edges.length - 1; i >= 0; i--) if (edges[i].from === from && edges[i].slot === slot) edges.splice(i, 1); };
      for (const l of sh.links) {
        const a = bound.get(l.from), b = bound.get(l.to);
        if (!a || !b) continue;
        const x = relFor(a, b, l);
        if (!x) continue;
        if (!x.multivalued) single(a, x.slot);
        else if (edges.some((e) => e.from === a && e.to === b && e.slot === x.slot)) continue;
        const e = link(a, b, x);
        for (const [k, t] of edgeProps(x.slot)) if (/date/i.test(t)) e.props[k] = iso(k.startsWith('first') ? T - 3 * gap * DAY : T);
      }
      for (const c of sh.codes) {
        const a = bound.get(c.v); if (!a) continue;
        const x = model.relationships.find((y) => a.labels.includes(y.from) && y.slot === c.slot);
        const code = x && (byLabel.get(x.to) ?? []).find((n) => String(n.props.code) === c.code);
        if (!x || !code) continue;
        single(a, x.slot); link(a, code, x);
      }
      for (const u of sh.unlink) {
        const a = bound.get(u.v); if (!a) continue;
        for (let i = edges.length - 1; i >= 0; i--) if (edges[i].type === u.type && (u.dir === 'out' ? edges[i].from : edges[i].to) === a) edges.splice(i, 1);
      }
      for (const { a: [va, pa], b: [vb, pb] } of sh.before) {
        const x = bound.get(va), y = bound.get(vb);
        const tx = x && Date.parse(String(x.props[pa])), ty = y && Date.parse(String(y.props[pb]));
        if (x && y && typeof tx === 'number' && typeof ty === 'number' && !Number.isNaN(ty) && !(tx < ty)) x.props[pa] = iso(ty - r.int(10, 50) * 60_000);
      }
    }
  }

  ({ byLabel, byId } = index());

  // A test case's own instances and links, on top of the background world.
  if (scenario) {
    const refsTo = new Map<string, Node>();
    (scenario.nodes ?? []).slice(0, 80).forEach((p, i) => {
      if (!model.classes[p.class] || model.classes[p.class].abstract) throw new Error(`The test plants a ${p.class}, which the ontology doesn't have as a concrete class.`);
      const node = make(p.class, i, 9001 + i, Object.fromEntries(Object.entries(p.props ?? {}).map(([k, v]) => [k, v])));
      refsTo.set(p.ref, node);
      planted.add(node.id);
    });
    ({ byLabel, byId } = index());
    for (const l of (scenario.links ?? []).slice(0, 200)) {
      const from = refsTo.get(l.from) ?? byId.get(l.from), to = refsTo.get(l.to) ?? byId.get(l.to);
      if (!from || !to) throw new Error(`The test links ${l.from} to ${l.to}, and one of them isn't planted.`);
      const rel = model.relationships.find((x) => from.labels.includes(x.from) && (x.slot === l.rel || x.type === l.rel));
      if (!rel) throw new Error(`${from.cls} has no relationship ${l.rel}.`);
      link(from, to, rel, l.props);
    }
    for (const [k, v] of refsTo) refs.set(k, v.id);
  }
  const out = new Map<Node, Edge[]>(), inn = new Map<Node, Edge[]>();
  for (const e of edges) { out.set(e.from, [...(out.get(e.from) ?? []), e]); inn.set(e.to, [...(inn.get(e.to) ?? []), e]); }
  return { nodes, edges, now: iso(now), byLabel, out, inn, byId, refs, planted, seeded };
}

/** "@ref" for a planted instance's id; anything else as it is. */
export const resolveRef = (w: World, v: unknown) => (typeof v === 'string' && v.startsWith('@') && w.refs.has(v.slice(1)) ? w.refs.get(v.slice(1)) : v);
