import { motion } from 'motion/react';
import { vars } from '../../kit/css';
import { EASE_OUT, play, tr } from '../../kit/motion';
import { ReplayButton } from '../../kit/ReplayButton';
import { useReplay, useTimeline } from '../../kit/useTimeline';
import { Stage } from '../Stage';

/** Candidates from the entities index, best first. Scores are illustrative. */
const CANDIDATES = [
  { id: 'm:10442', name: 'Sunset Tickets', kind: 'online ticketing', score: 0.91 },
  { id: 'm:10987', name: 'Sunset Tix Resale', kind: 'online resale', score: 0.68 },
  { id: 'm:22110', name: 'Sunset Travel Tours', kind: 'travel agency', score: 0.52 },
];

/** Where the one ID opens each store. */
const OPENS = [
  { color: 'var(--graph)', store: 'Neptune node', key: 'm:10442' },
  { color: 'var(--wh)', store: 'Snowflake', key: 'merchant_id = 10442' },
  { color: 'var(--search)', store: 'OpenSearch document', key: '_id: m:10442' },
];

function Resolve() {
  const step = useTimeline([1200, 600]);
  const picked = step >= 1, opened = step >= 2;
  return (
    <>
      <div className="cand">
        {CANDIDATES.map((c, i) => (
          <motion.div key={c.id} className={'crow' + (picked ? (i === 0 ? ' pick' : ' out') : '')}
            {...play(picked && i === 0, false, { scale: [1, 1.02, 1] }, { duration: 0.45 })}>
            <div><code>{c.id}</code> {c.name}<small>{c.kind}</small></div>
            <div className="track">
              <motion.i initial={{ width: '0%' }} animate={{ width: c.score * 100 + '%' }}
                transition={tr({ duration: 0.6, delay: 0.15 + i * 0.12, ease: EASE_OUT })} />
              <span className="thr"></span>
            </div>
            <span className="sc">{c.score.toFixed(2)}</span>
          </motion.div>
        ))}
      </div>
      <p className="note">A clear winner by a wide margin, so there’s no need to ask which one. “VAMP” resolves separately, through the ontology index, to the metric <code>pay:VampRatio</code>.</p>
      <div className="idmap">
        <motion.div className="core" {...play(opened, { opacity: 0 }, { opacity: [0, 1], scale: [0.85, 1] }, { duration: 0.35 })}>
          m:10442<small>ID rule: m:{'{merchant_id}'}</small>
        </motion.div>
        <div className="arrow">opens</div>
        <div className="outs">
          {OPENS.map((o, i) => (
            <motion.span key={o.store} style={vars({ '--c': o.color })}
              {...play(opened, { opacity: 0 }, { opacity: [0, 1], x: [-10, 0] }, { duration: 0.35, delay: 0.4 + i * 0.2 })}>
              {o.store} <code>{o.key}</code>
            </motion.span>
          ))}
        </div>
      </div>
    </>
  );
}

export function S3EntryPoints() {
  const [run, replay] = useReplay();
  return (
    <Stage n={3}
      idea="Every thing the question names becomes one ID, and that one ID opens all three stores."
      keys={['Names go through hybrid search, with fuzzy matching and the ontology’s aliases', 'Business terms, like VAMP, resolve to ontology concepts', 'One ID rule, set in the ontology, links Neptune, Snowflake and OpenSearch']}>
      <p className="vcap">Resolving “Sunset Tickets” in the entities index</p>
      <Resolve key={run} />
      <ReplayButton label="Resolve again" onClick={replay} />
    </Stage>
  );
}
