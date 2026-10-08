import Link from 'next/link';
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCheck,
  FileText,
  LayoutGrid,
  Sparkles,
  Target,
} from 'lucide-react';
import { Logo } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
export default function Landing() {
  return (
    <div className="landing">
      <header className="landing-header">
        <Logo />
        <nav>
          <a href="#features">Why Trackr</a>
          <Link href="/pricing">Plans</Link>
          <Link href="/login">Sign in</Link>
          <Button asChild size="sm">
            <Link href="/register">
              Get started <ArrowUpRight size={14} />
            </Link>
          </Button>
        </nav>
      </header>
      <main>
        <section className="landing-hero">
          <div className="hero-eyebrow">
            <span />A LITTLE CLARITY. A LOT OF POSSIBILITY.
          </div>
          <h1>
            Your next chapter.
            <br />
            <span>Thoughtfully organized.</span>
          </h1>
          <p>
            The job search can feel like a lot. Bring your applications,
            <br className="desktop-break" /> your experience, and your next move together in one
            calm space.
          </p>
          <div className="hero-buttons">
            <Button asChild>
              <Link href="/register">
                Start your next chapter <ArrowRight size={17} />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/login">
                Explore the demo <ArrowUpRight size={17} />
              </Link>
            </Button>
          </div>
          <div className="hero-note">
            <Check size={13} />
            Free to get started<span>·</span>No credit card required
          </div>
          <div className="product-preview" aria-label="Illustrative application board preview">
            <div className="preview-topbar">
              <span className="preview-dots">
                <i />
                <i />
                <i />
              </span>
              <span>YOUR NEXT CHAPTER, IN MOTION</span>
              <Sparkles size={16} />
            </div>
            <div className="preview-content">
              <aside>
                <span className="preview-nav active">
                  <LayoutGrid size={16} />
                  Application board
                </span>
                <span className="preview-nav">
                  <FileText size={16} />
                  My CVs
                </span>
                <span className="preview-label">
                  A workspace for
                  <br />
                  <strong>what comes next.</strong>
                </span>
              </aside>
              <div className="preview-board">
                {[
                  {
                    title: 'Wishlist',
                    role: 'Product Designer',
                    company: 'A company you love',
                    badge: 'Worth a closer look',
                    color: 'wishlist',
                  },
                  {
                    title: 'Interview',
                    role: 'Frontend Engineer',
                    company: 'A team that gets you',
                    badge: 'You’ve got this',
                    color: 'interview',
                  },
                  {
                    title: 'Offer',
                    role: 'Your next chapter',
                    company: 'Something great',
                    badge: 'All that effort, worth it',
                    color: 'offer',
                  },
                ].map((c, i) => (
                  <div key={c.title}>
                    <div className="preview-column-title">
                      <i className={`status-dot ${c.color}`} />
                      {c.title}
                      <span>1</span>
                    </div>
                    <div className="preview-card">
                      <span className={`company-logo logo-color-${i}`}>
                        {i === 2 ? <CheckCheck size={22} /> : i === 0 ? 'a' : '↗'}
                      </span>
                      <h3>{c.role}</h3>
                      <p>{c.company}</p>
                      <small className={c.color}>{c.badge}</small>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
        <section className="landing-features" id="features">
          <div className="eyebrow">LESS SCATTERED. MORE FOCUSED.</div>
          <h2>
            A little structure.
            <br />A whole lot of momentum.
          </h2>
          <div className="feature-grid">
            {[
              {
                icon: LayoutGrid,
                title: 'Keep the big picture.',
                description:
                  'Save opportunities and move applications through a board that makes your next step clear.',
              },
              {
                icon: Target,
                title: 'Know where you shine.',
                description:
                  'Compare your CV with a role. Discover your strengths, spot the gaps, and apply with intention.',
              },
              {
                icon: Sparkles,
                title: 'Put your best foot forward.',
                description:
                  'Get a thoughtful cover-letter draft, practice interview questions, and a nudge when it’s time to follow up.',
              },
            ].map((f) => (
              <article key={f.title}>
                <span>
                  <f.icon size={24} />
                </span>
                <h3>{f.title}</h3>
                <p>{f.description}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="landing-cta">
          <Sparkles size={28} />
          <h2>Your next move starts here.</h2>
          <p>You bring the ambition. We’ll help with the organization.</p>
          <Button asChild>
            <Link href="/register">
              Let’s make moves <ArrowRight size={17} />
            </Link>
          </Button>
        </section>
      </main>
      <footer className="landing-footer">
        <Logo />
        <span>Made for your momentum.</span>
        <Link href="/login">
          Your workspace <ArrowUpRight size={14} />
        </Link>
      </footer>
    </div>
  );
}
