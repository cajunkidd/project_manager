import type { Task, Project, FormSubmission } from '@prisma/client';

export interface TaskCreatedEvent {
  type: 'task.created';
  task: Task;
  actorId?: string | null;
}
export interface TaskUpdatedEvent {
  type: 'task.updated';
  task: Task;
  before: Pick<Task, 'status' | 'priority' | 'assignedToId' | 'title'>;
  actorId?: string | null;
}
export interface TaskAssignedEvent {
  type: 'task.assigned';
  task: Task;
  assigneeId: string;
  actorId?: string | null;
}
export interface TaskStatusChangedEvent {
  type: 'task.status_changed';
  task: Task;
  fromStatus: string;
  toStatus: string;
  actorId?: string | null;
}
export interface ProjectCreatedEvent {
  type: 'project.created';
  project: Project;
  actorId?: string | null;
}
export interface ProjectUpdatedEvent {
  type: 'project.updated';
  project: Project;
  actorId?: string | null;
}
export interface CommentCreatedEvent {
  type: 'comment.created';
  taskId?: string | null;
  projectId?: string | null;
  body: string;
  authorId: string;
  mentionedUserIds: string[];
}
export interface FormSubmittedEvent {
  type: 'form.submitted';
  submission: FormSubmission;
  formId: string;
  actorId?: string | null;
}

export type DomainEvent =
  | TaskCreatedEvent
  | TaskUpdatedEvent
  | TaskAssignedEvent
  | TaskStatusChangedEvent
  | ProjectCreatedEvent
  | ProjectUpdatedEvent
  | CommentCreatedEvent
  | FormSubmittedEvent;

export type EventType = DomainEvent['type'];
export type EventOfType<T extends EventType> = Extract<DomainEvent, { type: T }>;

type AnyListener = (event: DomainEvent) => Promise<void> | void;

const listeners = new Map<EventType, Set<AnyListener>>();

export const eventBus = {
  on<T extends EventType>(
    type: T,
    listener: (event: EventOfType<T>) => Promise<void> | void,
  ): () => void {
    const set = listeners.get(type) ?? new Set<AnyListener>();
    set.add(listener as AnyListener);
    listeners.set(type, set);
    return () => set.delete(listener as AnyListener);
  },

  async emit(event: DomainEvent): Promise<void> {
    const set = listeners.get(event.type);
    if (!set) return;
    for (const listener of set) {
      try {
        await listener(event);
      } catch (err) {
        if (process.env.NODE_ENV !== 'test') {
          // eslint-disable-next-line no-console
          console.error(`Listener for ${event.type} failed:`, err);
        }
      }
    }
  },

  clear(): void {
    listeners.clear();
  },
};
