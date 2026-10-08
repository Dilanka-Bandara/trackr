'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, Check, CreditCard, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { api, json } from '@/lib/api';
import { useUser } from '@/hooks/use-trackr';
import { PageHeader } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import { ErrorState, Loading } from '@/components/states';
export default function Billing() {
  const user = useUser();
  const [busy, setBusy] = useState(false);
  const billing = useQuery({
    queryKey: ['billing'],
    queryFn: () =>
      api<{ plan: string; used: number; limit: number; configured: boolean }>('/billing'),
  });
  async function open(path: string) {
    setBusy(true);
    try {
      const result = await api<{ url: string }>(`/billing/${path}`, json('POST'));
      window.location.assign(result.url);
    } catch (e) {
      toast.error((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeader
        eyebrow="A WORKSPACE THAT GROWS WITH YOU"
        title="Settings & billing"
        description="Your account, your plan, your next move."
      />
      <div className="settings-grid">
        <section className="panel settings-panel">
          <h2>Your profile</h2>
          <div className="profile-large">
            <span className="avatar">{user.data?.name[0]}</span>
            <div>
              <h3>{user.data?.name}</h3>
              <p>{user.data?.email}</p>
            </div>
          </div>
          <p className="muted">
            Your workspace is private. Only you can access your applications, CVs, and AI results.
          </p>
        </section>
        {billing.isPending ? (
          <Loading />
        ) : billing.error ? (
          <ErrorState error={billing.error} />
        ) : (
          <section className="panel settings-panel">
            <div className="panel-heading">
              <h2>AI usage</h2>
              <span className="plan-tag">{billing.data.plan} PLAN</span>
            </div>
            <div className="usage-total">
              <strong>{billing.data.used}</strong>
              <span>/ {billing.data.limit} credits this month</span>
            </div>
            <div className="usage-bar">
              <span
                style={{
                  width: `${Math.min(100, (billing.data.used / billing.data.limit) * 100)}%`,
                }}
              />
            </div>
            <p className="muted">
              Resets on the first day of each month (UTC). Match analysis, cover letters, and
              interview preparation each use one credit.
            </p>
          </section>
        )}
      </div>
      <section className="pro-panel">
        <div className="pro-copy">
          <span className="eyebrow">
            <Sparkles size={15} /> TRACKR PRO
          </span>
          <h2>
            Your ambition.
            <br />A little more room.
          </h2>
          <p>Go deeper on the roles you care about with 200 AI credits every month.</p>
          <div className="pro-checks">
            {[
              'Everything in your free workspace',
              '200 AI tasks per month',
              'Personalized match insights',
              'Tailored cover letters & interview prep',
            ].map((t) => (
              <span key={t}>
                <Check size={16} />
                {t}
              </span>
            ))}
          </div>
        </div>
        <div className="pro-action">
          <Sparkles size={40} />
          <h3>{billing.data?.plan === 'PRO' ? 'You’re on Pro.' : 'Make your next move.'}</h3>
          <p>
            {billing.data?.configured
              ? 'Your configured monthly price is shown securely in Stripe Checkout.'
              : 'Billing is not configured yet. Add your Stripe test keys and recurring Price ID in the environment.'}
          </p>
          <Button
            disabled={busy || !billing.data?.configured}
            onClick={() => void open(billing.data?.plan === 'PRO' ? 'portal' : 'checkout')}
          >
            {billing.data?.plan === 'PRO' ? <CreditCard size={16} /> : <Sparkles size={16} />}
            {billing.data?.plan === 'PRO' ? 'Manage subscription' : 'Explore Pro checkout'}
            <ArrowUpRight size={16} />
          </Button>
          {billing.data?.configured && billing.data.plan !== 'PRO' && (
            <Button variant="ghost" size="sm" onClick={() => void open('portal')}>
              Open billing portal
            </Button>
          )}
          <small>Secure payments, powered by Stripe.</small>
        </div>
      </section>
    </>
  );
}
