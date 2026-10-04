// The transaction research screen: one transaction's whole life, for an analyst. Made up for Ontology Fabric's
// lineage example: every name, field and line here is illustrative.
import { useParams } from 'react-router-dom';
import { Cell, Field, RiskBadge, Section, Spinner, StatusBadge } from '../../components';
import { formatCard, formatDate, formatInZone, formatMoney, mccLabel } from '../../format';
import { useAnalystPrefs } from '../../prefs';
import { useTransactionLifecycle } from './useTransactionLifecycle';

export function TransactionLifecycle() {
  const { transactionId } = useParams();
  const user = useAnalystPrefs();
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
        <Field label="Auth code">
          <Cell>{txn.authCode}</Cell>
        </Field>
        <Field label="Card">
          <Cell>{formatCard(txn.maskedPan)}</Cell>
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
      </Section>
      <Section title="Risk">
        <Field label="Risk tier">
          <RiskBadge tier={txn.riskTier} />
        </Field>
      </Section>
    </>
  );
}
