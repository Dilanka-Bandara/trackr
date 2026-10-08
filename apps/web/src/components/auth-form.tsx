'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { registerSchema, z } from '@trackr/shared';
import { useState } from 'react';
import { ArrowRight, Check, LoaderCircle, Sparkles } from 'lucide-react';
import { api, API_URL, json } from '@/lib/api';
import { Logo } from './app-shell';
import { Button } from './ui/button';
export function AuthForm({ register = false }: { register?: boolean }) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [demoPending, setDemoPending] = useState(false);
  const form = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: register ? '' : 'Sign in', email: '', password: '' },
  });
  async function submit(data: z.infer<typeof registerSchema>) {
    setError('');
    try {
      await api(
        register ? '/auth/register' : '/auth/login',
        json('POST', register ? data : { email: data.email, password: data.password }),
      );
      router.push('/app');
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function demo() {
    setDemoPending(true);
    await submit({ name: 'Demo', email: 'demo@trackr.dev', password: 'Demo1234!' });
    setDemoPending(false);
  }
  return (
    <div className="auth-page">
      <section className="auth-story">
        <Logo />
        <div>
          <span className="eyebrow">
            <Sparkles size={14} /> YOUR NEXT CHAPTER
          </span>
          <h1>
            Big ambitions.
            <br />A clearer path.
          </h1>
          <p>
            A thoughtful home for your job search.
            <br />
            Less scattered. More you.
          </p>
          <div className="auth-checks">
            {[
              'Every opportunity, organized',
              'AI insights that give you an edge',
              'Small steps toward something great',
            ].map((t) => (
              <span key={t}>
                <Check size={16} />
                {t}
              </span>
            ))}
          </div>
        </div>
        <small>Built for your momentum.</small>
        <div className="auth-decoration" />
      </section>
      <section className="auth-form-section">
        <Link href="/" className="auth-back">
          ← Back to Trackr
        </Link>
        <div className="auth-form-wrap">
          <span className="auth-badge">
            <Sparkles size={22} />
          </span>
          <h2>{register ? 'A fresh start starts here.' : 'Welcome back.'}</h2>
          <p>
            {register
              ? 'Create your account and make your next move.'
              : 'Your next opportunity is waiting. Let’s get to it.'}
          </p>
          <Button variant="outline" className="full-width" asChild>
            <a href={`${API_URL}/auth/google`}>
              <span className="google-g">G</span>Continue with Google
            </a>
          </Button>
          <div className="auth-divider">
            <span />
            or continue with email
            <span />
          </div>
          <form onSubmit={form.handleSubmit(submit)}>
            {register && (
              <label>
                Full name
                <input autoComplete="name" placeholder="Alex Morgan" {...form.register('name')} />
                {form.formState.errors.name && (
                  <small className="field-error">{form.formState.errors.name.message}</small>
                )}
              </label>
            )}
            <label>
              Email address
              <input
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                {...form.register('email')}
              />
              {form.formState.errors.email && (
                <small className="field-error">{form.formState.errors.email.message}</small>
              )}
            </label>
            <label>
              Password
              <input
                type="password"
                autoComplete={register ? 'new-password' : 'current-password'}
                placeholder={register ? 'At least 8 characters' : 'Your password'}
                {...form.register('password')}
              />
              {form.formState.errors.password && (
                <small className="field-error">{form.formState.errors.password.message}</small>
              )}
            </label>
            {error && (
              <div role="alert" className="form-error">
                {error}
              </div>
            )}
            <Button className="full-width" disabled={form.formState.isSubmitting || demoPending}>
              {form.formState.isSubmitting ? <LoaderCircle className="spin" size={17} /> : null}
              {register ? 'Create account' : 'Sign in'}
              <ArrowRight size={16} />
            </Button>
          </form>
          <Button
            variant="ghost"
            className="full-width demo-button"
            onClick={demo}
            disabled={demoPending}
          >
            {demoPending ? 'Opening your workspace…' : 'Just looking? Try the demo workspace →'}
          </Button>
          <p className="auth-switch">
            {register ? 'Already have an account?' : 'New here?'}{' '}
            <Link href={register ? '/login' : '/register'}>
              {register ? 'Sign in' : 'Create an account'}
            </Link>
          </p>
        </div>
        <small className="auth-footnote">Your search. Your pace. Your next chapter.</small>
      </section>
    </div>
  );
}
