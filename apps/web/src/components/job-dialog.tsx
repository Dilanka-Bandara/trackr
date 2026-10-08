'use client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { jobSchema, Job, JobInput, z } from '@trackr/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { LoaderCircle, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { api, json } from '@/lib/api';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
export function JobDialog({
  open,
  onOpenChange,
  job,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  job?: Job;
}) {
  const client = useQueryClient();
  const [track, setTrack] = useState(true);
  const [error, setError] = useState('');
  const form = useForm<z.input<typeof jobSchema>, unknown, JobInput>({
    resolver: zodResolver(jobSchema),
    defaultValues: {
      company: '',
      title: '',
      url: '',
      location: '',
      salaryText: '',
      description: '',
    },
  });
  useEffect(() => {
    if (open) {
      form.reset(
        job ?? { company: '', title: '', url: '', location: '', salaryText: '', description: '' },
      );
      setError('');
    }
  }, [open, job, form]);
  async function submit(input: JobInput) {
    setError('');
    try {
      const saved = await api<Job>(
        job ? `/jobs/${job.id}` : '/jobs',
        json(job ? 'PATCH' : 'POST', input),
      );
      if (!job && track)
        await api('/applications', json('POST', { jobId: saved.id, status: 'WISHLIST' }));
      for (const key of ['jobs', 'applications', 'stats'])
        void client.invalidateQueries({ queryKey: [key] });
      toast.success(job ? 'Job updated' : 'A new opportunity, saved.');
      onOpenChange(false);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>{job ? 'Edit opportunity' : 'Save a new opportunity'}</DialogTitle>
        <DialogDescription>A promising role? Give it a home in your workspace.</DialogDescription>
        <form onSubmit={form.handleSubmit(submit)} className="job-form">
          <div className="form-row">
            <label>
              Company *<input placeholder="e.g. Linear" {...form.register('company')} />
              {form.formState.errors.company && (
                <small className="field-error">{form.formState.errors.company.message}</small>
              )}
            </label>
            <label>
              Job title *<input placeholder="e.g. Product Designer" {...form.register('title')} />
              {form.formState.errors.title && (
                <small className="field-error">{form.formState.errors.title.message}</small>
              )}
            </label>
          </div>
          <label>
            Job posting URL
            <input
              type="url"
              placeholder="https://company.com/careers/…"
              {...form.register('url')}
            />
            {form.formState.errors.url && (
              <small className="field-error">{form.formState.errors.url.message}</small>
            )}
          </label>
          <div className="form-row">
            <label>
              Location
              <input placeholder="Remote, London…" {...form.register('location')} />
            </label>
            <label>
              Salary range
              <input placeholder="$90,000 – $120,000" {...form.register('salaryText')} />
            </label>
          </div>
          <label>
            Job description
            <textarea
              rows={5}
              placeholder="Paste the job description here. This helps AI find your strengths and prepare you for interviews."
              {...form.register('description')}
            />
          </label>
          {!job && (
            <label className="checkbox-label">
              <input type="checkbox" checked={track} onChange={(e) => setTrack(e.target.checked)} />
              Add to my application board
            </label>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="form-actions">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? (
                <LoaderCircle className="spin" size={16} />
              ) : (
                <Plus size={16} />
              )}
              {job ? 'Save changes' : 'Save opportunity'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
