import { describe, it, expect } from 'vitest';
import { RegisterInput, LoginInput } from '@/features/auth/schemas';

describe('RegisterInput', () => {
  it('accepts a valid email and strong password', () => {
    const result = RegisterInput.safeParse({
      email: 'Alice@Example.com',
      password: 'secret1234',
    });
    expect(result.success).toBe(true);
    expect(result.success && result.data.email).toBe('alice@example.com');
  });

  it('rejects an invalid email', () => {
    const result = RegisterInput.safeParse({ email: 'nope', password: 'secret1234' });
    expect(result.success).toBe(false);
  });

  it('rejects a short password', () => {
    const result = RegisterInput.safeParse({ email: 'a@b.com', password: 'short1' });
    expect(result.success).toBe(false);
  });

  it('rejects a password without a digit', () => {
    const result = RegisterInput.safeParse({ email: 'a@b.com', password: 'onlyletters' });
    expect(result.success).toBe(false);
  });

  it('rejects a password without a letter', () => {
    const result = RegisterInput.safeParse({ email: 'a@b.com', password: '12345678' });
    expect(result.success).toBe(false);
  });
});

describe('LoginInput', () => {
  it('accepts a valid email and any non-empty password', () => {
    const result = LoginInput.safeParse({ email: 'a@b.com', password: 'x' });
    expect(result.success).toBe(true);
  });

  it('rejects an empty password', () => {
    const result = LoginInput.safeParse({ email: 'a@b.com', password: '' });
    expect(result.success).toBe(false);
  });
});
