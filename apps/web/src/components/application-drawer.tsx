'use client';
import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AiResult, Application, statuses } from '@trackr/shared';
import {
  CalendarDays,
  Check,
  Copy,
  ExternalLink,
  FileText,
  LoaderCircle,
  MapPin,
  Save,
  Sparkles,
  Target,
} from 'lucide-react';
import { toast } from 'sonner';
import { api, API_URL, json } from '@/lib/api';
import { useMove, useResumes } from '@/hooks/use-trackr';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
export function ApplicationDrawer({
  application,
  onClose,
}: {
  application: Application | undefined;
  onClose: () => void;
}) {
  const [notes, setNotes] = useState('');
  const [resumeId, setResumeId] = useState('');
  const [tab, setTab] = useState('details');
  const [tone, setTone] = useState('formal');
  const [streamText, setStreamText] = useState('');
  const [busy, setBusy] = useState('');
  const [remindAt, setRemindAt] = useState('');
  const [message, setMessage] = useState('Follow up on my application');
  const source = useRef<EventSource | null>(null);
  const client = useQueryClient();
  const resumes = useResumes();
  const move = useMove();
  useEffect(() => {
    setNotes(application?.notes || '');
    setResumeId(application?.resumeId || '');
    setTab('details');
    setStreamText('');
    setBusy('');
    return () => {
      source.current?.close();
    };
  }, [application?.id]);
  const results = useQuery({
    queryKey: ['ai', application?.id],
    queryFn: () => api<AiResult[]>(`/applications/${application!.id}/ai`),
    enabled: !!application,
    refetchInterval: (q) => (q.state.data?.some((r) => r.status === 'PENDING') ? 3000 : false),
  });
  if (!application) return null;
  const app = application;
  const result = results.data?.find(
    (r) =>
      r.type ===
      (tab === 'match' ? 'MATCH' : tab === 'letter' ? 'COVER_LETTER' : 'INTERVIEW_QUESTIONS'),
  );
  async function save() {
    setBusy('save');
    try {
      await api(`/applications/${app.id}`, json('PATCH', { notes, resumeId: resumeId || null }));
      void client.invalidateQueries({ queryKey: ['applications'] });
      toast.success('Application updated');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy('');
    }
  }
  async function generate() {
    setBusy('ai');
    setStreamText('');
    source.current?.close();
    try {
      await api(`/applications/${app.id}`, json('PATCH', { notes, resumeId: resumeId || null }));
      await api(
        `/applications/${app.id}/ai`,
        json('POST', {
          type:
            tab === 'match' ? 'MATCH' : tab === 'letter' ? 'COVER_LETTER' : 'INTERVIEW_QUESTIONS',
          tone,
        }),
      );
      void client.invalidateQueries({ queryKey: ['ai', app.id] });
      void client.invalidateQueries({ queryKey: ['billing'] });
      if (tab === 'letter') {
        const stream = new EventSource(`${API_URL}/applications/${app.id}/ai/cover-letter/stream`, {
          withCredentials: true,
        });
        source.current = stream;
        stream.addEventListener('text', (e) => setStreamText(JSON.parse(e.data).text));
        const finish = () => {
          stream.close();
          setBusy('');
          void client.invalidateQueries({ queryKey: ['ai', app.id] });
        };
        stream.addEventListener('done', finish);
        stream.addEventListener('failed', () => {
          finish();
          toast.error('Generation failed. Check your AI provider settings.');
        });
        stream.onerror = () => {
          finish();
          toast.error('Live connection interrupted. Your result will appear when ready.');
        };
      } else setBusy('');
    } catch (e) {
      setBusy('');
      toast.error((e as Error).message);
    }
  }
  async function reminder() {
    if (!remindAt) return;
    setBusy('reminder');
    try {
      await api(
        '/reminders',
        json('POST', {
          applicationId: app.id,
          remindAt: new Date(remindAt).toISOString(),
          message,
        }),
      );
      toast.success('Follow-up reminder scheduled');
      setRemindAt('');
      void client.invalidateQueries({ queryKey: ['reminders'] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy('');
    }
  }
  return (
    <Dialog
      open={!!application}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="application-drawer">
        <div className="drawer-company">
          <span className="company-logo large logo-color-0">{app.job.company[0]}</span>
          <span>{app.job.company}</span>
          {app.job.url && (
            <a
              href={app.job.url}
              target="_blank"
              rel="noreferrer"
              aria-label="View original posting"
            >
              <ExternalLink size={17} />
            </a>
          )}
        </div>
        <DialogTitle>{app.job.title}</DialogTitle>
        <DialogDescription>
          <span className="inline-flex">
            <MapPin size={14} />
            {app.job.location || 'Location not specified'}
          </span>
          {app.job.salaryText && ` · ${app.job.salaryText}`}
        </DialogDescription>
        <div className="drawer-status">
          <label>
            Application stage
            <select
              aria-label="Application stage"
              value={app.status}
              onChange={(e) =>
                move.mutate({
                  id: app.id,
                  status: e.target.value as Application['status'],
                  position: 0,
                })
              }
            >
              {statuses.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label>
            Your CV
            <select value={resumeId} onChange={(e) => setResumeId(e.target.value)}>
              <option value="">Choose a CV</option>
              {resumes.data?.map((r) => (
                <option key={r.id} value={r.id} disabled={r.status !== 'READY'}>
                  {r.fileName}
                  {r.status !== 'READY' ? ` (${r.status.toLowerCase()})` : ''}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="drawer-tabs">
          {[
            { key: 'details', label: 'Details', icon: FileText },
            { key: 'match', label: 'AI match', icon: Target },
            { key: 'letter', label: 'Cover letter', icon: Sparkles },
            { key: 'interview', label: 'Interview', icon: CalendarDays },
          ].map((t) => (
            <button
              key={t.key}
              className={tab === t.key ? 'selected' : ''}
              onClick={() => setTab(t.key)}
            >
              <t.icon size={14} />
              {t.label}
            </button>
          ))}
        </div>
        {tab === 'details' ? (
          <div className="drawer-section">
            <h3>About the role</h3>
            <p className="preserve-lines description-box">
              {app.job.description ||
                'No description yet. Edit this opportunity in Saved jobs to add one.'}
            </p>
            <label>
              Your notes
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={5}
                placeholder="People to reach out to, questions to ask, things to remember…"
                maxLength={10000}
              />
            </label>
            <Button disabled={busy === 'save'} onClick={save}>
              <Save size={16} />
              Save changes
            </Button>
            <div className="reminder-box">
              <h3>
                <CalendarDays size={17} />A timely nudge
              </h3>
              <p>Set a reminder to follow up. We’ll send you an email.</p>
              <label>
                Remind me on
                <input
                  type="datetime-local"
                  value={remindAt}
                  onChange={(e) => setRemindAt(e.target.value)}
                />
              </label>
              <label>
                Reminder message
                <input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  maxLength={500}
                />
              </label>
              <Button
                variant="outline"
                disabled={!remindAt || !message || busy === 'reminder'}
                onClick={reminder}
              >
                Set reminder
              </Button>
            </div>
            <div className="timeline">
              <h3>Timeline</h3>
              <p>
                <i />
                Saved {new Date(app.createdAt).toLocaleDateString()}
              </p>
              {app.appliedAt && (
                <p>
                  <i />
                  Applied {new Date(app.appliedAt).toLocaleDateString()}
                </p>
              )}
              <p>
                <i />
                Last updated {new Date(app.updatedAt).toLocaleDateString()}
              </p>
            </div>
          </div>
        ) : (
          <div className="drawer-section">
            <div className="ai-intro">
              <span>
                <Sparkles size={21} />
              </span>
              <h3>
                {tab === 'match'
                  ? 'Find your edge.'
                  : tab === 'letter'
                    ? 'Make a memorable introduction.'
                    : 'Walk in with confidence.'}
              </h3>
              <p>
                {tab === 'match'
                  ? 'See where your experience shines and what to work on.'
                  : tab === 'letter'
                    ? 'A tailored first draft, grounded in your experience.'
                    : 'Practice questions and tips tailored to this role.'}
              </p>
            </div>
            {!resumeId && (
              <p className="info-box">
                Choose a ready CV above to get started. Upload one in My CVs if you haven’t yet.
              </p>
            )}
            {tab === 'letter' && (
              <label>
                Tone
                <select value={tone} onChange={(e) => setTone(e.target.value)}>
                  <option value="formal">Professional & formal</option>
                  <option value="friendly">Warm & friendly</option>
                </select>
              </label>
            )}
            <Button
              className="full-width"
              onClick={generate}
              disabled={!resumeId || busy === 'ai' || result?.status === 'PENDING'}
            >
              {busy === 'ai' || result?.status === 'PENDING' ? (
                <LoaderCircle className="spin" size={16} />
              ) : (
                <Sparkles size={16} />
              )}
              {result?.status === 'PENDING'
                ? 'Working on your result…'
                : result
                  ? 'Generate again'
                  : tab === 'match'
                    ? 'Analyze my match'
                    : tab === 'letter'
                      ? 'Draft cover letter'
                      : 'Prepare for interview'}
            </Button>
            <p className="ai-note">Uses 1 AI credit. Review AI suggestions before using them.</p>
            {results.error && <p className="form-error">{results.error.message}</p>}
            {result?.status === 'FAILED' && (
              <p className="form-error">
                {result.content?.error || 'Could not generate a result. Please try again.'}
              </p>
            )}
            {tab === 'match' && result?.status === 'DONE' && (
              <div className="match-result">
                <div
                  className="score-ring"
                  style={{
                    background: `conic-gradient(#7661df ${(result.score || 0) * 3.6}deg, var(--soft) 0)`,
                  }}
                >
                  <span>
                    <strong>{result.score}</strong>
                    <small>match score</small>
                  </span>
                </div>
                <h3>Your strengths</h3>
                {result.content?.strengths?.map((s) => (
                  <p className="strength" key={s}>
                    <Check size={16} />
                    {s}
                  </p>
                ))}
                <h3>Room to grow</h3>
                {result.content?.gaps?.map((s) => (
                  <p className="gap" key={s}>
                    <span>↗</span>
                    {s}
                  </p>
                ))}
              </div>
            )}
            {tab === 'letter' && (streamText || result?.content?.text) && (
              <div className="letter-result">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    await navigator.clipboard.writeText(streamText || result?.content?.text || '');
                    toast.success('Cover letter copied');
                  }}
                >
                  <Copy size={14} />
                  Copy letter
                </Button>
                <p className="preserve-lines">{streamText || result?.content?.text}</p>
              </div>
            )}
            {tab === 'interview' &&
              result?.content?.questions?.map((q, i) => (
                <div key={q.question} className="interview-question">
                  <span>
                    {String(i + 1).padStart(2, '0')} <small>{q.category}</small>
                  </span>
                  <h4>{q.question}</h4>
                  <p>{q.tip}</p>
                </div>
              ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
