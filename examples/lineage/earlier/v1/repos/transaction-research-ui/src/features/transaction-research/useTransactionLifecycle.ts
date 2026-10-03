// Fetches one transaction's whole life from the backend (made up for Ontology Fabric's lineage example).
import { useQuery } from '../../query';

/** What the backend sends: TransactionLifecycleDto, as JSON. */
export type TransactionLifecycle = {
  txnId: string;
  status: 'authorized' | 'captured' | 'settled';
  authTime: string;
  authAmt: number;
  currency: string;
  responseText: string;
  authCode: string;
  maskedPan: string;
  merchantName: string;
  mcc: string;
  riskTier: string | null;
  deviceId: string | null;
  capturedAmt: number;
  settledDate: string | null;
};

export function useTransactionLifecycle(transactionId: string) {
  return useQuery<TransactionLifecycle>(`/api/transactions/${encodeURIComponent(transactionId)}/lifecycle`);
}
