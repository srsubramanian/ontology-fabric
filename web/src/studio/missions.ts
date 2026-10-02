// Guided missions: each question the ontology can't answer yet, turned into a few steps a payments person can
// follow on the map, in payments words. Each mission teaches one modeling idea (decision 7). A step is done when
// the shared draft shows it's done, so progress is everyone's: a mission someone else finished reads as finished.
// The classes, fields and queries here are illustrative first answers, for the owning teams to review.
import type { PortSpec } from '../explorer/layout.ts';
import { analyse, type Analysis } from './analysis.ts';
import { live, mergeDraft, slotKey, type DraftDoc, type DraftUpdate, type Point } from './draft.ts';
import { addClass, addSlot, classExists, renameSlot, type Ctx } from './edits.ts';

export type Choice = { label: string; right?: boolean; why: string };
export type ClassSpec = {
  name: string; is_a?: string; owner: string; lives_in: 'graph' | 'warehouse' | 'search'; id_rule: string;
  description: string; no_standard: string;
  /** The class to place it near on the map. */
  near?: string;
  /** A spot designed offline, where it and the mission's lines sit clean on the released map. */
  at?: Point;
};
export type FieldSpec = {
  name: string; label: string; type: string;
  /** A field that holds one of a list of codes: the list's name, and each code with what it means. */
  list?: { name: string; values: Record<string, string> };
};
export type Step =
  | { kind: 'think'; ask: string; choices: Choice[] }
  | { kind: 'place'; say: string; cls: ClassSpec }
  | { kind: 'link'; say: string; from: string; to: string; ask: string; phrases: (Choice & { name?: string })[]; many?: boolean;
    /** The line's route, designed with the class's spot. */
    port?: PortSpec }
  | { kind: 'fields'; say: string; cls: string; fields: FieldSpec[] }
  | { kind: 'walk'; say: string; walks: string[] }
  | { kind: 'query'; say: string; explain: string; query: string };

export type Mission = {
  /** The competency question it answers. */
  id: string; title: string; team: string;
  /** The modeling idea it teaches, in a few words. */
  learn: string;
  intro: string; done: string;
  /** The classes the mission works on; the rest of the map fades back. */
  focus: string[];
  steps: Step[];
};

const NO_STANDARD = 'Not checked against FIBO or ISO 20022 yet: review before release.';

