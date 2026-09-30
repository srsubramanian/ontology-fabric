import { motion } from 'motion/react';
import { CodeBlock } from '../../kit/CodeBlock';
import { play } from '../../kit/motion';
import { ReplayButton } from '../../kit/ReplayButton';
import { useReplay, useTimeline } from '../../kit/useTimeline';
import { QUESTION } from '../data';
import { Stage } from '../Stage';

const GATES = [
  ['Token checked', 'AgentCore Gateway: the caller is risk-agent'],
  ['Policy allows the tool', 'AgentCore Policy: default deny, this call is permitted'],
  ['Access mapped per store', 'A filter for OpenSearch, a role for Snowflake'],
  ['Version pinned', 'Every stage reads ontology 1.6.0'],
];

/** What the request carries, and after which gate each stamp appears (0: from the start). */
const STAMPS: [string, string, number][] = [
  ['tool', 'answer_question', 0],
  ['caller', 'risk-agent', 0],
  ['on behalf of', 'merchant risk analyst', 1],
  ['search filter', 'classification: internal', 3],
  ['Snowflake role', 'RISK_ANALYST_RO', 3],
  ['trace', '9b41-2e07', 3],
  ['ontology', '1.6.0', 4],
];

const WIRE = `POST /mcp HTTP/1.1
MCP-Protocol-Version: 2026-07-28
Mcp-Method: tools/call
Mcp-Name: answer_question
Authorization: Bearer <token>

{ "jsonrpc": "2.0", "id": 31, "method": "tools/call",
  "params": { "name": "answer_question",
    "arguments": { "question": "${QUESTION}" },
    "_meta": { "io.modelcontextprotocol/clientInfo":
               { "name": "risk-agent", "version": "2.0" } } } }`;

function Gates() {
  const passed = useTimeline([500, 500, 500, 500]);
  return (
    <div className="arrive">
      <div className="gates">
        {GATES.map(([title, detail], i) => {
          const ok = passed > i;
          return (
            <motion.div key={title} className={'gate' + (ok ? ' ok' : '')} {...play(ok, false, { x: [-6, 0] }, { duration: 0.3 })}>
              <i>{ok ? '✓' : i + 1}</i><div><b>{title}</b><span>{detail}</span></div>
            </motion.div>
          );
        })}
      </div>
      <div className="env"><h4>The request, as it travels</h4>
        {STAMPS.map(([label, value, at]) => {
          const order = STAMPS.filter((s) => s[2] === at).findIndex((s) => s[0] === label);
          const stamp = <><span>{label}</span><code>{value}</code></>;
          return at === 0
            ? <div key={label} className="stamp">{stamp}</div>
            : <motion.div key={label} className="stamp" {...play(passed >= at, { opacity: 0 }, { opacity: [0, 1], x: [10, 0] }, { duration: 0.35, delay: order * 0.12 })}>{stamp}</motion.div>;
        })}
      </div>
    </div>
  );
}

export function S1Arrive() {
  const [run, replay] = useReplay();
  return (
    <Stage n={1}
      idea="Every question arrives as a tool call and is checked before anything is searched. The caller’s identity is also mapped to what each store will let them see."
      keys={['The gateway checks who is asking and whether they may call this tool', 'Clearance becomes an OpenSearch filter and a read-only Snowflake role', 'One ontology version is pinned for the whole answer']}>
      <Gates key={run} />
      <ReplayButton label="Send it again" onClick={replay} />
      <p className="vcap" style={{ marginTop: 14 }}>On the wire, under the 2026-07-28 MCP spec</p>
      <CodeBlock code={WIRE} lang="mcphttp" />
    </Stage>
  );
}
