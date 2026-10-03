// The transaction research screen: one transaction's whole life, for an analyst. Made up for Ontology Fabric's
// lineage example: every name, field and line here is illustrative.
import { useParams } from 'react-router-dom';
import { Cell, DaysLeft, Field, RiskBadge, Section, Spinner, StatusBadge } from '../../components';
import { useAuditLog } from '../../audit';
import { formatCard, formatDate, formatInZone, formatMoney, mccLabel } from '../../format';
import { useAnalystPrefs } from '../../prefs';
import { useTransactionLifecycle } from './useTransactionLifecycle';

export function TransactionLifecycle() {
  const { transactionId } = useParams();
  const user = useAnalystPrefs();
  useAuditLog('transaction-research', transactionId);
  const { data: txn, loading } = useTransactionLifecycle(transactionId!);
  if (loading || !txn) return <Spinner />;

  return (
    <>
      <Section title="Authorization">
        <Field label="Transaction ID">
          <Cell>{txn.txnId}</Cell>
        </Field>
        <Field label="Status">
          <StatusBadge status={txn.status} />
        </Field>
        <Field label="Authorized">
          <Cell>{formatInZone(txn.authTime, user.timeZone)}</Cell>
        </Field>
        <Field label="Authorized amount">
          <Cell>{formatMoney(txn.authAmt, txn.currency)}</Cell>
        </Field>
        <Field label="Currency">
          <Cell>{txn.currency}</Cell>
        </Field>
        <Field label="Response">
          <Cell>{txn.responseText}</Cell>
        </Field>
        <Field label="Card">
          <Cell>{formatCard(txn.maskedPan)}</Cell>
        </Field>
        <Field label="Network">
          <Cell>{txn.cardNetwork}</Cell>
        </Field>
        <Field label="Merchant">
          <Cell>{txn.merchantName}</Cell>
        </Field>
        <Field label="Category">
          <Cell>{mccLabel(txn.mcc)}</Cell>
        </Field>
        <Field label="Device">
          <Cell>{txn.deviceId}</Cell>
        </Field>
      </Section>
      <Section title="Money">
        <Field label="Captured amount">
          <Cell>{formatMoney(txn.capturedAmt, txn.currency)}</Cell>
        </Field>
        <Field label="Settled on">
          <Cell>{formatDate(txn.settledDate)}</Cell>
        </Field>
        <Field label="Refunded amount">
          <Cell>{formatMoney(txn.refundedAmt, txn.currency)}</Cell>
        </Field>
      </Section>
      <Section title="Dispute">
        <Field label="Chargeback reason">
          <Cell>{txn.cbReason}</Cell>
        </Field>
        <Field label="Respond by">
          <DaysLeft until={txn.respondBy} />
        </Field>
      </Section>
      <Section title="Risk">
        <Field label="Risk tier">
          <RiskBadge tier={txn.riskTier} />
        </Field>
      </Section>
    </>
  );
}
