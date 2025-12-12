import { JournalEntry, RSIPEvent, RSIPNode, Task, TaskCreate, TodaySummary } from "./types";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
    },
    ...options,
  });
  if (!res.ok) {
    throw new Error((await res.json().catch(() => ({ detail: res.statusText })) as any).detail || res.statusText);
  }
  return res.json();
}

export const PlannerAPI = {
  summary(): Promise<TodaySummary> {
    return request("/summary/today");
  },
  tasks(date: string): Promise<Task[]> {
    return request(`/tasks?date=${encodeURIComponent(date)}`);
  },
  createTask(payload: TaskCreate): Promise<Task> {
    return request("/tasks", { method: "POST", body: JSON.stringify(payload) });
  },
  updateTask(id: string, updates: Partial<Task>): Promise<Task> {
    return request(`/tasks/${id}`, { method: "PATCH", body: JSON.stringify(updates) });
  },
  completeTask(id: string): Promise<Task> {
    return request(`/tasks/${id}/complete`, { method: "POST" });
  },
  deleteTask(id: string): Promise<{ status: string }> {
    return request(`/tasks/${id}`, { method: "DELETE" });
  },
  nodes(): Promise<RSIPNode[]> {
    return request("/rsip/nodes");
  },
  createNode(payload: Partial<RSIPNode>): Promise<RSIPNode> {
    return request("/rsip/nodes", { method: "POST", body: JSON.stringify(payload) });
  },
  activateNode(id: string, date?: string): Promise<RSIPNode> {
    const qs = date ? `?date=${encodeURIComponent(date)}` : "";
    return request(`/rsip/nodes/${id}/activate${qs}`, { method: "POST" });
  },
  failNode(id: string, payload: { date?: string; notes?: string }): Promise<RSIPNode[]> {
    return request(`/rsip/nodes/${id}/fail`, { method: "POST", body: JSON.stringify(payload) });
  },
  canActivate(date: string): Promise<{ canActivate: boolean }> {
    return request(`/rsip/can-activate?date=${encodeURIComponent(date)}`);
  },
  events(nodeId?: string): Promise<RSIPEvent[]> {
    const qs = nodeId ? `?nodeId=${encodeURIComponent(nodeId)}` : "";
    return request(`/rsip/events${qs}`);
  },
  journal(date: string): Promise<JournalEntry | null> {
    return request(`/journal?date=${encodeURIComponent(date)}`);
  },
  upsertJournal(payload: { date: string; title?: string; content: string }): Promise<JournalEntry> {
    return request("/journal", { method: "POST", body: JSON.stringify(payload) });
  },
};
