import { hashFor } from '../kit/route';

/** The hash for a view of the retrieval walkthrough: 'map', or a stage such as 's4'. */
export const link = (view: string) => hashFor('retrieval', view);
