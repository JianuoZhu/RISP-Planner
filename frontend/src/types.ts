export type TaskStatus = "pending" | "completed" | "deleted";

export interface Task {
  id: string;
  title: string;
  description?: string;
  date: string;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
}

export interface TaskCreate {
  title: string;
  description?: string;
  date?: string;
}

export type RSIPNodeStatus = "draft" | "active" | "extinguished";

export interface RSIPNode {
  id: string;
  parentId: string | null;
  title: string;
  description?: string;
  group?: string;
  difficulty?: number;
  benefit?: number;
  status: RSIPNodeStatus;
  createdAt: string;
  activatedAt?: string;
  extinguishedAt?: string;
  totalSuccessCount: number;
  totalFailureCount: number;
  lastExecutionDate?: string;
}

export type RSIPEventType = "activation" | "failure" | "rollback";

export interface RSIPEvent {
  id: string;
  type: RSIPEventType;
  nodeId: string;
  affectedNodeIds?: string[];
  date: string;
  createdAt: string;
  notes?: string;
}

export interface JournalEntry {
  id: string;
  date: string;
  title?: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface TodaySummary {
  date: string;
  pendingTasks: number;
  completedTasks: number;
  activeNodes: number;
  activatedToday: boolean;
  journalSnippet?: string | null;
}
