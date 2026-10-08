import Link from 'next/link';
import { Check, Sparkles } from 'lucide-react';
import { Logo } from '@/components/app-shell';
export default function Pricing() {
  return (
    <div className="landing">
      <header className="landing-header">
        <Logo />
        <Link href="/login">Sign in →</Link>
      </header>
      <section className="pricing-section">
        <span className="eyebrow">YOUR AMBITION, YOUR PACE</span>
        <h1>
          A little help.
          <br />
          Room to grow.
        </h1>
        <p>Start free. Upgrade when your search calls for more.</p>
        <div className="pricing-grid">
          {[
            { name: 'Free', credits: '10', headline: 'A clear place to start.', pro: false },
            { name: 'Pro', credits: '200', headline: 'A little extra edge.', pro: true },
          ].map((p) => (
            <article className={`panel price-card ${p.pro ? 'featured' : ''}`} key={p.name}>
              <span className="plan-tag">
                {p.name.toUpperCase()}
                {p.pro && <Sparkles size={14} />}
              </span>
              <h2>{p.headline}</h2>
              <div className="price-value">
                {p.credits}
                <span>AI credits / month</span>
              </div>
              <p>
                {p.pro
                  ? 'Monthly subscription. Price shown in your configured Stripe checkout.'
                  : 'Free, with no credit card required.'}
              </p>
              {[
                'Application tracking & Kanban board',
                'Saved jobs and CV library',
                'Match scores, cover letters & interview prep',
                'Email reminders & notifications',
              ].map((t) => (
                <span className="price-feature" key={t}>
                  <Check size={16} />
                  {t}
                </span>
              ))}
              <Link
                className={`button full-width ${p.pro ? 'button-primary' : 'button-outline'}`}
                href={p.pro ? '/app/settings/billing' : '/register'}
              >
                {p.pro ? 'Explore Pro' : 'Get started free'} →
              </Link>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
