import {z} from 'zod'
import {AI_DEFAULT_LOCALE, AI_LOCALES, type AiLocale} from '~/config/ai'
import {personaStatusPgEnum} from '../../db/schema/personas'

export const personaInputSchema = z
  .object({
    name: z.string().min(1).max(100),
    gender: z.string().min(1).max(50),
    age: z.coerce.number().int().min(1).max(120),
    locale: z
      .enum(Object.keys(AI_LOCALES) as AiLocale[])
      .default(AI_DEFAULT_LOCALE),
    region: z.string().min(1).max(50),
    incomeBracket: z.string().min(1).max(100),
    occupation: z.string().min(1).max(100),
    backgroundTags: z.array(z.string().min(1).max(100)).max(20),
    personalitySliders: z.object({
      calm_anxious: z.coerce.number().int().min(0).max(100),
      optimistic_cynical: z.coerce.number().int().min(0).max(100),
      frugal_spendthrift: z.coerce.number().int().min(0).max(100),
    }),
    interviewStance: z.string().min(1).max(200),
    quirksFreetext: z.string().min(1).max(2000),
    generatedBio: z.string().max(65535).optional(),
    systemPrompt: z.string().max(65535).optional(),
    status: z.enum(personaStatusPgEnum.enumValues).default('draft'),
  })
  .superRefine((data, ctx) => {
    const locales = AI_LOCALES[data.locale]
    if (locales) {
      if (!(locales.regions as unknown as string[]).includes(data.region)) {
        ctx.addIssue({
          code: 'custom',
          message: `Region must be one of: ${locales.regions.join(', ')}`,
          path: ['region'],
        })
      }
    }
  })

export type PersonaInput = z.infer<typeof personaInputSchema>
