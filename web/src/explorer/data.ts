import schema from '../../../ontology/payments.yaml';
import questions from '../../../ontology/competency-questions.yaml';
import { buildModel, type RawQuestions, type RawSchema } from './model';

/** The ontology, read from its LinkML source at build time. */
export const model = buildModel(schema as RawSchema, questions as RawQuestions);
