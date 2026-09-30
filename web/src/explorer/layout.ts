// The class map's hand-drawn layout. Concrete classes are boxes; abstract classes are
// frames drawn around their subclasses, so the hierarchy reads as nesting. Every
// relationship is a line between two attach points ("ports"): straight, or routed through
// waypoints where a straight line would cross something. They're chosen so no line passes
// through a box and no two lines cross; web/scripts/check-layout.ts checks both.

export const NODE = { w: 140, h: 48 };
export const VIEW = { w: 848, h: 1112 };

/** Top-left corner of each concrete class. */
export const POS: Record<string, [number, number]> = {
  // Money between the members, and the fee programs captures qualify for, at the top left.
  FeeCollection: [44, 12], Reconciliation: [260, 12], FeeProgram: [260, 84],
  Chunk: [558, 12], Document: [456, 84], ReasonCode: [660, 84],
  Device: [44, 150],
  FraudReport: [260, 210], Settlement: [456, 210], Representment: [660, 210],
  Merchant: [44, 282], Authorization: [260, 282], Capture: [456, 282], Chargeback: [660, 282],
  Acquirer: [44, 354], Refund: [456, 354], PreArbitration: [660, 354],
  // Authorization's other events, under Refund, clear of the lines leaving Authorization's foot.
  Authentication: [456, 426], Reversal: [456, 498],
  // The rest of the dispute chain, below pre-arbitration: arbitration, the outcome, and the retrieval
  // request that can come before a chargeback.
  Arbitration: [660, 426], DisputeOutcome: [660, 498], RetrievalRequest: [660, 570],
  // Events that move a capture's money, under the dispute chain, reaching Capture up the corridor
  // between Capture's column and the dispute frame.
  Payout: [660, 666], Adjustment: [660, 738],
  // Below the payment events' frame, so none of these reads as a payment event.
  Cardholder: [44, 836], Card: [260, 836], ClearingBatch: [660, 836],
  Issuer: [44, 908], BinRange: [260, 908], ResponseCode: [456, 908],
  Person: [44, 1036], Organization: [260, 1036],
};

const PAD = { x: 14, top: 30, bottom: 14 };

export type Box = { x: number; y: number; w: number; h: number };

