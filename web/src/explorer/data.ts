import schema from '../../../ontology/payments.yaml';
import questions from '../../../ontology/competency-questions.yaml';
import { buildModel, type RawQuestions, type RawSchema } from './model';

/** The ontology's LinkML source and its competency questions, read at build time. */
export const rawSchema = schema as RawSchema;
export const rawQuestions = questions as RawQuestions;

/** The ontology, read from its LinkML source at build time. */
export const model = buildModel(rawSchema, rawQuestions);
