'use client';
import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { FileText, LoaderCircle, ShieldCheck, Sparkles, Trash2, UploadCloud } from 'lucide-react';
import { toast } from 'sonner';
import { uploadSchema } from '@trackr/shared';
import { api, json } from '@/lib/api';
import { useResumes } from '@/hooks/use-trackr';
import { PageHeader } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Empty, ErrorState, Loading } from '@/components/states';
export default function Cvs() {
  const resumes = useResumes();
  const input = useRef<HTMLInputElement>(null);
  const client = useQueryClient();
  const [progress, setProgress] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const [remove, setRemove] = useState<string>();
  const [error, setError] = useState('');
  async function upload(file?: File) {
    if (!file || progress !== null) return;
    const data = uploadSchema.safeParse({
      fileName: file.name,
      size: file.size,
      contentType: file.type,
    });
    if (!data.success) {
      setError('Choose a PDF file no larger than 5 MB.');
      return;
    }
    setProgress(0);
    setError('');
    try {
      const ticket = await api<{ fileKey: string; url: string }>(
        '/resumes/upload-url',
        json('POST', data.data),
      );
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', ticket.url);
        xhr.setRequestHeader('Content-Type', 'application/pdf');
        xhr.setRequestHeader('If-None-Match', '*');
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () =>
          xhr.status >= 200 && xhr.status < 300
            ? resolve()
            : reject(new Error('Upload failed. Check storage configuration and try again.'));
        xhr.onerror = () => reject(new Error('Storage is unreachable. Please try again.'));
        xhr.send(file);
      });
      await api('/resumes', json('POST', { fileKey: ticket.fileKey, fileName: file.name }));
      toast.success('CV uploaded. We’ll notify you when it’s ready.');
      void client.invalidateQueries({ queryKey: ['resumes'] });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setProgress(null);
      if (input.current) input.current.value = '';
    }
  }
  async function deleteResume() {
    if (!remove) return;
    try {
      await api(`/resumes/${remove}`, json('DELETE'));
      setRemove(undefined);
      void client.invalidateQueries({ queryKey: ['resumes'] });
      toast.success('CV deleted');
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  return (
    <>
      <PageHeader
        eyebrow="YOUR EXPERIENCE, READY FOR WHAT’S NEXT"
        title="Your CV collection"
        description="The starting point for thoughtful matches and stronger applications."
      />
      <div
        className={`upload-zone ${dragging ? 'drag-over' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void upload(e.dataTransfer.files[0]);
        }}
      >
        <span className="upload-icon">
          {progress !== null ? (
            <LoaderCircle size={30} className="spin" />
          ) : (
            <UploadCloud size={30} />
          )}
        </span>
        <h2>{progress !== null ? 'Giving your experience a home…' : 'Drop your CV here'}</h2>
        <p>or choose a file from your device · PDF up to 5 MB</p>
        <input
          ref={input}
          type="file"
          accept="application/pdf,.pdf"
          className="sr-only"
          aria-label="Upload CV"
          onChange={(e) => void upload(e.target.files?.[0])}
        />
        <Button
          variant="outline"
          onClick={() => input.current?.click()}
          disabled={progress !== null}
        >
          <UploadCloud size={16} />
          Choose PDF
        </Button>
        {progress !== null && (
          <div className="upload-progress">
            <span style={{ width: `${progress}%` }} />
            <small>{progress}%</small>
          </div>
        )}
      </div>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <div className="upload-benefits">
        <span>
          <ShieldCheck size={15} />
          Private to your account
        </span>
        <span>
          <Sparkles size={15} />
          Skills extracted with AI
        </span>
        <span>
          <FileText size={15} />
          Ready for every application
        </span>
      </div>
      <div className="section-heading">
        <h2>
          Uploaded CVs <span>{resumes.data?.length || 0}</span>
        </h2>
        <Button variant="ghost" size="sm" onClick={() => void resumes.refetch()}>
          Refresh status
        </Button>
      </div>
      {resumes.isPending ? (
        <Loading />
      ) : resumes.error ? (
        <ErrorState error={resumes.error} retry={() => void resumes.refetch()} />
      ) : !resumes.data.length ? (
        <Empty
          title="Your experience has a story to tell"
          description="Upload your CV to get personalized match insights and application help."
        />
      ) : (
        <div className="cv-grid">
          {resumes.data.map((r) => (
            <article className="panel cv-card" key={r.id}>
              <div className="cv-card-heading">
                <span className="file-icon">
                  <FileText size={26} />
                </span>
                <div>
                  <h3>{r.fileName}</h3>
                  <p>Added {new Date(r.createdAt).toLocaleDateString()}</p>
                </div>
                <button aria-label={`Delete ${r.fileName}`} onClick={() => setRemove(r.id)}>
                  <Trash2 size={17} />
                </button>
              </div>
              <span
                className={`status-badge ${r.status === 'READY' ? 'offer' : r.status === 'FAILED' ? 'rejected' : 'applied'}`}
              >
                <i />
                {r.status === 'READY'
                  ? 'Ready to use'
                  : r.status === 'FAILED'
                    ? 'Parsing failed'
                    : 'Processing your CV'}
              </span>
              {r.parsedJson?.skills?.length ? (
                <div className="cv-skills">
                  <span>YOUR SKILLS</span>
                  <div>
                    {r.parsedJson.skills.map((s) => (
                      <span className="skill-tag" key={s}>
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="muted">
                  {r.status === 'FAILED'
                    ? 'Upload a text-based PDF and verify your AI provider is configured.'
                    : 'Your extracted skills will appear here once processing finishes.'}
                </p>
              )}
              {r.parsedJson?.experience?.length ? (
                <details>
                  <summary>Experience & education</summary>
                  {[...r.parsedJson.experience, ...(r.parsedJson.education || [])].map((s, i) => (
                    <p key={i}>{s}</p>
                  ))}
                </details>
              ) : null}
            </article>
          ))}
        </div>
      )}
      <Dialog open={!!remove} onOpenChange={() => setRemove(undefined)}>
        <DialogContent>
          <DialogTitle>Delete this CV?</DialogTitle>
          <DialogDescription>
            The file and extracted data will be removed. Applications using it will have no CV
            selected.
          </DialogDescription>
          <div className="form-actions">
            <Button variant="outline" onClick={() => setRemove(undefined)}>
              Keep CV
            </Button>
            <Button variant="destructive" onClick={deleteResume}>
              Delete CV
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
