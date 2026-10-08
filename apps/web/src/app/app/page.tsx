'use client';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  Circle,
  MessageSquare,
  Sparkles,
  Target,
  Trophy,
} from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { api } from '@/lib/api';
import { useApplications, useResumes, useUser } from '@/hooks/use-trackr';
import { AddApplicationLink, PageHeader, PeriodLabel } from '@/components/app-shell';
import { ErrorState, Loading } from '@/components/states';
import { relativeDate } from '@/lib/utils';
type Stats = {
  total: number;
  counts: Record<string, number>;
  responseRate: number;
  weeks: { week: string; applications: number }[];
};
export default function Dashboard() {
  const user = useUser();
  const applications = useApplications();
  const resumes = useResumes();
  const stats = useQuery({ queryKey: ['stats'], queryFn: () => api<Stats>('/stats/me') });
  const reminders = useQuery({
    queryKey: ['reminders'],
    queryFn: () =>
      api<{ id: string; message: string; remindAt: string; sentAt: string | null }[]>('/reminders'),
  });
  const next = reminders.data?.find((r) => !r.sentAt && new Date(r.remindAt) > new Date());
  const cards = [
    {
      label: 'Total applications',
      value: stats.data?.total,
      icon: BriefcaseBusiness,
      color: 'purple',
      detail: 'Every opportunity, in one place',
    },
    {
      label: 'In interviews',
      value: stats.data?.counts.INTERVIEW,
      icon: MessageSquare,
      color: 'blue',
      detail: 'Conversations that count',
    },
    {
      label: 'Offers received',
      value: stats.data?.counts.OFFER,
      icon: Trophy,
      color: 'green',
      detail: 'Your hard work, paying off',
    },
    {
      label: 'Response rate',
      value: `${stats.data?.responseRate ?? 0}%`,
      icon: Target,
      color: 'orange',
      detail: 'Of applications submitted',
    },
  ];
  return (
    <>
      <PageHeader
        eyebrow="YOUR JOB SEARCH, AT A GLANCE"
        title={`Let’s make moves${user.data ? `, ${user.data.name.split(' ')[0]}` : ''}.`}
        description="A little progress every day. Here’s where you stand."
        action={<AddApplicationLink />}
      />
      <div className="momentum-banner">
        <span className="sparkle-circle">
          <Sparkles size={21} />
        </span>
        <div>
          <strong>Your next chapter is closer than you think.</strong>
          <p>Keep showing up. Every application is a step toward something great.</p>
        </div>
        <Link href="/app/board">
          Keep the momentum <ArrowRight size={16} />
        </Link>
        <span className="banner-orbit" aria-hidden="true" />
      </div>
      {stats.isPending ? (
        <Loading />
      ) : stats.error ? (
        <ErrorState error={stats.error} retry={() => void stats.refetch()} />
      ) : (
        <>
          <section className="stats-grid">
            {cards.map((c) => (
              <div className="stat-card" key={c.label}>
                <div className="stat-top">
                  <span>{c.label}</span>
                  <span className={`stat-icon ${c.color}`}>
                    <c.icon size={18} />
                  </span>
                </div>
                <div className="stat-value">{c.value ?? 0}</div>
                <div className="stat-detail">
                  <span className="tiny-dot" />
                  {c.detail}
                </div>
              </div>
            ))}
          </section>
          <div className="dashboard-columns">
            <section className="panel activity-panel">
              <div className="panel-heading">
                <div>
                  <h2>Application activity</h2>
                  <p>Small steps. Real progress.</p>
                </div>
                <PeriodLabel />
              </div>
              <div className="chart-summary">
                <strong>{stats.data.weeks.reduce((n, w) => n + w.applications, 0)}</strong>
                <span>applications over the last 8 weeks</span>
                <span className="chart-legend">
                  <i />
                  Applications
                </span>
              </div>
              <div className="activity-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={stats.data.weeks}
                    barSize={28}
                    margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
                  >
                    <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="4 5" />
                    <XAxis
                      dataKey="week"
                      tickFormatter={(v) =>
                        new Date(`${v}T00:00:00`).toLocaleDateString('en', {
                          month: 'short',
                          day: 'numeric',
                        })
                      }
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#90909e', fontSize: 11 }}
                      tickMargin={12}
                    />
                    <Tooltip
                      cursor={{ fill: 'var(--soft)' }}
                      contentStyle={{ borderRadius: 10, border: '1px solid #e9e8ee', fontSize: 12 }}
                    />
                    <Bar
                      isAnimationActive={false}
                      dataKey="applications"
                      name="Applications"
                      fill="#8e7bea"
                      radius={[5, 5, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
            <section className="panel pipeline-panel">
              <div className="panel-heading">
                <div>
                  <h2>Your pipeline</h2>
                  <p>A clear view of what’s next.</p>
                </div>
                <Link href="/app/board" aria-label="Open board">
                  <ArrowUpRight size={18} />
                </Link>
              </div>
              <div className="pipeline-total">
                <strong>{stats.data.total}</strong>
                <span>opportunities in motion</span>
              </div>
              <div className="pipeline-bar">
                {Object.entries(stats.data.counts).map(
                  ([status, count]) =>
                    count > 0 && (
                      <span
                        key={status}
                        className={`segment ${status.toLowerCase()}`}
                        style={{ flex: count }}
                      />
                    ),
                )}
              </div>
              <div className="pipeline-list">
                {Object.entries(stats.data.counts).map(([status, count]) => (
                  <div key={status}>
                    <span>
                      <i className={`status-dot ${status.toLowerCase()}`} />
                      {status === 'WISHLIST'
                        ? 'Wishlist'
                        : status[0] + status.slice(1).toLowerCase()}
                    </span>
                    <strong>{count}</strong>
                    <small>
                      {stats.data.total ? Math.round((count / stats.data.total) * 100) : 0}%
                    </small>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </>
      )}
      <div className="dashboard-columns lower-columns">
        <section className="panel recent-panel">
          <div className="panel-heading">
            <div>
              <h2>Recent applications</h2>
              <p>Your latest opportunities, all in one place.</p>
            </div>
            <Link className="text-link" href="/app/board">
              View board <ArrowRight size={14} />
            </Link>
          </div>
          {applications.error ? (
            <ErrorState error={applications.error} />
          ) : applications.isPending ? (
            <Loading />
          ) : !applications.data?.length ? (
            <div className="table-empty">
              Your first opportunity starts with a saved job.{' '}
              <Link href="/app/jobs?new=1">Add one now →</Link>
            </div>
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>COMPANY & ROLE</th>
                    <th>STATUS</th>
                    <th>ADDED</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {[...applications.data]
                    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                    .slice(0, 4)
                    .map((a, i) => (
                      <tr key={a.id}>
                        <td>
                          <Link href={`/app/board?application=${a.id}`} className="company-cell">
                            <span className={`company-logo logo-color-${i % 5}`}>
                              {a.job.company[0]}
                            </span>
                            <span>
                              <strong>{a.job.title}</strong>
                              <small>
                                {a.job.company} <span className="dot-separator">·</span>{' '}
                                {a.job.location || 'Location not specified'}
                              </small>
                            </span>
                          </Link>
                        </td>
                        <td>
                          <span className={`status-badge ${a.status.toLowerCase()}`}>
                            <i />
                            {a.status[0] + a.status.slice(1).toLowerCase()}
                          </span>
                        </td>
                        <td className="muted table-date">{relativeDate(a.createdAt)}</td>
                        <td>
                          <Link
                            href={`/app/board?application=${a.id}`}
                            aria-label={`View ${a.job.company} application`}
                          >
                            <ArrowUpRight size={17} />
                          </Link>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <div className="dashboard-side">
          <section className="next-step-card">
            <div className="next-step-title">
              <CalendarDays size={18} />
              <span>UP NEXT</span>
            </div>
            <h3>{next ? next.message : 'Make room for your next move.'}</h3>
            <p>
              {next
                ? new Date(next.remindAt).toLocaleString(undefined, {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })
                : 'Set a follow-up reminder on any application. We’ll take care of the nudge.'}
            </p>
            <Link href="/app/board">
              {next ? 'Open applications' : 'Plan a follow-up'} <ArrowUpRight size={16} />
            </Link>
          </section>
          <section className="getting-started">
            <div>
              <span className="small-sparkle">
                <Sparkles size={17} />
              </span>
              <h3>Set yourself up for success</h3>
            </div>
            {[
              {
                label: 'Save your first opportunity',
                done: !!applications.data?.length,
                href: '/app/jobs',
              },
              { label: 'Upload your CV', done: !!resumes.data?.length, href: '/app/cvs' },
              {
                label: 'Get your first AI match',
                done: applications.data?.some((a) => a.score != null),
                href: '/app/board',
              },
            ].map((item) => (
              <Link key={item.label} href={item.href}>
                {item.done ? (
                  <span className="check-circle">
                    <Check size={12} />
                  </span>
                ) : (
                  <Circle size={17} />
                )}
                <span>{item.label}</span>
                {!item.done && <ArrowDownRight size={14} />}
              </Link>
            ))}
          </section>
        </div>
      </div>
    </>
  );
}
