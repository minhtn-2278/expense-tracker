import { z } from 'zod';

/**
 * Source of truth for auth form shapes. Consumed by:
 *   - features/auth/components/RegisterForm.tsx  (RHF + zodResolver)
 *   - features/auth/components/LoginForm.tsx
 *   - features/auth/actions.ts                   (Server Action validation)
 *
 * Normalisation (trim + lowercase) is intentionally inside the schema so
 * the action layer never sees un-normalised data.
 */

export const RegisterInput = z.object({
  email: z.string().trim().toLowerCase().email({ message: 'Email không hợp lệ.' }),
  password: z
    .string()
    .min(8, { message: 'Mật khẩu phải có ít nhất 8 ký tự.' })
    .regex(/[A-Za-z]/, { message: 'Mật khẩu phải có ít nhất 1 chữ cái.' })
    .regex(/\d/, { message: 'Mật khẩu phải có ít nhất 1 chữ số.' }),
});
export type RegisterInput = z.infer<typeof RegisterInput>;

export const LoginInput = z.object({
  email: z.string().trim().toLowerCase().email({ message: 'Email không hợp lệ.' }),
  password: z.string().min(1, { message: 'Vui lòng nhập mật khẩu.' }),
});
export type LoginInput = z.infer<typeof LoginInput>;
