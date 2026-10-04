// The dispute workbench: one chargeback case, for the disputes team. Made up for Ontology Fabric's lineage example:
// every name, field and line here is illustrative.
import { useParams } from 'react-router-dom';
import { Cell, DaysLeft, Field, ReasonChip, Section, Spinner, StageBadge, TxnLink } from '../../components';
import { formatDate, formatInZone, formatMoney } from '../../format';
import { useAnalystPrefs } from '../../prefs';
import { useDisputeCase } from './useDisputeCase';

export function DisputeWorkbench() {
  const { caseId } = useParams();
  const user = useAnalystPrefs();
  const { data: c, loading } = useDisputeCase(caseId!);
  if (loading || !c) return <Spinner />;

  return (
    <Section title="Chargeback">
      <Field label="Case">
        <Cell>{c.caseId}</Cell>
      </Field>
      <Field label="Original transaction">
        <TxnLink id={c.originalTxn} />
      </Field>
      <Field label="Reason">
        <ReasonChip code={c.reason} />
      </Field>
      <Field label="Disputed amount">
        <Cell>{formatMoney(c.amount, c.currency)}</Cell>
      </Field>
      <Field label="Opened">
        <Cell>{formatInZone(c.openedAt, user.timeZone)}</Cell>
      </Field>
      <Field label="Respond by">
        <DaysLeft until={c.respondBy} />
      </Field>
      <Field label="Stage">
        <StageBadge stage={c.stage} />
      </Field>
      <Field label="Merchant">
        <Cell>{c.merchantName}</Cell>
      </Field>
      <Field label="Settled on">
        <Cell>{formatDate(c.settledOn)}</Cell>
      </Field>
    </Section>
  );
}
