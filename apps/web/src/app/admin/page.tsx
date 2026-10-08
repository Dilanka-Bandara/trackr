'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { User } from '@trackr/shared';
import { Bar, BarChart, ResponsiveContainer, XAxis, Tooltip } from 'recharts';
import { api } from '@/lib/api';
import { useUser } from '@/hooks/use-trackr';
import { AppShell, PageHeader } from '@/components/app-shell';
import { ErrorState, Loading } from '@/components/states';
import { Button } from '@/components/ui/button';
export default function Admin() {
  const user = useUser();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const allowed = user.data?.role === 'ADMIN';
  const stats = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () =>
      api<{
        users: number;
        proUsers: number;
        aiCalls: number;
        mrr: number | null;
        currency: string;
        signups: { week: string; count: number }[];
      }>('/admin/stats'),
    enabled: allowed,
  });
  const users = useQuery({
    queryKey: ['admin-users', search, page],
    queryFn: () =>
      api<{ items: (User & { createdAt: string })[]; total: number }>(
        `/admin/users?search=${encodeURIComponent(search)}&page=${page}`,
      ),
    enabled: allowed,
  });
  return (
    <AppShell>
      <PageHeader title="Admin dashboard" description="A clear view of your product’s growth." />
      {user.isPending ? (
        <Loading />
      ) : !allowed ? (
        <ErrorState error={new Error('This page requires an administrator account.')} />
      ) : (
        <>
          {stats.isPending ? (
            <Loading />
          ) : stats.error ? (
            <ErrorState error={stats.error} />
          ) : (
            <>
              <div className="stats-grid">
                {[
                  ['Total users', stats.data.users],
                  ['Pro members', stats.data.proUsers],
                  ['AI calls this month', stats.data.aiCalls],
                  [
                    'Monthly recurring revenue',
                    stats.data.mrr === null
                      ? 'Not configured'
                      : new Intl.NumberFormat('en', {
                          style: 'currency',
                          currency: stats.data.currency,
                        }).format(stats.data.mrr),
                  ],
                ].map(([label, value]) => (
                  <div className="stat-card" key={label}>
                    <span>{label}</span>
                    <div className="stat-value">{value}</div>
                  </div>
                ))}
              </div>
              <section className="panel settings-panel">
                <h2>Signups · last 8 weeks</h2>
                <div className="activity-chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.data.signups}>
                      <XAxis dataKey="week" />
                      <Tooltip />
                      <Bar dataKey="count" fill="#8e7bea" radius={[5, 5, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>
            </>
          )}
          <div className="filter-toolbar">
            <input
              aria-label="Search users"
              placeholder="Search users…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          {users.error ? (
            <ErrorState error={users.error} />
          ) : (
            <section className="panel table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Plan</th>
                    <th>Role</th>
                    <th>Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {users.data?.items.map((u) => (
                    <tr key={u.id}>
                      <td>{u.name}</td>
                      <td>{u.email}</td>
                      <td>{u.plan}</td>
                      <td>{u.role}</td>
                      <td>{new Date(u.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
          <div className="pagination">
            <Button variant="outline" disabled={page === 1} onClick={() => setPage(page - 1)}>
              Previous
            </Button>
            <span>Page {page}</span>
            <Button
              variant="outline"
              disabled={page * 25 >= (users.data?.total || 0)}
              onClick={() => setPage(page + 1)}
            >
              Next
            </Button>
          </div>
        </>
      )}
    </AppShell>
  );
}
