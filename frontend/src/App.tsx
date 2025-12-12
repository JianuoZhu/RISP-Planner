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

interface TreeNode extends RSIPNode {
  children: TreeNode[];
}

interface UserProfile {
  name: string;
}

const themePresets: Record<string, { name: string; background: string }> = {
  midnight: { name: "Midnight", background: "linear-gradient(145deg, #0f172a 0%, #0b253b 40%, #0b1120 100%)" },
  ocean: { name: "Ocean Breeze", background: "linear-gradient(145deg, #0e7490, #0ea5e9 45%, #022c43 90%)" },
  meadow: { name: "Fresh Meadow", background: "linear-gradient(160deg, #14532d, #22c55e 40%, #0f172a 90%)" },
  lavender: { name: "Lavender", background: "linear-gradient(160deg, #312e81, #a855f7 45%, #0f172a 95%)" },
};

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

function NodeBadge({ label }: { label: string }) {
  return <span className={`badge ${statusColors[label] || "bg-slate-800 text-slate-100"}`}>{label}</span>;
}

function SectionCard({
  title,
  children,
  action,
  subtle,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  subtle?: boolean;
}) {
  return (
    <div className={`section-card ${subtle ? "section-card-subtle" : ""}`}>
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

function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-lg section-card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-slate-50">{title}</h3>
          <button className="text-slate-300 hover:text-white" onClick={onClose}>
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function pill(label: string) {
  return <span className="px-3 py-1 rounded-full text-xs bg-white/10 text-slate-50">{label}</span>;
}

function TreeNodeItem({
  node,
  onSelect,
  activeId,
  onAddChild,
  onDelete,
}: {
  node: TreeNode;
  onSelect: (id: string) => void;
  activeId?: string;
  onAddChild: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="border border-white/10 rounded-xl p-3 bg-white/5">
      <div className="flex items-start justify-between gap-3">
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
        <div className="flex flex-col items-end gap-2 text-xs text-slate-400">
          <span>{node.activatedAt ? `Active ${node.activatedAt}` : `Draft ${node.createdAt.slice(0, 10)}`}</span>
          <div className="flex gap-2">
            <button className="text-cyan-200" onClick={() => onAddChild(node.id)}>
             ＋ Child
            </button>
            <button className="text-rose-300" onClick={() => onDelete(node.id)}>
              Delete
            </button>
          </div>
        </div>
      </div>
      {node.children.length > 0 && (
        <div className="ml-4 mt-2 border-l border-white/10 pl-3 space-y-2">
          {node.children.map((child) => (
            <TreeNodeItem
              key={child.id}
              node={child}
              onSelect={onSelect}
              activeId={activeId}
              onAddChild={onAddChild}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TreeView({
  nodes,
  onSelect,
  activeId,
  onAddChild,
  onDelete,
}: {
  nodes: TreeNode[];
  onSelect: (id: string) => void;
  activeId?: string;
  onAddChild: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="space-y-3">
      {nodes.map((node) => (
        <TreeNodeItem
          key={node.id}
          node={node}
          onSelect={onSelect}
          activeId={activeId}
          onAddChild={onAddChild}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}

function LoginOverlay({ onLogin }: { onLogin: (profile: UserProfile) => void }) {
  const [name, setName] = useState("");
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-lg flex items-center justify-center z-50">
      <div className="section-card w-full max-w-md text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-cyan-200">RSIP Planner</p>
        <h2 className="text-2xl font-semibold text-slate-50 mt-2 mb-3">欢迎回来</h2>
        <p className="text-slate-300 mb-4">请输入用户名开始使用，账户信息存储在本地。</p>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          className="w-full rounded-lg bg-white/10 border border-white/20 px-3 py-2 text-slate-50"
        />
        <button
          onClick={() => name.trim() && onLogin({ name: name.trim() })}
          className="w-full bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-semibold py-2 rounded-lg mt-3"
        >
          登录
        </button>
      </div>
    </div>
  );
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
  const [newNode, setNewNode] = useState({ title: "", parentId: "", group: "", description: "" });
  const [journalContent, setJournalContent] = useState("");
  const [journalTitle, setJournalTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState<"summary" | "tasks" | "rsip" | "settings">("summary");
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskForm, setTaskForm] = useState({ title: "", description: "", date: todayISO() });
  const [user, setUser] = useState<UserProfile | null>(null);
  const [themeKey, setThemeKey] = useState<string>(() => localStorage.getItem("rsip_theme_key") || "midnight");
  const [panelAlpha, setPanelAlpha] = useState<number>(() => Number(localStorage.getItem("rsip_panel_alpha") || 0.08));

  const tree = useMemo(() => buildTree(nodes), [nodes]);
  const selectedNodeData = nodes.find((n) => n.id === selectedNode) || null;
  const theme = themePresets[themeKey] || themePresets.midnight;

  const applyTheme = () => {
    document.documentElement.style.setProperty("--panel-alpha", panelAlpha.toString());
    document.documentElement.style.setProperty("--app-bg", theme.background);
  };

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
    const cachedUser = localStorage.getItem("rsip_user");
    if (cachedUser) {
      setUser(JSON.parse(cachedUser));
    }
  }, []);

  useEffect(() => {
    applyTheme();
  }, [themeKey, panelAlpha]);

  useEffect(() => {
    if (user) {
      refresh();
    }
  }, [date, user]);

  useEffect(() => {
    if (selectedNode) {
      PlannerAPI.events(selectedNode).then(setEvents).catch(() => setEvents([]));
    } else {
      setEvents([]);
    }
  }, [selectedNode]);

  const handleAddTask = async () => {
    if (!taskTitle.trim()) return;
    await PlannerAPI.createTask({ title: taskTitle, date });
    setTaskTitle("");
    refresh();
  };

  const handleCreateTaskDetailed = async () => {
    if (!taskForm.title.trim()) return;
    await PlannerAPI.createTask({ title: taskForm.title, description: taskForm.description, date: taskForm.date });
    setShowTaskModal(false);
    setTaskForm({ title: "", description: "", date });
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
    await PlannerAPI.createNode({
      title: newNode.title,
      parentId: newNode.parentId || null,
      group: newNode.group || undefined,
      description: newNode.description || undefined,
    });
    setNewNode({ title: "", parentId: "", group: "", description: "" });
    refresh();
  };

  const handleDeleteNode = async (id: string) => {
    await PlannerAPI.deleteNode(id);
    if (selectedNode === id) setSelectedNode(undefined);
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

  const handleLogin = (profile: UserProfile) => {
    setUser(profile);
    localStorage.setItem("rsip_user", JSON.stringify(profile));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem("rsip_user");
  };

  const navItems: { key: typeof page; label: string; icon: string }[] = [
    { key: "summary", label: "概览", icon: "🏠" },
    { key: "tasks", label: "任务", icon: "🧭" },
    { key: "rsip", label: "RSIP 树", icon: "🌳" },
  ];

  return (
    <div className="min-h-screen" style={{ background: theme.background }}>
      {!user && <LoginOverlay onLogin={handleLogin} />}
      <div className="flex min-h-screen text-slate-50">
        <aside className="sidebar">
          <div>
            <div className="flex items-center gap-3 mb-8">
              <div className="h-10 w-10 rounded-xl bg-cyan-500/30 flex items-center justify-center text-2xl">🌊</div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-cyan-200">RSIP Planner</p>
                <p className="text-sm text-slate-200">{user ? `${user.name}的空间` : "未登录"}</p>
              </div>
            </div>
            <nav className="space-y-2">
              {navItems.map((item) => (
                <button
                  key={item.key}
                  className={`nav-item ${page === item.key ? "nav-item-active" : ""}`}
                  onClick={() => setPage(item.key)}
                >
                  <span className="text-lg">{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              ))}
            </nav>
          </div>
          <div className="mt-auto">
            <button className={`nav-item ${page === "settings" ? "nav-item-active" : ""}`} onClick={() => setPage("settings")}>
              <span className="text-lg">⚙️</span>
              <span>设置</span>
            </button>
          </div>
        </aside>

        <main className="flex-1 p-6 md:p-10 space-y-6">
          <header className="flex flex-wrap gap-4 items-center justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-cyan-200">{page === "summary" ? "Daily Compass" : "Workspace"}</p>
              <h1 className="text-3xl font-bold mt-1">{user ? `${user.name} 的仪表盘` : "个人仪表盘"}</h1>
            </div>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-slate-50"
            />
          </header>

          {error && <div className="glass border border-rose-400/50 text-rose-100 px-4 py-3 rounded-lg">{error}</div>}

          {page === "summary" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <SectionCard title="Today" action={pill(formatDateHuman(date))} subtle>
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

              <SectionCard title="RSIP Tree Preview">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <TreeView
                      nodes={tree}
                      onSelect={setSelectedNode}
                      activeId={selectedNode}
                      onAddChild={(id) => setNewNode({ ...newNode, parentId: id })}
                      onDelete={handleDeleteNode}
                    />
                  </div>
                  <div className="bg-white/5 rounded-2xl p-4 border border-white/10 min-h-[280px]">
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
                        <div className="flex gap-3 flex-wrap">
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
                          <button onClick={() => handleDeleteNode(selectedNodeData.id)} className="bg-white/10 border border-white/20 px-4 py-2 rounded-lg text-slate-100">
                            Delete
                          </button>
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
          )}

          {page === "tasks" && (
            <div className="space-y-6">
              <div className="flex flex-wrap gap-3 items-center justify-between">
                <h2 className="text-2xl font-semibold">任务列表</h2>
                <div className="flex gap-3">
                  <button className="bg-cyan-500 hover:bg-cyan-400 text-slate-900 px-4 py-2 rounded-lg" onClick={() => setShowTaskModal(true)}>
                    添加任务
                  </button>
                  <button className="bg-white/10 border border-white/20 px-4 py-2 rounded-lg" onClick={handleAddTask} disabled={!taskTitle}>
                    快速添加: {taskTitle || "(标题)"}
                  </button>
                </div>
              </div>
              <SectionCard title="未完成">
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
              </SectionCard>

              <SectionCard title="已完成" subtle>
                <div className="space-y-2">
                  {completed.map((task) => (
                    <div key={task.id} className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2">
                      <span className="text-slate-300 line-through">{task.title}</span>
                      <button className="text-cyan-200 text-sm" onClick={() => toggleComplete(task)}>
                        Undo
                      </button>
                    </div>
                  ))}
                  {completed.length === 0 && <p className="text-sm text-slate-400">No completed tasks yet.</p>}
                </div>
              </SectionCard>

              <SectionCard title="今天的日记">
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
                  <div className="flex justify-end gap-3">
                    <button onClick={saveJournal} className="bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-semibold px-4 py-2 rounded-lg">
                      Save journal
                    </button>
                  </div>
                  {journal && <p className="text-xs text-slate-400">Last updated {new Date(journal.updatedAt).toLocaleTimeString()}</p>}
                </div>
              </SectionCard>

              <Modal open={showTaskModal} onClose={() => setShowTaskModal(false)} title="添加任务">
                <div className="space-y-3">
                  <input
                    value={taskForm.title}
                    onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                    placeholder="任务标题"
                    className="w-full rounded-lg bg-white/10 border border-white/20 px-3 py-2"
                  />
                  <textarea
                    value={taskForm.description}
                    onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                    placeholder="任务描述"
                    className="w-full rounded-lg bg-white/10 border border-white/20 px-3 py-2"
                  />
                  <input
                    type="date"
                    value={taskForm.date}
                    onChange={(e) => setTaskForm({ ...taskForm, date: e.target.value })}
                    className="w-full rounded-lg bg-white/10 border border-white/20 px-3 py-2"
                  />
                  <button onClick={handleCreateTaskDetailed} className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-semibold py-2 rounded-lg">
                    保存
                  </button>
                </div>
              </Modal>
            </div>
          )}

          {page === "rsip" && (
            <div className="space-y-6">
              <div className="flex flex-wrap gap-3 items-center justify-between">
                <h2 className="text-2xl font-semibold">RSIP 树</h2>
                <div className="flex gap-3">
                  <button className="bg-emerald-500 hover:bg-emerald-400 text-slate-900 px-4 py-2 rounded-lg" onClick={handleCreateNode}>
                    添加节点
                  </button>
                  <button className="bg-white/10 border border-white/20 px-4 py-2 rounded-lg" onClick={() => setSelectedNode(undefined)}>
                    重置选择
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <TreeView
                    nodes={tree}
                    onSelect={setSelectedNode}
                    activeId={selectedNode}
                    onAddChild={(id) => setNewNode({ ...newNode, parentId: id })}
                    onDelete={handleDeleteNode}
                  />
                </div>
                <div className="section-card section-card-subtle">
                  <h3 className="text-lg font-semibold mb-3">节点面板</h3>
                  <div className="space-y-3">
                    <input
                      value={newNode.title}
                      onChange={(e) => setNewNode({ ...newNode, title: e.target.value })}
                      placeholder="标题"
                      className="w-full rounded-lg bg-white/10 border border-white/20 px-3 py-2"
                    />
                    <textarea
                      value={newNode.description}
                      onChange={(e) => setNewNode({ ...newNode, description: e.target.value })}
                      placeholder="描述"
                      className="w-full rounded-lg bg-white/10 border border-white/20 px-3 py-2"
                    />
                    <input
                      value={newNode.group}
                      onChange={(e) => setNewNode({ ...newNode, group: e.target.value })}
                      placeholder="分组"
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
                    <button onClick={handleCreateNode} className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-semibold py-2 rounded-lg">
                      保存节点
                    </button>
                    {selectedNodeData && (
                      <button onClick={() => handleDeleteNode(selectedNodeData.id)} className="w-full bg-rose-500 hover:bg-rose-400 text-slate-900 font-semibold py-2 rounded-lg">
                        删除选中节点
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {page === "settings" && (
            <div className="space-y-6">
              <SectionCard title="主题设置">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {Object.entries(themePresets).map(([key, value]) => (
                    <button
                      key={key}
                      className={`theme-card ${themeKey === key ? "theme-card-active" : ""}`}
                      style={{ background: value.background }}
                      onClick={() => {
                        setThemeKey(key);
                        localStorage.setItem("rsip_theme_key", key);
                      }}
                    >
                      <span className="font-semibold drop-shadow-md">{value.name}</span>
                    </button>
                  ))}
                </div>
                <div className="mt-6">
                  <label className="text-sm text-slate-200 flex justify-between items-center">
                    面板透明度
                    <span className="text-cyan-200">{panelAlpha.toFixed(2)}</span>
                  </label>
                  <input
                    type="range"
                    min={0.04}
                    max={0.18}
                    step={0.01}
                    value={panelAlpha}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setPanelAlpha(val);
                      localStorage.setItem("rsip_panel_alpha", val.toString());
                    }}
                    className="w-full mt-2"
                  />
                </div>
              </SectionCard>

              <SectionCard title="账户">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-sm text-slate-300">当前用户: {user?.name || "未登录"}</p>
                    <p className="text-xs text-slate-400">信息仅存储在浏览器 localStorage</p>
                  </div>
                  <div className="flex gap-3">
                    <button
                      className="bg-white/10 border border-white/20 px-4 py-2 rounded-lg"
                      onClick={() => handleLogin({ name: prompt("输入新用户名", user?.name || "") || user?.name || "" })}
                    >
                      重命名
                    </button>
                    <button className="bg-rose-500 hover:bg-rose-400 text-slate-900 px-4 py-2 rounded-lg" onClick={handleLogout}>
                      退出登录
                    </button>
                  </div>
                </div>
              </SectionCard>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
