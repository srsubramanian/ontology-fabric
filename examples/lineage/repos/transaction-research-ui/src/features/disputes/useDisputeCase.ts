// Fetches one chargeback case from the backend (made up for Ontology Fabric's lineage example).
import { useQuery } from '../../query';

/** What the backend sends: DisputeCaseDto, as JSON. */
export type DisputeCase = {
  caseId: string;
  originalTxn: string;
  reason: string;
  amount: number;
  currency: string;
  respondBy: string;
  openedAt: string;
  stage: string;
  merchantName: string;
  settledOn: string | null;
};

export function useDisputeCase(caseId: string) {
  return useQuery<DisputeCase>(`/api/disputes/${encodeURIComponent(caseId)}`);
}