export const MISSIONS: Mission[] = [
  {
    id: 'CQ-113', title: 'Fraud types', team: 'risk', learn: 'a field that holds a list of codes',
    intro: 'When an issuer reports fraud, it says what kind: lost, stolen, counterfeit, card not present. The ontology doesn\'t keep that yet, so risk can\'t ask about it.',
    done: 'Risk can now ask what kind of fraud each report was.',
    focus: ['FraudReport', 'Authorization'],
    steps: [
      {
        kind: 'fields', cls: 'FraudReport', say: 'Give fraud reports a fraud type. These are the kinds Visa\'s and Mastercard\'s fraud reports use. Untick any you don\'t want.',
        fields: [{
          name: 'fraud_type', label: 'Fraud type', type: 'list', list: {
            name: 'FraudType', values: {
              lost: 'Lost card', stolen: 'Stolen card', never_received: 'Card never received', fraudulent_application: 'Fraudulent application',
              counterfeit: 'Counterfeit card', account_takeover: 'Account takeover', card_not_present: 'Card not present',
            },
          },
        }],
      },
      { kind: 'walk', say: 'Show the question its path: click the REPORTS line, from FraudReport to Authorization.', walks: ['FraudReport.reports'] },
      {
        kind: 'query', say: 'Last step: the query that answers it.', explain: 'Find the fraud reports on one authorization, and the kind of fraud each one reported.',
        query: 'MATCH (fr:FraudReport)-[:REPORTS]->(a:Authorization)\nWHERE a.id = $authorization\nRETURN fr.id AS report, fr.fraud_type AS fraud_type\nLIMIT 20',
      },
    ],
  },
  {
    id: 'CQ-115', title: 'Fraud scores', team: 'risk', learn: 'a number on an event',
    intro: 'Our fraud model scores every authorization. Risk wants the ones it scored high that were approved anyway, but the score isn\'t in the ontology.',
    done: 'Risk can now find approvals the model would have stopped.',
    focus: ['Authorization', 'ResponseCode'],
    steps: [
      {
        kind: 'think', ask: 'Where does the fraud score belong?', choices: [
          { label: 'On each authorization, as a number', right: true, why: 'Right. The model scores each authorization once, as it happens, so the score is part of that event.' },
          { label: 'On the merchant', why: 'A merchant has many authorizations, and each gets its own score.' },
          { label: 'On the card', why: 'A card is used many times. The score belongs to each use, not to the card.' },
        ],
      },
      { kind: 'fields', cls: 'Authorization', say: 'Add the score to Authorization.', fields: [{ name: 'fraud_score', label: 'Fraud score, from 0 to 1', type: 'decimal' }] },
      { kind: 'walk', say: 'The question checks whether each was approved: click the HAS_RESPONSE line, from Authorization to ResponseCode.', walks: ['Authorization.has_response'] },
      {
        kind: 'query', say: 'Last step: the query. Snowflake answers this one, since it holds every authorization.',
        explain: 'Authorizations scored above the threshold whose response code was 00, approved.',
        query: 'SELECT a.authorization_id, a.fraud_score, a.response_code   -- Authorization.has_response\nFROM fct_authorization a\nWHERE a.fraud_score > $threshold\n  AND a.response_code = \'00\'\nLIMIT 100',
      },
    ],
  },
  {
    id: 'CQ-116', title: 'Payment facilitators', team: 'risk', learn: 'roles a business plays',
    intro: 'A payment facilitator signs up small merchants under its own agreement with an acquirer. Risk wants to see each facilitator\'s sub-merchants.',
    done: 'Risk can now see every facilitator\'s sub-merchants.',
    focus: ['Merchant', 'Acquirer', 'PaymentFacilitator'],
    steps: [
      {
        kind: 'think', ask: 'What kind of thing is a payment facilitator?', choices: [
          { label: 'A role a business plays, like merchant or acquirer', right: true, why: 'Right. The same company can be a merchant and a facilitator, so it\'s a role (decision 7).' },
          { label: 'Something that happens, like a payment', why: 'Things that happen are events. A facilitator is a business that keeps existing.' },
          { label: 'A kind of card', why: 'Cards are what cardholders pay with. A facilitator is a business.' },
        ],
      },
      {
        kind: 'place', say: 'Add PaymentFacilitator to the party roles, inside the PartyRole box.',
        cls: {
          name: 'PaymentFacilitator', is_a: 'PartyRole', owner: 'core', lives_in: 'graph', id_rule: 'pf:{payfac_id}', near: 'Acquirer', at: [44, 420],
          description: 'A merchant that signs up other merchants, its sub-merchants, under its own acquiring agreement.', no_standard: NO_STANDARD,
        },
      },
      {
        kind: 'link', say: 'Connect them: drag the ⊕ on Merchant onto PaymentFacilitator.', from: 'Merchant', to: 'PaymentFacilitator',
        port: { from: ['right', 0.7], to: ['right', 0.3], via: [[222, 315.6], [222, 434.4]] },
        ask: 'Read it as a sentence: Merchant … PaymentFacilitator', phrases: [
          { label: 'is a sub-merchant of', name: 'sub_merchant_of', right: true, why: 'Right. Each sub-merchant points to the one facilitator it signed up through.' },
          { label: 'owns', why: 'The facilitator doesn\'t own the merchant. It signs it up.' },
          { label: 'pays', why: 'Money doesn\'t move along this link. Payouts are events of their own.' },
        ],
      },
      { kind: 'walk', say: 'Click the new SUB_MERCHANT_OF line.', walks: ['Merchant.sub_merchant_of'] },
      {
        kind: 'query', say: 'Last step: the query.', explain: 'For each facilitator, count its sub-merchants, biggest first.',
        query: 'MATCH (sub:Merchant)-[:SUB_MERCHANT_OF]->(pf:PaymentFacilitator)\nRETURN pf.id AS facilitator, count(sub) AS sub_merchants\nORDER BY sub_merchants DESC\nLIMIT 50',
      },
    ],
  },
  {
    id: 'CQ-119', title: 'Data breaches', team: 'risk', learn: 'an event that touches many things',
    intro: 'When a breach exposes cards, risk wants to know which cards it hit, and which have been used since.',
    done: 'Risk can now trace a breach to its cards, and see which were used after it.',
    focus: ['DataBreach', 'Card', 'Authorization'],
    steps: [
      {
        kind: 'think', ask: 'What is a data breach, in the ontology?', choices: [
          { label: 'Something that happened, with its own date', right: true, why: 'Right. A breach is an event: it happens once and touches many cards.' },
          { label: 'A flag on each card', why: 'A flag loses which breach it was, and when. A card can be in more than one.' },
          { label: 'A kind of merchant', why: 'A breach may happen at a merchant, but the breach is a thing of its own.' },
        ],
      },
      {
        kind: 'place', say: 'Add DataBreach to the map, near Card.',
        cls: {
          name: 'DataBreach', owner: 'risk', lives_in: 'graph', id_rule: 'brch:{breach_id}', near: 'Card', at: [420, 972],
          description: 'A compromise of card data, such as at a merchant or a processor, and when it was disclosed.', no_standard: NO_STANDARD,
        },
      },
      { kind: 'fields', cls: 'DataBreach', say: 'A breach needs its date, to tell "used since" from "used before".', fields: [{ name: 'disclosed_at', label: 'When it was disclosed', type: 'datetime' }] },
      {
        kind: 'link', say: 'Connect them: drag the ⊕ on DataBreach onto Card.', from: 'DataBreach', to: 'Card', many: true,
        port: { from: ['left', 0.3], to: ['right', 0.7], label: { at: 0.65, side: 'right' } },
        ask: 'Read it as a sentence: DataBreach … Card', phrases: [
          { label: 'exposed', name: 'exposed', right: true, why: 'Right. One breach exposed many cards, so this link points to many.' },
          { label: 'was paid with', why: 'A breach isn\'t a payment.' },
          { label: 'belongs to', why: 'The breach doesn\'t belong to a card. It touched many of them.' },
        ],
      },
      { kind: 'walk', say: 'Click EXPOSED, then the WITH_CARD line from Authorization to Card.', walks: ['DataBreach.exposed', 'Authorization.with_card'] },
      {
        kind: 'query', say: 'Last step: the query.', explain: 'The cards one breach exposed, and how many times each was used after it was disclosed.',
        query: 'MATCH (b:DataBreach)-[:EXPOSED]->(c:Card)\nWHERE b.id = $breach\nOPTIONAL MATCH (a:Authorization)-[:WITH_CARD]->(c)\nWHERE a.authorized_at > b.disclosed_at\nRETURN c.id AS card, count(a) AS used_since\nLIMIT 500',
      },
    ],
  },
  {
    id: 'CQ-117', title: 'Merchant changes', team: 'risk', learn: 'events, not overwrites',
    intro: 'Fraudsters sometimes change a merchant\'s name or category code to slip past rules. Today a change overwrites the old value, so it can\'t be seen.',
    done: 'Risk can now see which merchants changed their name or category code, and when.',
    focus: ['Merchant', 'MerchantChange'],
    steps: [
      {
        kind: 'think', ask: 'A merchant changes its category code. How should the ontology keep that?', choices: [
          { label: 'Overwrite the code on the merchant', why: 'Then the old code is gone, and so is the fact that it changed.' },
          { label: 'Record the change as an event', right: true, why: 'Right. Model events, not status fields (decision 7): each change keeps what changed, and when.' },
        ],
      },
      {
        kind: 'place', say: 'Add MerchantChange to the map.',
        cls: {
          name: 'MerchantChange', owner: 'core', lives_in: 'graph', id_rule: 'mchg:{change_id}', near: 'Merchant', at: [420, 984],
          description: 'A change to a merchant\'s details, such as its name or category code.', no_standard: NO_STANDARD,
        },
      },
      {
        kind: 'fields', cls: 'MerchantChange', say: 'Record what changed, and when.', fields: [
          { name: 'changed', label: 'What changed', type: 'list', list: { name: 'MerchantDetail', values: { name: 'Name', mcc: 'Merchant category code', country: 'Country' } } },
          { name: 'changed_at', label: 'When it changed', type: 'datetime' },
        ],
      },
      {
        kind: 'link', say: 'Connect them: drag the ⊕ on MerchantChange onto Merchant.', from: 'MerchantChange', to: 'Merchant',
        port: { from: ['left', 0.5], to: ['left', 0.7], via: [[32, 1008], [32, 315.6]] },
        ask: 'Read it as a sentence: MerchantChange … Merchant', phrases: [
          { label: 'changes', name: 'changes', right: true, why: 'Right. The event points to the merchant it changed.' },
          { label: 'is owned by', why: 'Nothing owns a change. It\'s a record of what happened to the merchant.' },
          { label: 'pays', why: 'No money moves here.' },
        ],
      },
      { kind: 'walk', say: 'Click the new CHANGES line.', walks: ['MerchantChange.changes'] },
      {
        kind: 'query', say: 'Last step: the query.', explain: 'Every merchant whose details changed since a date, newest first, with what changed.',
        query: 'MATCH (ch:MerchantChange)-[:CHANGES]->(m:Merchant)\nWHERE ch.changed_at >= $since\nRETURN m.id AS merchant, ch.changed AS what_changed, ch.changed_at AS changed_at\nORDER BY changed_at DESC\nLIMIT 100',
      },
    ],
  },
  {
    id: 'CQ-114', title: 'Risk ratings at sign-up', team: 'risk', learn: 'decisions as events',
    intro: 'When an acquirer signs up a merchant, it rates the merchant\'s risk. Risk wants the merchants rated high, by acquirer.',
    done: 'Risk can now see which merchants each acquirer rated high when it signed them up.',
    focus: ['Merchant', 'Acquirer', 'UnderwritingDecision'],
    steps: [
      {
        kind: 'think', ask: 'Where does the acquirer\'s risk rating go?', choices: [
          { label: 'A rating field on the merchant', why: 'Ratings get revisited. A field keeps only the latest, and not who decided it.' },
          { label: 'An underwriting decision: an event', right: true, why: 'Right. The acquirer decides at sign-up, and may decide again later. Each decision is an event.' },
        ],
      },
      {
        kind: 'place', say: 'Add UnderwritingDecision to the map.',
        cls: {
          name: 'UnderwritingDecision', owner: 'risk', lives_in: 'graph', id_rule: 'uw:{decision_id}', near: 'Acquirer', at: [420, 984],
          description: 'An acquirer\'s decision to sign up a merchant, with the risk rating it gave.', no_standard: NO_STANDARD,
        },
      },
      {
        kind: 'fields', cls: 'UnderwritingDecision', say: 'Record the rating, and when it was given.', fields: [
          { name: 'risk_rating', label: 'Risk rating', type: 'list', list: { name: 'RiskRating', values: { low: 'Low', medium: 'Medium', high: 'High' } } },
          { name: 'decided_at', label: 'When it was decided', type: 'datetime' },
        ],
      },
      {
        kind: 'link', say: 'Connect them: drag the ⊕ on UnderwritingDecision onto Merchant.', from: 'UnderwritingDecision', to: 'Merchant',
        port: { from: ['left', 0.5], to: ['left', 0.7], via: [[32, 1008], [32, 315.6]] },
        ask: 'Read it as a sentence: UnderwritingDecision … Merchant', phrases: [
          { label: 'underwrites', name: 'underwrites', right: true, why: 'Right. The decision is about one merchant.' },
          { label: 'is paid by', why: 'No money moves here.' },
          { label: 'is a kind of', why: 'That would make it a merchant. It\'s a decision about one.' },
        ],
      },
      { kind: 'walk', say: 'Click UNDERWRITES, then ACQUIRED_BY, from Merchant to Acquirer.', walks: ['UnderwritingDecision.underwrites', 'Merchant.acquired_by'] },
      {
        kind: 'query', say: 'Last step: the query.', explain: 'Merchants rated high when they were signed up, with the acquirer that rated them.',
        query: 'MATCH (d:UnderwritingDecision)-[:UNDERWRITES]->(m:Merchant)-[:ACQUIRED_BY]->(acq:Acquirer)\nWHERE d.risk_rating = \'high\'\nRETURN acq.id AS acquirer, m.id AS merchant, d.decided_at AS decided_at\nLIMIT 100',
      },
    ],
  },
  {
    id: 'CQ-120', title: 'Blocked cards', team: 'risk', learn: 'high-volume events in the warehouse',
    intro: 'An issuer blocks a card, and then it turns up in a merchant\'s authorizations. Card status changes aren\'t modelled, so risk can\'t see it.',
    done: 'Risk can now spot blocked cards turning up at a merchant.',
    focus: ['Authorization', 'Merchant', 'Card', 'CardStatusChange'],
    steps: [
      {
        kind: 'think', ask: 'Issuers block, reissue and close millions of cards. Where should those changes live?', choices: [
          { label: 'In Snowflake, as events', right: true, why: 'Right. High-volume events stay in the warehouse (decision 2), and Snowflake answers this question.' },
          { label: 'As a status field on the card', why: 'A field keeps only the latest status, not when it changed.' },
          { label: 'In Neptune, every one of them', why: 'Neptune holds what questions walk through. Millions of status changes belong in the warehouse.' },
        ],
      },
      {
        kind: 'place', say: 'Add CardStatusChange to the map. It lives in Snowflake, so Neptune never loads it.',
        cls: {
          name: 'CardStatusChange', owner: 'risk', lives_in: 'warehouse', id_rule: 'cst:{change_id}', near: 'Card', at: [420, 972],
          description: 'An issuer changing a card\'s status: blocked, reissued or closed.', no_standard: NO_STANDARD,
        },
      },
      {
        kind: 'fields', cls: 'CardStatusChange', say: 'Record the new status, and when it changed.', fields: [
          { name: 'status', label: 'New status', type: 'list', list: { name: 'CardStatus', values: { blocked: 'Blocked', reissued: 'Reissued', closed: 'Closed' } } },
          { name: 'changed_at', label: 'When it changed', type: 'datetime' },
        ],
      },
      {
        kind: 'link', say: 'Connect them: drag the ⊕ on CardStatusChange onto Card.', from: 'CardStatusChange', to: 'Card',
        port: { from: ['left', 0.3], to: ['right', 0.7], label: { at: 0.65, side: 'right' } },
        ask: 'Read it as a sentence: CardStatusChange … Card', phrases: [
          { label: 'is a change to', name: 'of_card', right: true, why: 'Right. Each status change is about one card.' },
          { label: 'pays with', why: 'No payment happens here.' },
          { label: 'issues', why: 'Issuers issue cards. This event records a change to one.' },
        ],
      },
      { kind: 'walk', say: 'Click AT_MERCHANT, then WITH_CARD, then the new line to Card.', walks: ['Authorization.at_merchant', 'Authorization.with_card', 'CardStatusChange.of_card'] },
      {
        kind: 'query', say: 'Last step: the query, in Snowflake.', explain: 'A merchant\'s authorizations on cards the issuer had already blocked.',
        query: 'SELECT a.authorization_id, c.card_id, s.status, s.changed_at\nFROM fct_authorization a\nJOIN dim_card c ON c.card_id = a.card_id                        -- Authorization.with_card\nJOIN fct_card_status_change s ON s.card_id = c.card_id          -- CardStatusChange.of_card\nWHERE a.merchant_id = $merchant                                 -- Authorization.at_merchant\n  AND s.status = \'blocked\' AND s.changed_at < a.authorized_at\nLIMIT 100',
      },
    ],
  },
  {
    id: 'CQ-118', title: 'Shared IPs and emails', team: 'risk', learn: 'codes become boxes when things link through them',
    intro: 'Fraud rings reuse IP addresses and emails. Risk wants every fraud report that\'s linked to another through one.',
    done: 'Risk can now link fraud reports through a shared IP address or email. Shipping addresses work the same way.',
    focus: ['FraudReport', 'Authorization', 'Device', 'IpAddress', 'EmailAddress'],
    steps: [
      {
        kind: 'think', ask: 'Two fraud reports came from the same IP address. How do we let the map connect them?', choices: [
          { label: 'Make the IP address its own box', right: true, why: 'Right. When things link through a code, the code becomes a node (decision 7). Both authorizations then point to the same IP.' },
          { label: 'Store the IP as a field on each authorization', why: 'Fields can\'t be walked. Two authorizations with the same IP would never meet on the map.' },
        ],
      },
      {
        kind: 'place', say: 'Add IpAddress to the map.',
        cls: { name: 'IpAddress', owner: 'risk', lives_in: 'graph', id_rule: 'ip:{address}', near: 'Device', at: [420, 972], description: 'An IP address an authorization came from.', no_standard: NO_STANDARD },
      },
      {
        kind: 'link', say: 'Drag the ⊕ on Authorization onto IpAddress.', from: 'Authorization', to: 'IpAddress',
        port: { from: ['bottom', 0.7], to: ['left', 0.3] },
        ask: 'Read it as a sentence: Authorization … IpAddress', phrases: [
          { label: 'came from', name: 'from_ip', right: true, why: 'Right. Each authorization came from one IP address, and many can share it.' },
          { label: 'owns', why: 'Nobody owns an IP address here. The authorization was just sent from it.' },
        ],
      },
      {
        kind: 'place', say: 'Now the same for email: add EmailAddress.',
        cls: { name: 'EmailAddress', owner: 'risk', lives_in: 'graph', id_rule: 'email:{address_hash}', near: 'IpAddress', at: [332, 1104], description: 'An email address given with an authorization, kept as a hash.', no_standard: NO_STANDARD },
      },
      {
        kind: 'link', say: 'Drag the ⊕ on Authorization onto EmailAddress.', from: 'Authorization', to: 'EmailAddress',
        port: { from: ['bottom', 0.7], to: ['top', 0.5], via: [[358, 811], [402, 811]] },
        ask: 'Read it as a sentence: Authorization … EmailAddress', phrases: [
          { label: 'used', name: 'used_email', right: true, why: 'Right. The authorization used that email, and others can use it too.' },
          { label: 'sent', why: 'An authorization doesn\'t send emails. It gives one.' },
        ],
      },
      { kind: 'walk', say: 'Click REPORTS, then FROM_IP, then USED_EMAIL.', walks: ['FraudReport.reports', 'Authorization.from_ip', 'Authorization.used_email'] },
      {
        kind: 'query', say: 'Last step: the query.', explain: 'Fraud reports that share an IP address or an email with this one, with what they share.',
        query: 'MATCH (fr:FraudReport)-[:REPORTS]->(:Authorization)-[:FROM_IP]->(ip:IpAddress)<-[:FROM_IP]-(:Authorization)<-[:REPORTS]-(other:FraudReport)\nWHERE fr.id = $report AND other <> fr\nRETURN \'ip\' AS via, ip.id AS shared, collect(DISTINCT other.id) AS reports\nLIMIT 50\nUNION\nMATCH (fr:FraudReport)-[:REPORTS]->(:Authorization)-[:USED_EMAIL]->(e:EmailAddress)<-[:USED_EMAIL]-(:Authorization)<-[:REPORTS]-(other:FraudReport)\nWHERE fr.id = $report AND other <> fr\nRETURN \'email\' AS via, e.id AS shared, collect(DISTINCT other.id) AS reports\nLIMIT 50',
      },
    ],
  },
];

