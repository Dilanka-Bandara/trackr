'use client';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDroppable,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Application, Status, statuses } from '@trackr/shared';
import { GripVertical, ListFilter, MapPin, Plus, Search, Sparkles } from 'lucide-react';
import { useApplications, useMove } from '@/hooks/use-trackr';
import { PageHeader, AddApplicationLink } from '@/components/app-shell';
import { ApplicationDrawer } from '@/components/application-drawer';
import { ErrorState, Loading } from '@/components/states';
import { relativeDate } from '@/lib/utils';
import Link from 'next/link';
function Card({ application: a, onClick }: { application: Application; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: a.id,
    data: { status: a.status },
  });
  return (
    <article
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.35 : 1,
      }}
      className="kanban-card"
    >
      <div className="kanban-card-top">
        <span className="company-logo logo-color-0">{a.job.company[0]}</span>
        <span>{a.job.company}</span>
        <button
          className="drag-handle"
          aria-label={`Move ${a.job.company} application`}
          {...attributes}
          {...listeners}
        >
          <GripVertical size={16} />
        </button>
      </div>
      <button className="card-title" onClick={onClick}>
        {a.job.title}
      </button>
      <p>
        <MapPin size={12} />
        {a.job.location || 'Location not specified'}
      </p>
      {a.job.salaryText && <span className="salary-chip">{a.job.salaryText}</span>}
      <div className="kanban-card-footer">
        <span>{relativeDate(a.appliedAt || a.createdAt)}</span>
        {a.score != null ? (
          <span className="match-badge">
            <Sparkles size={11} />
            {a.score}% match
          </span>
        ) : (
          <button onClick={onClick} className="analyze-link">
            <Sparkles size={12} />
            Find your fit
          </button>
        )}
      </div>
    </article>
  );
}
function Column({
  status,
  items,
  onSelect,
}: {
  status: Status;
  items: Application[];
  onSelect: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <section className={`kanban-column ${isOver ? 'drag-over' : ''}`} ref={setNodeRef}>
      <div className="column-title">
        <i className={`status-dot ${status.toLowerCase()}`} />
        <h2>{status[0] + status.slice(1).toLowerCase()}</h2>
        <span>{items.length}</span>
        <Link href="/app/jobs?new=1" aria-label={`Add an opportunity`}>
          <Plus size={16} />
        </Link>
      </div>
      <SortableContext items={items.map((a) => a.id)} strategy={verticalListSortingStrategy}>
        {items.map((a) => (
          <Card key={a.id} application={a} onClick={() => onSelect(a.id)} />
        ))}
      </SortableContext>
      {!items.length && (
        <div className="column-empty">
          A little space for
          <br />
          your next opportunity.
        </div>
      )}
    </section>
  );
}
function Board() {
  const params = useSearchParams();
  const applications = useApplications();
  const move = useMove();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string | null>(params.get('application'));
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  function dragEnd(event: DragEndEvent) {
    if (!event.over || event.active.id === event.over.id || move.isPending) return;
    const target = applications.data?.find((a) => a.id === event.over?.id);
    const status =
      target?.status ??
      (statuses.includes(event.over.id as Status) ? (event.over.id as Status) : undefined);
    if (!status) return;
    const column = applications.data?.filter((a) => a.status === status) ?? [];
    const position = target ? column.findIndex((a) => a.id === target.id) : column.length;
    move.mutate({ id: String(event.active.id), status, position });
  }
  return (
    <>
      <PageHeader
        eyebrow="EVERY OPPORTUNITY, IN MOTION"
        title="Your application board"
        description="From ‘what if’ to ‘you’re hired’. Keep your next move in view."
        action={<AddApplicationLink />}
      />
      <div className="filter-toolbar">
        <div className="search-field">
          <Search size={17} />
          <input
            aria-label="Filter applications"
            placeholder="Find a company or role…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <span className="board-hint">
          <ListFilter size={15} />
          Drag to move · Click to explore
        </span>
        <span className="result-count">{applications.data?.length ?? 0} opportunities</span>
      </div>
      {applications.isPending ? (
        <Loading />
      ) : applications.error ? (
        <ErrorState error={applications.error} retry={() => void applications.refetch()} />
      ) : (
        <DndContext sensors={sensors} onDragEnd={dragEnd}>
          <div className="kanban-board">
            {statuses.map((status) => (
              <Column
                key={status}
                status={status}
                items={applications.data
                  .filter(
                    (a) =>
                      a.status === status &&
                      `${a.job.company} ${a.job.title}`
                        .toLowerCase()
                        .includes(search.toLowerCase()),
                  )
                  .sort((a, b) => a.position - b.position)}
                onSelect={setSelected}
              />
            ))}
          </div>
        </DndContext>
      )}
      <ApplicationDrawer
        application={applications.data?.find((a) => a.id === selected)}
        onClose={() => setSelected(null)}
      />
    </>
  );
}
export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <Board />
    </Suspense>
  );
}
