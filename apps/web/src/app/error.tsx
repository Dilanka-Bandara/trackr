'use client';
import { ErrorState } from '@/components/states';
export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <main className="page-content">
      <ErrorState error={error} retry={reset} />
    </main>
  );
}
