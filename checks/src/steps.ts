import { z } from 'zod';

export const reasonSchema = z.enum(['unsupported', 'no-preparation-path', 'ambiguous-assertion']);
export const categorySchema = z.enum(['create', 'delete', 'edit', 'state-toggle', 'search-filter-sort', 'navigation', 'read-list']);
export const matchSchema = z.union([z.string().min(1), z.strictObject({ regex: z.string().min(1), flags: z.enum(['', 'i']).default('i') })]);
export type Match = z.infer<typeof matchSchema>;
export type Target = { name?: Match[]; via?: 'ladder' | 'text' | 'role' | 'field'; role?: string; exact?: boolean; within?: Target };
export const targetSchema: z.ZodType<Target> = z.lazy(() => z.strictObject({
  name: z.array(matchSchema).min(1).optional(), via: z.enum(['ladder','text','role','field']).optional(),
  role: z.string().optional(), exact: z.boolean().optional(), within: targetSchema.optional(),
}).refine(t => t.name?.length || (t.via === 'role' && t.role), 'Target needs a name or explicit role'));
export const valueSchema = z.union([z.string(), z.strictObject({ variable: z.string().min(1) })]);
export type Value = z.infer<typeof valueSchema>;
const target = { target: targetSchema };
const simpleSchema = z.discriminatedUnion('op', [
  z.strictObject({ op: z.literal('open') }),
  z.strictObject({ op: z.literal('click'), ...target }),
  z.strictObject({ op: z.literal('hover'), ...target }),
  z.strictObject({ op: z.literal('fill'), ...target, value: valueSchema }),
  z.strictObject({ op: z.literal('check'), ...target, checked: z.boolean(), clickFallback: z.boolean().optional() }),
  z.strictObject({ op: z.literal('press'), target: targetSchema.optional(), key: z.string() }),
  z.strictObject({ op: z.literal('selectOption'), ...target, label: z.string() }),
  z.strictObject({ op: z.literal('expectText'), ...target }),
  z.strictObject({ op: z.literal('expectAbsent'), ...target }),
  z.strictObject({ op: z.literal('expectCount'), ...target, count: z.number().int().min(0) }),
  z.strictObject({ op: z.literal('expectState'), ...target, state: z.enum(['visible','hidden','checked','disabled','enabled','editable']), value: z.boolean().default(true) }),
  z.strictObject({ op: z.literal('expectField'), ...target, value: z.union([valueSchema, matchSchema]) }),
  z.strictObject({ op: z.literal('expectFeedback'), kind: z.enum(['error','success']), target: targetSchema.optional() }),
  z.strictObject({ op: z.literal('bind'), variable: z.string(), value: z.string(), source: z.string().min(1) }),
  z.strictObject({ op: z.literal('capture'), ...target, variable: z.string(), kind: z.enum(['text','value','count','screenshot']), padding: z.number().min(0).max(50).optional() }),
  z.strictObject({ op: z.literal('compare'), left: z.string(), right: z.string(), relation: z.enum(['equal','notEqual']) }),
  z.strictObject({ op: z.literal('unknown'), reason: reasonSchema, detail: z.string().min(1) }),
]);
export type Step = z.infer<typeof simpleSchema> |
 { op: 'if'; target: Target; state: 'visible'|'exists'; then: Step[]; else: Step[] } |
 { op: 'try'; steps: Step[]; fallback: Step[] };
export const stepSchema: z.ZodType<Step> = z.lazy(() => z.union([simpleSchema,
 z.strictObject({ op: z.literal('if'), ...target, state: z.enum(['visible','exists']), then: z.array(stepSchema), else: z.array(stepSchema) }),
 z.strictObject({ op: z.literal('try'), steps: z.array(stepSchema), fallback: z.array(stepSchema) }),
]));
export const checkSchema = z.strictObject({
  scenario: z.string().min(1), requirement: z.string().min(1), title: z.string().min(1),
  category: categorySchema, rationale: z.string().min(1),
  given: z.array(stepSchema), when: z.array(stepSchema), then: z.array(stepSchema).min(1),
});
export type Check = z.infer<typeof checkSchema>;
export const checksSchema = z.array(checkSchema);
export const resolverSchema = z.strictObject({
 pattern: z.string().nullable(), rungHit: z.string().nullable(), candidates: z.array(z.string()).max(40),
 hidden: z.array(z.string()).max(40), scope: z.string(),
});
export const resultSchema = z.strictObject({
 scenario: z.string(), requirement: z.string(), status: z.enum(['pass','fail','unknown']),
 failedStep: z.object({ phase: z.string(), index: z.string(), step: stepSchema }).nullable(),
 resolver: resolverSchema, error: z.string().nullable(),
});
export type Result = z.infer<typeof resultSchema>;
export const emptyResolver = (): Result['resolver'] => ({ pattern: null, rungHit: null, candidates: [], hidden: [], scope: 'page' });
export function flatten(steps: Step[]): Step[] {
 return steps.flatMap(s => [s, ...(s.op === 'if' ? flatten([...s.then,...s.else]) : s.op === 'try' ? flatten([...s.steps,...s.fallback]) : [])]);
}
