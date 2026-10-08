import { AlertCircle, ArrowRight, Inbox } from 'lucide-react';
import { Button } from './ui/button';
export function Loading() {
  return (
    <div className="loading-grid" aria-label="Loading workspace" role="status">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="skeleton" />
      ))}
    </div>
  );
}
export function ErrorState({ error, retry }: { error: Error; retry?: () => void }) {
  return (
    <div className="empty-state">
      <AlertCircle size={28} />
      <h3>We couldn’t load this just yet</h3>
      <p>{error.message}</p>
      {retry && (
        <Button variant="outline" onClick={retry}>
          Try again <ArrowRight size={15} />
        </Button>
      )}
    </div>
  );
}
export function Empty({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Inbox size={25} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
