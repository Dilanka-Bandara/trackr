'use client';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Job } from '@trackr/shared';
import {
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  MapPin,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { api, json } from '@/lib/api';
import { PageHeader } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import { JobDialog } from '@/components/job-dialog';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Empty, ErrorState, Loading } from '@/components/states';
function Jobs() {
  const params = useSearchParams();
  const [search, setSearch] = useState(params.get('q') || '');
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState('newest');
  const [open, setOpen] = useState(params.has('new'));
  const [edit, setEdit] = useState<Job>();
  const [remove, setRemove] = useState<Job>();
  const [busy, setBusy] = useState(false);
  const client = useQueryClient();
  useEffect(() => {
    setSearch(params.get('q') || '');
    setPage(1);
    if (params.has('new')) setOpen(true);
  }, [params]);
  const query = useQuery({
    queryKey: ['jobs', search, page, sort],
    queryFn: () =>
      api<{ items: Job[]; total: number; pageSize: number }>(
        `/jobs?page=${page}&search=${encodeURIComponent(search)}&sort=${sort}`,
      ),
  });
  async function deleteJob() {
    if (!remove) return;
    setBusy(true);
    try {
      await api(`/jobs/${remove.id}`, json('DELETE'));
      for (const key of ['jobs', 'applications', 'stats'])
        void client.invalidateQueries({ queryKey: [key] });
      setRemove(undefined);
      toast.success('Opportunity deleted');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function add(job: Job) {
    try {
      await api('/applications', json('POST', { jobId: job.id }));
      toast.success('Added to your board');
      void client.invalidateQueries({ queryKey: ['applications'] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  return (
    <>
      <PageHeader
        eyebrow="MAKE ROOM FOR POSSIBILITY"
        title="Saved opportunities"
        description="A collection of roles that could be your next chapter."
        action={
          <Button
            onClick={() => {
              setEdit(undefined);
              setOpen(true);
            }}
          >
            <Plus size={17} />
            Save a job
          </Button>
        }
      />
      <div className="filter-toolbar">
        <div className="search-field">
          <Search size={17} />
          <input
            aria-label="Search companies and roles"
            placeholder="Search companies, roles…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <select aria-label="Sort jobs" value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="newest">Newest first</option>
          <option value="company">Company A–Z</option>
        </select>
        <span className="result-count">{query.data?.total ?? '…'} opportunities</span>
      </div>
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : !query.data.items.length ? (
        <Empty
          title={search ? 'No matching opportunities' : 'Your next opportunity belongs here'}
          description={
            search
              ? 'Try another company or role name.'
              : 'Save a role you love and start building your next chapter.'
          }
          action={
            <Button onClick={() => setOpen(true)}>
              <Plus size={16} />
              Save your first job
            </Button>
          }
        />
      ) : (
        <div className="jobs-grid">
          {query.data.items.map((job, i) => (
            <article className="job-card" key={job.id}>
              <div className="job-card-top">
                <span className={`company-logo large logo-color-${i % 5}`}>{job.company[0]}</span>
                <div className="job-card-actions">
                  <button
                    aria-label={`Edit ${job.company}`}
                    onClick={() => {
                      setEdit(job);
                      setOpen(true);
                    }}
                  >
                    <Pencil size={16} />
                  </button>
                  <button aria-label={`Delete ${job.company}`} onClick={() => setRemove(job)}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              <span className="job-company">{job.company}</span>
              <h2>{job.title}</h2>
              <p className="job-location">
                <MapPin size={14} />
                {job.location || 'Location not specified'}
              </p>
              {job.salaryText && <span className="salary-chip">{job.salaryText}</span>}
              <p className="job-description">
                {job.description || 'Add a job description to unlock more useful AI insights.'}
              </p>
              <div className="job-card-footer">
                <Button variant="outline" size="sm" onClick={() => void add(job)}>
                  <Plus size={14} />
                  Add to board
                </Button>
                {job.url && (
                  <a href={job.url} target="_blank" rel="noreferrer" className="text-link">
                    View role <ExternalLink size={13} />
                  </a>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
      {!!query.data?.total && (
        <div className="pagination">
          <span>
            Page {page} of {Math.ceil(query.data.total / 20)}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
          >
            <ArrowLeft size={14} />
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page * 20 >= query.data.total}
            onClick={() => setPage(page + 1)}
          >
            Next
            <ArrowRight size={14} />
          </Button>
        </div>
      )}
      <JobDialog open={open} onOpenChange={setOpen} job={edit} />
      <Dialog open={!!remove} onOpenChange={() => setRemove(undefined)}>
        <DialogContent>
          <DialogTitle>Delete this opportunity?</DialogTitle>
          <DialogDescription>
            This removes {remove?.company} — {remove?.title}, its application, notes, reminders, and
            AI results.
          </DialogDescription>
          <div className="form-actions">
            <Button variant="outline" onClick={() => setRemove(undefined)}>
              Keep it
            </Button>
            <Button variant="destructive" disabled={busy} onClick={deleteJob}>
              Delete opportunity
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <Jobs />
    </Suspense>
  );
}
