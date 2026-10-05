import { z } from 'zod';
import { centsSchema, dateSchema } from './domain.ts';
import { shiftMonths } from './financial-engine.ts';

export const extractionSchema = z.object({
  intent: z.enum(['record', 'question', 'unsupported']),
  clarification: z.string().max(500).nullable(),
  transactions: z
    .array(
      z.object({
        description: z.string().min(2).max(180),
        amount: centsSchema.positive().nullable(),
        type: z.enum(['income', 'expense']),
        category: z.string().min(1).max(60),
        date: dateSchema,
        status: z.enum(['paid', 'planned']),
        confidence: z.number().min(0).max(1),
        installments: z.number().int().min(1).max(20),
      }),
    )
    .max(20),
});
export type Extraction = z.infer<typeof extractionSchema>;
export const extractionJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['intent', 'clarification', 'transactions'],
  properties: {
    intent: { type: 'string', enum: ['record', 'question', 'unsupported'] },
    clarification: { type: ['string', 'null'] },
    transactions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'description',
          'amount',
          'type',
          'category',
          'date',
          'status',
          'confidence',
          'installments',
        ],
        properties: {
          description: { type: 'string' },
          amount: { type: ['integer', 'null'] },
          type: { type: 'string', enum: ['income', 'expense'] },
          category: { type: 'string' },
          date: { type: 'string' },
          status: { type: 'string', enum: ['paid', 'planned'] },
          confidence: { type: 'number' },
          installments: { type: 'integer' },
        },
      },
    },
  },
};
export function extractionDecision(raw: unknown) {
  const parsed = extractionSchema.parse(raw);
  if (parsed.intent !== 'record' || parsed.transactions.length === 0)
    return { parsed, action: 'clarify' as const, transactions: [] };
  if (parsed.transactions.some((t) => t.amount === null))
    return { parsed, action: 'clarify' as const, transactions: [] };
  const totalCount = parsed.transactions.reduce((n, t) => n + t.installments, 0);
  if (totalCount > 20) throw new Error('Máximo de vinte lançamentos por mensagem.');
  const transactions = parsed.transactions.flatMap((t) =>
    Array.from({ length: t.installments }, (_, i) => ({
      description:
        t.installments > 1 ? `${t.description.slice(0, 150)} (${i + 1}/${t.installments})` : t.description,
      amount: t.amount!,
      type: t.type,
      category: t.category,
      date: shiftMonths(t.date, i),
      status: i === 0 ? t.status : ('planned' as const),
    })),
  );
  const minConfidence = Math.min(...parsed.transactions.map((t) => t.confidence));
  return {
    parsed,
    action:
      minConfidence < 0.7
        ? ('confirm' as const)
        : minConfidence < 0.9
          ? ('save-correctable' as const)
          : ('save' as const),
    transactions,
  };
}