export const missionById = (id: string) => MISSIONS.find((m) => m.id === id);

/** A step in a few words, for the list of steps and for Undo. */
export function stepLabel(s: Step): string {
  switch (s.kind) {
    case 'think': return s.ask;
    case 'place': return `Add ${s.cls.name}`;
    case 'link': return `Connect ${s.from} to ${s.to}`;
    case 'fields': return `Record ${s.fields.map((f) => f.label.toLowerCase()).join(' and ')} on ${s.cls}`;
    case 'walk': return 'Show the question its path';
    case 'query': return 'Write the query';
  }
}
type LinkStep = Extract<Step, { kind: 'link' }>;
const rightPhrase = (s: LinkStep) => s.phrases.find((p) => p.right)!;
const merge = (a: DraftUpdate, b: DraftUpdate) => mergeDraft(a as DraftDoc, b as Record<string, unknown>) as DraftUpdate;

/** The draft slots that run from a class to another, by any name. */
const linksBetween = (ctx: Ctx, from: string, to: string) => live(ctx.draft.slots).filter(([, s]) => s.class === from && s.range === to);
const sameWalk = (a: string[] | undefined, b: string[]) => !!a && a.length === b.length && a.every((w, i) => w === b[i]);
/** The classes the mission will relate a class to. */
const linksOf = (m: Mission, name: string) =>
  m.steps.flatMap((x) => (x.kind === 'link' && x.from === name ? [x.to] : x.kind === 'link' && x.to === name ? [x.from] : []));

