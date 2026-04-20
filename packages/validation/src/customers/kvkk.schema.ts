import { z } from 'zod';

/**
 * KVKK consent (FSD 12.5.3). Consent types are tracked as a small set of
 * well-known string codes so we can evolve without a schema change.
 */
export const KvkkConsentTypeEnum = z.enum([
  'marketing_email',
  'marketing_sms',
  'profiling',
  'cookies_functional',
  'cookies_analytics',
  'cookies_marketing',
  'terms_of_service',
  'privacy_policy',
]);
export type KvkkConsentType = z.infer<typeof KvkkConsentTypeEnum>;

export const KvkkConsentSchema = z.object({
  consents: z
    .array(
      z.object({
        type: KvkkConsentTypeEnum,
        version: z.string().trim().min(1).max(40),
        granted: z.boolean(),
      }),
    )
    .min(1)
    .max(20),
});
export type KvkkConsentInput = z.infer<typeof KvkkConsentSchema>;
