// The class map's hand-drawn layout. Concrete classes are boxes; abstract classes are
// frames drawn around their subclasses, so the hierarchy reads as nesting. Every
// relationship is a straight line between two attach points ("ports"), chosen so no
// line passes through a box and no two lines cross.

export const NODE = { w: 140, h: 48 };
export const VIEW = { w: 828, h: 960 };

/** Top-left corner of each concrete class. */
export const POS: Record<string, [number, number]> = {
  Chunk: [538, 12], Document: [436, 84], ReasonCode: [640, 84],
  Device: [24, 150],
  FraudReport: [240, 210], Settlement: [436, 210], Representment: [640, 210],
  Merchant: [24, 282], Authorization: [240, 282], Capture: [436, 282], Chargeback: [640, 282],
  Acquirer: [24, 354], Refund: [436, 354], PreArbitration: [640, 354],
  // Authorization's other events, under Refund, clear of the lines leaving Authorization's foot.
  Authentication: [436, 426], Reversal: [436, 498],
  // The rest of the dispute chain, below pre-arbitration: arbitration, the outcome, and the retrieval
  // request that can come before a chargeback.
  Arbitration: [640, 426], DisputeOutcome: [640, 498], RetrievalRequest: [640, 570],
  // Below the payment events' frame, so none of these reads as a payment event.
  Cardholder: [24, 682], Card: [240, 682],
  Issuer: [24, 754], BinRange: [240, 754], ResponseCode: [436, 754],
  Person: [24, 882], Organization: [240, 882],
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
/** Where a label sits along its line (0 to 1), and on which side. By default: the middle, above a horizontal line, else to the right. */
type Label = { at?: number; side?: 'left' | 'right' | 'above' };

/**
 * Where each relationship leaves its class and arrives at its target, as a side and a fraction along it.
 * A relationship open to any class has no target box: it ends in a short stub of the given length and direction.
 * A relationship from a class to itself is a loop at the top right, or under the class with loop: ['bottom', fraction].
 */
const PORTS: Record<string, { from?: Port; to?: Port; stub?: [number, number]; label?: Label; loop?: Port }> = {
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
  'Capture.captures': { from: ['left', 0.5], to: ['right', 0.5] },
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
};

function arrowhead([x, y]: [number, number], [dx, dy]: [number, number]): string {
  const len = Math.hypot(dx, dy), ux = dx / len, uy = dy / len;
  const bx = x - ux * 7, by = y - uy * 7;
  return `${x},${y} ${bx - uy * 3.6},${by + ux * 3.6} ${bx + uy * 3.6},${by - ux * 3.6}`;
}

/**
 * The path for one relationship, and where its label sits. A relationship from a class to itself is a small loop,
 * and one open to any class (no `to` box) is a short stub.
 */
export function edgeGeometry(id: string, from: Box, to?: Box): EdgeGeometry {
  if (from === to) {
    const loop = PORTS[id]?.loop;
    if (loop?.[0] === 'bottom') {
      const x1 = from.x + from.w * loop[1] - 14, x2 = x1 + 28, y = from.y + from.h;
      return {
        d: `M${x1},${y} C${x1},${y + 26} ${x2},${y + 26} ${x2},${y}`, label: [(x1 + x2) / 2, y + 34], anchor: 'middle',
        head: arrowhead([x2, y], [0, -1]),
      };
    }
    const x1 = from.x + from.w - 42, x2 = from.x + from.w - 14, y = from.y;
    return {
      d: `M${x1},${y} C${x1},${y - 26} ${x2},${y - 26} ${x2},${y}`, label: [(x1 + x2) / 2, y - 32], anchor: 'middle',
      head: arrowhead([x2, y], [0, 1]),
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
      head: arrowhead([x2, y2], [x2 - x1, y2 - y1]), open: [x2 + 5, y2 + 3.5],
    };
  }
  if (!ports.to) throw new Error(`No target port for relationship ${id}`);
  const [x1, y1] = at(from, ports.from), [x2, y2] = at(to, ports.to);
  const t = ports.label?.at ?? 0.5;
  const lx = x1 + (x2 - x1) * t, ly = y1 + (y2 - y1) * t;
  const side = ports.label?.side ?? (Math.abs(y2 - y1) < 2 ? 'above' : 'right');
  return {
    d: `M${x1},${y1} L${x2},${y2}`,
    label: side === 'above' ? [lx, ly - 6] : [side === 'left' ? lx - 6 : lx + 6, ly + 3.5],
    anchor: side === 'above' ? 'middle' : side === 'left' ? 'end' : 'start',
    head: arrowhead([x2, y2], [x2 - x1, y2 - y1]),
  };
}