/** Whether the shared draft shows this step done. A think step is done once answered here, or once a later step is. */
export function stepDone(m: Mission, i: number, ctx: Ctx, a: Analysis, thought: Set<string>): boolean {
  const s = m.steps[i];
  const later = () => m.steps.slice(i + 1).some((_, j) => stepDone(m, i + 1 + j, ctx, a, thought));
  switch (s.kind) {
    case 'think': return thought.has(`${m.id}:${i}`) || later();
    case 'place': return !!ctx.draft.classes[s.cls.name]?.added;
    case 'link': return !!ctx.draft.slots[slotKey(s.from, rightPhrase(s).name!)];
    case 'fields': return s.fields.every((f) => !!ctx.draft.slots[slotKey(s.cls, f.name)]);
    case 'walk': return sameWalk(ctx.draft.answers[m.id]?.walks, s.walks);
    case 'query': {
      const ans = ctx.draft.answers[m.id];
      return !!ans?.query.trim() && !a.report.problems.some((p) => p.startsWith(m.id + ':'));
    }
  }
}

/** The first step not done yet, or the number of steps when the mission is complete. */
export function progress(m: Mission, ctx: Ctx, a: Analysis, thought: Set<string>): number {
  const i = m.steps.findIndex((_, j) => !stepDone(m, j, ctx, a, thought));
  return i < 0 ? m.steps.length : i;
}

