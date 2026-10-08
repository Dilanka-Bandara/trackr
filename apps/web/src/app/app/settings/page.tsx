import Link from 'next/link';
import { ArrowRight, FileText, LayoutGrid, Sparkles } from 'lucide-react';
import { PageHeader } from '@/components/app-shell';
export default function Settings() {
  return (
    <>
      <PageHeader
        eyebrow="A LITTLE GUIDANCE GOES A LONG WAY"
        title="Make yourself at home"
        description="Everything you need to get your search moving."
      />
      <div className="help-grid">
        {[
          {
            title: 'Start with an opportunity',
            text: 'Save a job, add its description, and track it on your application board. Drag cards between stages as things move forward.',
            icon: LayoutGrid,
            href: '/app/jobs',
          },
          {
            title: 'Bring your experience',
            text: 'Upload a text-based PDF CV. Trackr extracts your skills and experience so your AI results are grounded in your background.',
            icon: FileText,
            href: '/app/cvs',
          },
          {
            title: 'Find your edge',
            text: 'Open an application, select your parsed CV, and explore match analysis, cover-letter drafts, and interview preparation.',
            icon: Sparkles,
            href: '/app/board',
          },
        ].map((c) => (
          <Link className="panel help-card" href={c.href} key={c.title}>
            <c.icon size={25} />
            <h2>{c.title}</h2>
            <p>{c.text}</p>
            <span>
              Let’s go <ArrowRight size={16} />
            </span>
          </Link>
        ))}
      </div>
      <Link className="button button-outline" href="/app/settings/billing">
        Account, plan & billing <ArrowRight size={16} />
      </Link>
    </>
  );
}
