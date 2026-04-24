'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { RegisterInput } from '../schemas';
import { registerAction } from '../actions';

export function RegisterForm() {
  const router = useRouter();
  const [topError, setTopError] = useState<string | null>(null);
  const form = useForm<RegisterInput>({
    resolver: zodResolver(RegisterInput),
    defaultValues: { email: '', password: '' },
    mode: 'onBlur',
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setTopError(null);
    // Send the credentials as FormData so the password never travels as
    // part of a plain JS object that Next.js might serialise into its
    // dev-server log / error trace on the server action boundary.
    const fd = new FormData();
    fd.set('email', values.email);
    fd.set('password', values.password);
    const result = await registerAction(fd);
    if (!result.ok) {
      if (result.error.fieldErrors) {
        for (const [field, msgs] of Object.entries(result.error.fieldErrors)) {
          if (msgs?.[0]) form.setError(field as keyof RegisterInput, { message: msgs[0] });
        }
      } else {
        setTopError(result.error.message);
      }
      return;
    }
    router.push('/transactions');
    router.refresh();
  });

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" aria-busy={form.formState.isSubmitting}>
      <h1 className="text-xl font-semibold">Đăng ký</h1>

      <label className="flex flex-col gap-1 text-sm">
        <span>Email</span>
        <input
          type="email"
          autoComplete="email"
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          {...form.register('email')}
          aria-invalid={!!form.formState.errors.email}
        />
        {form.formState.errors.email && (
          <span className="text-xs text-red-600">{form.formState.errors.email.message}</span>
        )}
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span>Mật khẩu</span>
        <input
          type="password"
          autoComplete="new-password"
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          {...form.register('password')}
          aria-invalid={!!form.formState.errors.password}
        />
        {form.formState.errors.password && (
          <span className="text-xs text-red-600">{form.formState.errors.password.message}</span>
        )}
        <span className="text-xs text-zinc-500">
          Tối thiểu 8 ký tự, gồm cả chữ và số.
        </span>
      </label>

      {topError && <p className="text-sm text-red-600">{topError}</p>}

      <button
        type="submit"
        disabled={form.formState.isSubmitting}
        className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {form.formState.isSubmitting ? 'Đang xử lý…' : 'Tạo tài khoản'}
      </button>

      <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
        Đã có tài khoản?{' '}
        <Link href="/login" className="underline">
          Đăng nhập
        </Link>
      </p>
    </form>
  );
}