/** A link the person drew between the step's classes, under a name that isn't the one the step wants yet. */
export function pendingLink(s: LinkStep, ctx: Ctx): string | undefined {
  const want = rightPhrase(s).name!;
  return linksBetween(ctx, s.from, s.to).map(([k]) => k).find((k) => k !== slotKey(s.from, want));
}

/** How many problems the class map check names on the draft, with an update applied. */
const mapProblems = (ctx: Ctx, u: DraftUpdate = {}) =>
  analyse(mergeDraft(ctx.draft, u as Record<string, unknown>), ctx.base, ctx.questions).report.problems.filter((p) => p.startsWith('class map:')).length;
/** Whether an update leaves the class map as tidy as it found it. */
const tidy = (ctx: Ctx, u: DraftUpdate) => mapProblems(ctx, u) <= mapProblems(ctx);
/** A link step's line by its designed route. */
const designedLink = (s: LinkStep): DraftUpdate => {
  const name = rightPhrase(s).name!;
  return { slots: { [slotKey(s.from, name)]: { class: s.from, name, range: s.to, ...(s.many ? { multivalued: true } : {}), port: s.port } } };
};

/**
 * Where a place step puts its class: the designed spot, while it and the mission's lines from it still sit clean on
 * the draft (other missions may have built there), or else the nearest spot its lines can reach cleanly.
 */
