import { useEffect, useMemo, useState } from "react";
import { PlannerAPI } from "./api";
import { formatDateHuman, todayISO } from "./date";
import { JournalEntry, RSIPEvent, RSIPNode, Task, TodaySummary } from "./types";
import "./App.css";

const statusColors: Record<string, string> = {
  pending: "text-amber-200 bg-amber-900/40",
  completed: "text-emerald-200 bg-emerald-900/40",
  draft: "text-slate-100 bg-slate-800/60",
  active: "text-cyan-200 bg-cyan-900/40",
  extinguished: "text-rose-200 bg-rose-900/40",
};

function NodeBadge({ label }: { label: string }) {
  return <span className={`badge ${statusColors[label] || "bg-slate-800 text-slate-100"}`}>{label}</span>;
}

function SectionCard({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="glass card-shadow gradient-border rounded-2xl p-6 text-slate-100">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Module</p>
          <h2 className="text-xl font-semibold text-slate-50">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

interface TreeNode extends RSIPNode {
  children: TreeNode[];
}

function buildTree(nodes: RSIPNode[]): TreeNode[] {
  const map: Record<string, TreeNode> = {};
  nodes.forEach((n) => (map[n.id] = { ...n, children: [] } as TreeNode));
  const roots: TreeNode[] = [];
  nodes.forEach((n) => {
    if (n.parentId && map[n.parentId]) {
      map[n.parentId].children.push(map[n.id]);
    } else {
      roots.push(map[n.id]);
    }
  });
  return roots;
}

function TreeView({ nodes, onSelect, activeId }: { nodes: TreeNode[]; onSelect: (id: string) => void; activeId?: string }) {
  return (
    <div className="space-y-3">
      {nodes.map((node) => (
        <div key={node.id} className="border border-white/10 rounded-xl p-3 bg-white/5">
          <div className="flex items-start justify-between">
            <div>
              <button
                className={`text-left text-slate-50 font-semibold hover:text-cyan-200 ${activeId === node.id ? "underline" : ""}`}
                onClick={() => onSelect(node.id)}
              >
                {node.title}
              </button>
              <div className="flex gap-2 mt-1 flex-wrap text-xs text-slate-300">
                <NodeBadge label={node.status} />
                {node.group && <span className="badge bg-indigo-900/40 text-indigo-100">{node.group}</span>}
              </div>
            </div>
            <div className="text-xs text-slate-400">{node.activatedAt ? `Active since ${node.activatedAt}` : `Drafted ${node.createdAt.slice(0, 10)}`}</div>
          </div>
          {node.children.length > 0 && (
            <div className="ml-4 mt-2 border-l border-white/10 pl-3 space-y-2">
              <TreeView nodes={node.children} onSelect={onSelect} activeId={activeId} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function pill(label: string) {
  return <span className="px-3 py-1 rounded-full text-xs bg-white/10 text-slate-50">{label}</span>;
}

function App() {
  const [date, setDate] = useState(todayISO());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [nodes, setNodes] = useState<RSIPNode[]>([]);
  const [events, setEvents] = useState<RSIPEvent[]>([]);
  const [summary, setSummary] = useState<TodaySummary | null>(null);
  const [journal, setJournal] = useState<JournalEntry | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | undefined>();
  const [taskTitle, setTaskTitle] = useState("");
  const [newNode, setNewNode] = useState({ title: "", parentId: "", group: "" });
  const [journalContent, setJournalContent] = useState("");
  const [journalTitle, setJournalTitle] = useState("");
  const [error, setError] = useState<string | null>(null);

  const tree = useMemo(() => buildTree(nodes), [nodes]);
  const selectedNodeData = nodes.find((n) => n.id === selectedNode) || null;

  const refresh = async () => {
    try {
      setError(null);
      const [taskData, nodeData, summaryData, journalData] = await Promise.all([
        PlannerAPI.tasks(date),
        PlannerAPI.nodes(),
        PlannerAPI.summary(),
        PlannerAPI.journal(date),
      ]);
      setTasks(taskData);
      setNodes(nodeData);
      setSummary(summaryData);
      setJournal(journalData);
      setJournalTitle(journalData?.title || "");
      setJournalContent(journalData?.content || "");
    } catch (e: any) {
      setError(e.message);
    }
  };

  useEffect(() => {
    refresh();
  }, [date]);

  useEffect(() => {
    if (selectedNode) {
      PlannerAPI.events(selectedNode).then(setEvents).catch(() => setEvents([]));
    }
  }, [selectedNode]);

  const handleAddTask = async () => {
    if (!taskTitle.trim()) return;
    await PlannerAPI.createTask({ title: taskTitle, date });
    setTaskTitle("");
    refresh();
  };

  const toggleComplete = async (task: Task) => {
    if (task.status === "completed") {
      await PlannerAPI.updateTask(task.id, { status: "pending" });
    } else {
      await PlannerAPI.completeTask(task.id);
    }
    refresh();
  };

  const removeTask = async (task: Task) => {
    await PlannerAPI.deleteTask(task.id);
    refresh();
  };

  const handleCreateNode = async () => {
    if (!newNode.title.trim()) return;
    await PlannerAPI.createNode({ title: newNode.title, parentId: newNode.parentId || null, group: newNode.group });
    setNewNode({ title: "", parentId: "", group: "" });
    refresh();
  };

  const handleActivate = async () => {
    if (!selectedNode) return;
    await PlannerAPI.activateNode(selectedNode, date);
    refresh();
  };

  const handleFail = async () => {
    if (!selectedNode) return;
    await PlannerAPI.failNode(selectedNode, { date });
    refresh();
  };

  const saveJournal = async () => {
    await PlannerAPI.upsertJournal({ date, title: journalTitle, content: journalContent });
    refresh();
  };

  const pending = tasks.filter((t) => t.status === "pending");
  const completed = tasks.filter((t) => t.status === "completed");

  return (
    <div className="min-h-screen text-slate-50">
      <div className="max-w-7xl mx-auto px-6 py-10 space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-cyan-200">RSIP Planner</p>
            <h1 className="text-3xl font-bold mt-1">Focus on today while steering the tree</h1>
          </div>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-slate-50"
          />
        </header>

        {error && <div className="glass border border-rose-400/50 text-rose-100 px-4 py-3 rounded-lg">{error}</div>}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <SectionCard title="Today" action={pill(formatDateHuman(date))}>
            {summary ? (
              <div className="grid grid-cols-2 gap-3 text-slate-200">
                <div className="bg-white/5 rounded-xl p-3">
                  <p className="text-xs text-slate-400">Pending Tasks</p>
                  <p className="text-3xl font-semibold text-amber-200">{summary.pendingTasks}</p>
                </div>
                <div className="bg-white/5 rounded-xl p-3">
                  <p className="text-xs text-slate-400">Completed</p>
                  <p className="text-3xl font-semibold text-emerald-200">{summary.completedTasks}</p>
                </div>
                <div className="bg-white/5 rounded-xl p-3">
                  <p className="text-xs text-slate-400">Active Policies</p>
                  <p className="text-3xl font-semibold text-cyan-200">{summary.activeNodes}</p>
                </div>
                <div className="bg-white/5 rounded-xl p-3">
                  <p className="text-xs text-slate-400">Activation Slot</p>
                  <p className="text-lg font-semibold">{summary.activatedToday ? "Already used" : "Available"}</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-300">Loading summary...</p>
            )}
          </SectionCard>

          <SectionCard title="Quick Task" action={pill("Daily todo")}> 
            <div className="space-y-3">
              <input
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                placeholder="What needs to happen today?"
                className="w-full rounded-lg bg-white/10 border border-white/20 px-3 py-2"
              />
              <button
                onClick={handleAddTask}
                className="w-full bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-semibold py-2 rounded-lg"
              >
                Add Task
              </button>
            </div>
          </SectionCard>

          <SectionCard title="New RSIP Draft" action={pill("Tree seed")}> 
            <div className="space-y-3">
              <input
                value={newNode.title}
                onChange={(e) => setNewNode({ ...newNode, title: e.target.value })}
                placeholder="Policy title"
                className="w-full rounded-lg bg-white/10 border border-white/20 px-3 py-2"
              />
              <input
                value={newNode.group}
                onChange={(e) => setNewNode({ ...newNode, group: e.target.value })}
                placeholder="Group (optional)"
                className="w-full rounded-lg bg-white/10 border border-white/20 px-3 py-2"
              />
              <select
                value={newNode.parentId}
                onChange={(e) => setNewNode({ ...newNode, parentId: e.target.value })}
                className="w-full rounded-lg bg-white/10 border border-white/20 px-3 py-2"
              >
                <option value="">Root</option>
                {nodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.title}
                  </option>
                ))}
              </select>
              <button
                onClick={handleCreateNode}
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-semibold py-2 rounded-lg"
              >
                Save Draft
              </button>
            </div>
          </SectionCard>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SectionCard title="Daily Tasks">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-300">{pending.length} pending</span>
                <span className="text-sm text-slate-400">{completed.length} completed</span>
              </div>
              <div className="space-y-2">
                {pending.map((task) => (
                  <div key={task.id} className="flex items-start justify-between bg-white/5 rounded-xl p-3 border border-white/10">
                    <div>
                      <p className="font-semibold text-slate-50">{task.title}</p>
                      {task.description && <p className="text-sm text-slate-300">{task.description}</p>}
                    </div>
                    <div className="flex gap-2">
                      <button className="text-emerald-300" onClick={() => toggleComplete(task)}>
                        Complete
                      </button>
                      <button className="text-rose-300" onClick={() => removeTask(task)}>
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
                {pending.length === 0 && <p className="text-sm text-slate-400">No pending tasks.</p>}
              </div>
              {completed.length > 0 && (
                <div className="mt-4 border-t border-white/10 pt-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400 mb-2">Completed</p>
                  <div className="space-y-2">
                    {completed.map((task) => (
                      <div key={task.id} className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2">
                        <span className="text-slate-300 line-through">{task.title}</span>
                        <button className="text-cyan-200 text-sm" onClick={() => toggleComplete(task)}>
                          Undo
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </SectionCard>

          <SectionCard title="Journal">
            <div className="space-y-3">
              <input
                value={journalTitle}
                onChange={(e) => setJournalTitle(e.target.value)}
                placeholder="Title"
                className="w-full rounded-lg bg-white/10 border border-white/20 px-3 py-2"
              />
              <textarea
                value={journalContent}
                onChange={(e) => setJournalContent(e.target.value)}
                placeholder="Capture reflections, wins, and blockers."
                className="w-full rounded-lg bg-white/10 border border-white/20 px-3 py-3 min-h-[180px]"
              />
              <div className="flex justify-end">
                <button onClick={saveJournal} className="bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-semibold px-4 py-2 rounded-lg">
                  Save journal
                </button>
              </div>
              {journal && <p className="text-xs text-slate-400">Last updated {new Date(journal.updatedAt).toLocaleTimeString()}</p>}
            </div>
          </SectionCard>
        </div>

        <SectionCard title="RSIP Tree">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <TreeView nodes={tree} onSelect={setSelectedNode} activeId={selectedNode} />
            </div>
            <div className="bg-white/5 rounded-2xl p-4 border border-white/10 min-h-[320px]">
              {selectedNodeData ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <h3 className="text-xl font-semibold">{selectedNodeData.title}</h3>
                    <NodeBadge label={selectedNodeData.status} />
                  </div>
                  <p className="text-sm text-slate-300">{selectedNodeData.description || "No description yet."}</p>
                  <div className="flex flex-wrap gap-2 text-sm text-slate-200">
                    {selectedNodeData.group && pill(selectedNodeData.group)}
                    {selectedNodeData.activatedAt && pill(`Activated ${selectedNodeData.activatedAt}`)}
                    {selectedNodeData.extinguishedAt && pill(`Extinguished ${selectedNodeData.extinguishedAt}`)}
                  </div>
                  <div className="flex gap-3">
                    {selectedNodeData.status === "draft" && (
                      <button onClick={handleActivate} className="bg-emerald-500 hover:bg-emerald-400 text-slate-900 px-4 py-2 rounded-lg">
                        Activate for {date}
                      </button>
                    )}
                    {selectedNodeData.status === "active" && (
                      <button onClick={handleFail} className="bg-rose-500 hover:bg-rose-400 text-slate-900 px-4 py-2 rounded-lg">
                        Mark failure today
                      </button>
                    )}
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400 mb-2">Recent Events</p>
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {events.map((e) => (
                        <div key={e.id} className="bg-white/5 rounded-lg px-3 py-2 border border-white/10">
                          <div className="flex justify-between text-sm">
                            <span className="font-semibold capitalize">{e.type}</span>
                            <span className="text-slate-400">{e.date}</span>
                          </div>
                          {e.notes && <p className="text-xs text-slate-300 mt-1">{e.notes}</p>}
                        </div>
                      ))}
                      {events.length === 0 && <p className="text-sm text-slate-400">No events yet.</p>}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-300">Select a node to see details and actions.</p>
              )}
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

export default App;
