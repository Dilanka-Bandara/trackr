import { describe, expect, it } from 'vitest';
import { jobSchema, moveSchema, registerSchema, uploadSchema } from './index';
describe('shared input boundaries', () => {
  it('normalizes emails and rejects short passwords', () => {
    expect(
      registerSchema.parse({ name: 'Sam', email: 'SAM@example.com', password: 'Password123!' })
        .email,
    ).toBe('sam@example.com');
    expect(registerSchema.safeParse({ name: 'Sam', email: 'bad', password: 'x' }).success).toBe(
      false,
    );
  });
  it('rejects executable URLs and out-of-range positions', () => {
    expect(
      jobSchema.safeParse({ company: 'A', title: 'B', url: 'javascript:alert(1)' }).success,
    ).toBe(false);
    expect(moveSchema.safeParse({ status: 'APPLIED', position: -1 }).success).toBe(false);
  });
  it('enforces PDF upload size', () => {
    expect(
      uploadSchema.safeParse({ fileName: 'cv.pdf', contentType: 'application/pdf', size: 6000000 })
        .success,
    ).toBe(false);
  });
});