export function placeSpot(m: Mission, i: number, ctx: Ctx): Point {
  const s = m.steps[i] as Extract<Step, { kind: 'place' }>;
  const { name, near, at, ...spec } = s.cls;
  const e = { ...spec, is_a: spec.is_a ?? null };
  if (at) {
    const u = addClass(ctx, name, e, { at });
    const after: Ctx = { ...ctx, draft: mergeDraft(ctx.draft, u as Record<string, unknown>) };
    const lines = m.steps.filter((x): x is LinkStep => x.kind === 'link' && !!x.port && (x.from === name || x.to === name)
      && classExists(after, x.from) && classExists(after, x.to));
    if (tidy(ctx, lines.reduce((all, l) => merge(all, designedLink(l)), u))) return at;
  }
  return addClass(ctx, name, e, { near, links: linksOf(m, name) }).classes![name]!.pos as Point;
}

/**
 * The change that does a step, for Do it for me, or with the person's own choices: the codes they kept, or the spot
 * they clicked to place a class near.
 */
export function doStep(m: Mission, i: number, ctx: Ctx, opts: { near?: Point; values?: Record<string, string[]> } = {}): DraftUpdate {
  const s = m.steps[i];
  const q = ctx.questions.questions.find((x) => x.id === m.id)!;
  const answer = ctx.draft.answers[m.id] ?? { answered_in: q.answered_in, walks: [], query: '' };
  switch (s.kind) {
    case 'think': return {};
    case 'place': {
      const { name, near: _near, at: _at, ...spec } = s.cls;
      const e = { ...spec, is_a: spec.is_a ?? null };
      return opts.near ? addClass(ctx, name, e, { nearPoint: opts.near, links: linksOf(m, name) }) : addClass(ctx, name, e, { at: placeSpot(m, i, ctx) });
    }
    case 'link': {
      const name = rightPhrase(s).name!, key = slotKey(s.from, name);
      const drawn = pendingLink(s, ctx);
      // The designed route while it's still clean; otherwise the line the person drew, or a fresh route.
      if (s.port) {
        const d = drawn ? merge(renameSlot(ctx, drawn, name), designedLink(s)) : designedLink(s);
        if (tidy(ctx, d)) return d;
      }
      const u = drawn ? renameSlot(ctx, drawn, name) : addSlot(ctx, s.from, name, s.to);
      return s.many ? merge(u, { slots: { [key]: { multivalued: true } } }) : u;
    }
    case 'fields': {
      let u: DraftUpdate = {};
      for (const f of s.fields) {
        if (ctx.draft.slots[slotKey(s.cls, f.name)]) continue;
        if (f.list) {
          const keep = opts.values?.[f.name] ?? Object.keys(f.list.values);
          u = merge(u, { enums: { [f.list.name]: { values: Object.fromEntries(keep.map((v) => [v, f.list!.values[v] ?? ''])) } } });
          u = merge(u, addSlot(ctx, s.cls, f.name, f.list.name));
        } else u = merge(u, addSlot(ctx, s.cls, f.name, f.type));
      }
      return u;
    }
    case 'walk': return { answers: { [m.id]: { ...answer, walks: s.walks } } };
    case 'query': {
      const walk = m.steps.find((x): x is Extract<Step, { kind: 'walk' }> => x.kind === 'walk')?.walks ?? [];
      return { answers: { [m.id]: { ...answer, walks: answer.walks.length ? answer.walks : walk, query: s.query } } };
    }
  }
}

/** Plays every step, as Do it for me would: the mission's whole answer. */
export function solve(m: Mission, ctx: Ctx, apply: (ctx: Ctx, u: DraftUpdate) => Ctx): Ctx {
  let c = ctx;
  m.steps.forEach((_, i) => { c = apply(c, doStep(m, i, c)); });
  return c;
}
