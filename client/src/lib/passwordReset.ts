import { z } from 'zod';

/** Same rule as sign-up (RegisterPage): at least 8 characters, typed twice. */
export const newPasswordSchema = z
  .object({
    password: z.string().min(8, { message: 'Password must be at least 8 characters' }),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'The two passwords do not match',
    path: ['confirmPassword'],
  });

export type NewPasswordValues = z.infer<typeof newPasswordSchema>;

/**
 * Supabase puts a failed or expired email link's reason in the query or the hash
 * (`error_description=Email+link+is+invalid+or+has+expired`). Null when the link is fine.
 */
export function readAuthLinkError(search: string, hash: string): string | null {
  for (const part of [search, hash]) {
    const params = new URLSearchParams(part.replace(/^[?#]/, ''));
    const reason = params.get('error_description') ?? params.get('error');
    if (reason) return reason.replace(/\+/g, ' ');
  }
  return null;
}