/** Boxes for every class: concrete ones from POS, abstract ones wrapped around their subclasses. */
export function boxes(children: Record<string, string[]>): Record<string, Box> {
  const out: Record<string, Box> = {};
  const box = (name: string): Box => {
    if (out[name]) return out[name];
    if (POS[name]) return (out[name] = { x: POS[name][0], y: POS[name][1], w: NODE.w, h: NODE.h });
    const kids = (children[name] ?? []).map(box);
    if (!kids.length) throw new Error(`No position for class ${name}`);
    const x0 = Math.min(...kids.map((k) => k.x)) - PAD.x, y0 = Math.min(...kids.map((k) => k.y)) - PAD.top;
    const x1 = Math.max(...kids.map((k) => k.x + k.w)) + PAD.x, y1 = Math.max(...kids.map((k) => k.y + k.h)) + PAD.bottom;
    return (out[name] = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
  };
  Object.keys(children).forEach(box);
  Object.keys(POS).forEach(box);
  return out;
}

type Side = 'left' | 'right' | 'top' | 'bottom';
type Port = [Side, number];
type Point = [number, number];
/**
 * Where a label sits: on which segment of a routed line (by default the longest), how far along it (0 to 1,
 * by default the middle), and on which side. By default: above a horizontal segment, else to the right.
 */
type Label = { seg?: number; at?: number; side?: 'left' | 'right' | 'above' | 'below' };

/**
 * Where each relationship leaves its class and arrives at its target, as a side and a fraction along it, and
 * any waypoints it's routed through.
 * A relationship open to any class has no target box: it ends in a short stub of the given length and direction.
 * A relationship from a class to itself is a loop at the top right, or under the class with loop: ['bottom', fraction].
 */
const PORTS: Record<string, { from?: Port; to?: Port; via?: Point[]; stub?: Point; label?: Label; loop?: Port }> = {
  'Party.acts_as': { from: ['top', 0.21875], to: ['bottom', 0.5] },
  'Merchant.acquired_by': { from: ['bottom', 0.5], to: ['top', 0.5] },
  'Card.held_by': { from: ['left', 0.5], to: ['right', 0.5] },
  'Card.in_bin_range': { from: ['bottom', 0.5], to: ['top', 0.5] },
  'BinRange.assigned_to': { from: ['left', 0.5], to: ['right', 0.5] },
  'Authorization.at_merchant': { from: ['left', 0.5], to: ['right', 0.5] },
  'Authorization.from_device': { from: ['left', 0.2], to: ['right', 0.75], label: { side: 'left' } },
  'Device.seen_at': { from: ['bottom', 0.45], to: ['top', 0.95], label: { side: 'left', at: 0.3 } },
  'Authorization.with_card': { from: ['bottom', 0.3], to: ['top', 0.3] },
  'Authorization.has_response': { from: ['bottom', 0.85], to: ['top', 0.3], label: { at: 0.62 } },
  // Its label sits under the line: routed lines climb past the gap above it.
  'Capture.captures': { from: ['left', 0.5], to: ['right', 0.5], label: { side: 'below' } },
  // Under Authorization, between WITH_CARD and HAS_RESPONSE: above it, FraudReport sits too close.
  'Authorization.increments': { loop: ['bottom', 0.55] },
  'Authorization.authenticated_by': { from: ['right', 0.85], to: ['left', 0.3], label: { at: 0.2 } },
  'Reversal.reverses': { from: ['left', 0.3], to: ['bottom', 0.95], label: { at: 0.15 } },
  'Settlement.settles': { from: ['bottom', 0.5], to: ['top', 0.5] },
  'Refund.refunds': { from: ['top', 0.5], to: ['bottom', 0.5] },
  'FraudReport.reports': { from: ['bottom', 0.5], to: ['top', 0.5] },
  'DisputeEvent.disputes': { from: ['left', 0.2788], to: ['right', 0.5] },
  'DisputeEvent.has_reason': { from: ['top', 0.44], to: ['bottom', 0.428], label: { side: 'left' } },
  'Representment.has_evidence': { from: ['left', 0.2], to: ['bottom', 0.88], label: { side: 'left' } },
  'Chunk.part_of': { from: ['bottom', 0.09], to: ['top', 0.81] },
  'Chunk.mentions': { from: ['right', 0.5], stub: [58, 0] },
  // Up the gap between FraudReport and Settlement, to the top left.
  'Capture.qualifies_for': { from: ['left', 0.1], via: [[420, 286.8], [420, 108]], to: ['right', 0.5], label: { seg: 1, side: 'left' } },
  'Reconciliation.reconciles': { from: ['right', 0.5], via: [[436, 36], [436, 234]], to: ['left', 0.5], label: { seg: 1, at: 0.2, side: 'left' } },
  'FeeCollection.under': { from: ['right', 0.75], to: ['left', 0.5] },
  // Down the left margin, outside every box, to the party roles' frame. Its label sits between FeeCollection and Device.
  'FeeCollection.collected_from': { from: ['left', 0.5], via: [[18, 36], [18, 420]], to: ['left', (420 - 252) / 718], label: { seg: 1, at: (106 - 36) / 384 } },
  // Up the corridor between Capture's column and the dispute frame: the line that meets Capture highest
  // runs furthest right, so none crosses another.
  'Payout.funds': { from: ['left', 0.5], via: [[628, 690], [628, 315.6]], to: ['right', 0.7], label: { seg: 0 } },
  'Adjustment.adjusts': { from: ['left', 0.5], via: [[616, 762], [616, 325.2]], to: ['right', 0.9], label: { seg: 0 } },
  'Capture.in_batch': { from: ['bottom', 0.9], via: [[582, 342], [604, 342], [604, 860]], to: ['left', 0.5], label: { seg: 3 } },
};

function at(b: Box, [side, f]: Port): [number, number] {
  switch (side) {
    case 'left': return [b.x, b.y + b.h * f];
    case 'right': return [b.x + b.w, b.y + b.h * f];
    case 'top': return [b.x + b.w * f, b.y];
    case 'bottom': return [b.x + b.w * f, b.y + b.h];
  }
}

export type EdgeGeometry = {
  d: string; label: [number, number]; anchor: 'start' | 'middle' | 'end';
  /** The arrowhead: a triangle whose tip touches the target. */
  head: string;
  /** For a relationship open to any class: where the words saying so start. */
  open?: [number, number];
  /** The line as straight segments, for web/scripts/check-layout.ts; a loop is traced by its outline. */
  points: Point[];
};

function arrowhead([x, y]: Point, [dx, dy]: Point): string {
  const len = Math.hypot(dx, dy), ux = dx / len, uy = dy / len;
  const bx = x - ux * 7, by = y - uy * 7;
  return `${x},${y} ${bx - uy * 3.6},${by + ux * 3.6} ${bx + uy * 3.6},${by - ux * 3.6}`;
}

/**
 * The path for one relationship, and where its label sits. A relationship from a class to itself is a small loop,
 * one open to any class (no `to` box) is a short stub, and one with waypoints is routed through them.
 */
export function edgeGeometry(id: string, from: Box, to?: Box): EdgeGeometry {
  if (from === to) {
    const loop = PORTS[id]?.loop;
    if (loop?.[0] === 'bottom') {
      const x1 = from.x + from.w * loop[1] - 14, x2 = x1 + 28, y = from.y + from.h;
      return {
        d: `M${x1},${y} C${x1},${y + 26} ${x2},${y + 26} ${x2},${y}`, label: [(x1 + x2) / 2, y + 34], anchor: 'middle',
        head: arrowhead([x2, y], [0, -1]), points: [[x1, y], [x1, y + 20], [x2, y + 20], [x2, y]],
      };
    }
    const x1 = from.x + from.w - 42, x2 = from.x + from.w - 14, y = from.y;
    return {
      d: `M${x1},${y} C${x1},${y - 26} ${x2},${y - 26} ${x2},${y}`, label: [(x1 + x2) / 2, y - 32], anchor: 'middle',
      head: arrowhead([x2, y], [0, 1]), points: [[x1, y], [x1, y - 20], [x2, y - 20], [x2, y]],
    };
  }
  const ports = PORTS[id];
  if (!ports) throw new Error(`No layout for relationship ${id}`);
  if (!ports.from) throw new Error(`No start port for relationship ${id}`);
  if (!to) {
    if (!ports.stub) throw new Error(`${id} is open to any class, so its layout needs a stub`);
    const [x1, y1] = at(from, ports.from), [x2, y2] = [x1 + ports.stub[0], y1 + ports.stub[1]];
    return {
      d: `M${x1},${y1} L${x2},${y2}`, label: [x1 + 5, y1 - 6], anchor: 'start',
      head: arrowhead([x2, y2], [x2 - x1, y2 - y1]), open: [x2 + 5, y2 + 3.5], points: [[x1, y1], [x2, y2]],
    };
  }
  if (!ports.to) throw new Error(`No target port for relationship ${id}`);
  const points: Point[] = [at(from, ports.from), ...(ports.via ?? []), at(to, ports.to)];
  const segs = points.slice(1).map((p, i) => [points[i], p] as const);
  const longest = segs.reduce((best, s, i) => (length(s) > length(segs[best]) ? i : best), 0);
  const [[x1, y1], [x2, y2]] = segs[ports.label?.seg ?? longest];
  const t = ports.label?.at ?? 0.5;
  const lx = x1 + (x2 - x1) * t, ly = y1 + (y2 - y1) * t;
  const side = ports.label?.side ?? (Math.abs(y2 - y1) < 2 ? 'above' : 'right');
  const [px, py] = points[points.length - 2], [ex, ey] = points[points.length - 1];
  return {
    d: 'M' + points.map(([x, y]) => `${x},${y}`).join(' L'),
    label: side === 'above' ? [lx, ly - 6] : side === 'below' ? [lx, ly + 12] : [side === 'left' ? lx - 6 : lx + 6, ly + 3.5],
    anchor: side === 'above' || side === 'below' ? 'middle' : side === 'left' ? 'end' : 'start',
    head: arrowhead([ex, ey], [ex - px, ey - py]), points,
  };
}

function length([[x1, y1], [x2, y2]]: readonly [Point, Point]) {
  return Math.hypot(x2 - x1, y2 - y1);
}
