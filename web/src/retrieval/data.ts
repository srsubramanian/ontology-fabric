/** The 11 stages, in order. Their colours follow the store or layer each stage uses. */
export const STAGES = [
  { title: 'Arrive', tag: 'Checked at the gateway', color: 'var(--onto)' },
  { title: 'Understand', tag: 'One question, four routes', color: 'var(--query)' },
  { title: 'Entry points', tag: 'One ID opens three stores', color: 'var(--search)' },
  { title: 'Walk the graph', tag: 'Follow the cards', color: 'var(--graph)' },
  { title: 'Count in the graph', tag: 'Counts along relationships', color: 'var(--graph)' },
  { title: 'Ask the warehouse', tag: 'How much, how often', color: 'var(--wh)' },
  { title: 'Find the text', tag: 'What the rules say', color: 'var(--search)' },
  { title: 'Assemble', tag: 'One context, all cited', color: 'var(--query)' },
  { title: 'Answer', tag: 'Written from the context', color: 'var(--query)' },
  { title: 'Check', tag: 'Verified before it leaves', color: 'var(--query)' },
  { title: 'Watch and improve', tag: 'Time, cost, quality', color: 'var(--onto)' },
];

export const LAST = STAGES.length;

/** The question every stage page follows. */
export const QUESTION = 'Was Sunset Tickets over Visa’s VAMP threshold in August, and what drove it?';
