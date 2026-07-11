"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface SummaryGroup {
  id: number;
  name: string;
  groupTag: string | null;
  model: string | null;
  sortOrder: number;
  enabled: boolean;
}

function GroupRow({
  group,
  availableTags,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}: {
  group: SummaryGroup;
  availableTags: string[];
  onUpdate: (id: number, data: Partial<SummaryGroup>) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  onMoveUp: (id: number) => void;
  onMoveDown: (id: number) => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(group.name);
  const [groupTag, setGroupTag] = useState(group.groupTag ?? "");
  const [model, setModel] = useState(group.model ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    await onUpdate(group.id, {
      name: name.trim() || group.name,
      groupTag: groupTag.trim() || null,
      model: model.trim() || null,
    });
    setSaving(false);
    setEditing(false);
  }

  return (
    <div className="border rounded-md p-3 space-y-2 bg-background">
      <div className="flex items-center gap-2">
        <div className="flex flex-col gap-0.5 mr-1">
          <button
            onClick={() => onMoveUp(group.id)}
            disabled={isFirst}
            className="text-muted-foreground hover:text-foreground disabled:opacity-30 text-xs leading-none"
            title="上移"
          >
            ▲
          </button>
          <button
            onClick={() => onMoveDown(group.id)}
            disabled={isLast}
            className="text-muted-foreground hover:text-foreground disabled:opacity-30 text-xs leading-none"
            title="下移"
          >
            ▼
          </button>
        </div>

        {editing ? (
          <>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-7 w-28 text-sm"
              placeholder="分组名称"
            />
            <select
              value={groupTag}
              onChange={(e) => setGroupTag(e.target.value)}
              className="h-7 rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="">（不限 groupTag）</option>
              {availableTags.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <Input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="h-7 flex-1 text-sm font-mono"
              placeholder="模型名（留空用默认）"
            />
            <Button size="sm" className="h-7 text-xs" onClick={save} disabled={saving}>
              {saving ? "…" : "保存"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={() => {
                setName(group.name);
                setGroupTag(group.groupTag ?? "");
                setModel(group.model ?? "");
                setEditing(false);
              }}
            >
              取消
            </Button>
          </>
        ) : (
          <>
            <span className="text-sm font-medium w-28 truncate">{group.name}</span>
            <span className="text-xs text-muted-foreground w-32 truncate font-mono">
              {group.groupTag ?? "不限 groupTag"}
            </span>
            <span className="text-xs text-muted-foreground flex-1 truncate font-mono">
              {group.model ?? "默认模型"}
            </span>
            <button
              onClick={() => onUpdate(group.id, { enabled: !group.enabled })}
              className={`text-xs px-2 py-0.5 rounded border ${
                group.enabled
                  ? "border-green-500 text-green-600"
                  : "border-muted text-muted-foreground"
              }`}
              title="切换启用状态"
            >
              {group.enabled ? "启用" : "停用"}
            </button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={() => setEditing(true)}
            >
              编辑
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs text-destructive hover:text-destructive"
              onClick={() => onDelete(group.id)}
            >
              删除
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

export default function PortalSettingsPage() {
  const [prompt, setPrompt] = useState("");
  const [defaultPrompt, setDefaultPrompt] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [groups, setGroups] = useState<SummaryGroup[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [newName, setNewName] = useState("");
  const [newTag, setNewTag] = useState("");
  const [newModel, setNewModel] = useState("");
  const [addingGroup, setAddingGroup] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/portal/settings").then((r) => r.json()),
      fetch("/api/portal/settings/groups").then((r) => r.json()),
      fetch("/api/portal/providers/group-tags").then((r) => r.json()),
    ])
      .then(([settings, groupsData, tagsData]) => {
        setDefaultPrompt(settings.defaultPrompt ?? "");
        setPrompt(settings.prompt ?? "");
        setGroups((groupsData.groups as SummaryGroup[]) ?? []);
        setAvailableTags((tagsData.tags as string[]) ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function savePrompt() {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/portal/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      let data: Record<string, unknown> = {};
      try {
        data = await res.json();
      } catch {
        setMsg(`保存失败：服务器返回了无效响应 (${res.status})`);
        return;
      }
      setMsg(res.ok ? "保存成功" : `保存失败：${(data.error as string) ?? res.statusText}`);
    } catch (e) {
      setMsg(`请求异常：${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSaving(false);
    }
  }

  async function addGroup() {
    if (!newName.trim()) return;
    setAddingGroup(true);
    try {
      const res = await fetch("/api/portal/settings/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          groupTag: newTag.trim() || null,
          model: newModel.trim() || null,
          sortOrder: groups.length,
        }),
      });
      if (res.ok) {
        const { group } = (await res.json()) as { group: SummaryGroup };
        setGroups((prev) => [...prev, group]);
        setNewName("");
        setNewTag("");
        setNewModel("");
      }
    } finally {
      setAddingGroup(false);
    }
  }

  async function updateGroup(id: number, data: Partial<SummaryGroup>) {
    const res = await fetch("/api/portal/settings/groups", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...data }),
    });
    if (res.ok) {
      const { group } = (await res.json()) as { group: SummaryGroup };
      setGroups((prev) => prev.map((g) => (g.id === id ? group : g)));
    }
  }

  async function deleteGroup(id: number) {
    const res = await fetch(`/api/portal/settings/groups?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      setGroups((prev) => prev.filter((g) => g.id !== id));
    }
  }

  function moveGroup(id: number, dir: "up" | "down") {
    const idx = groups.findIndex((g) => g.id === id);
    if (idx === -1) return;
    const newGroups = [...groups];
    const swapIdx = dir === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= newGroups.length) return;
    [newGroups[idx], newGroups[swapIdx]] = [newGroups[swapIdx], newGroups[idx]];
    const reordered = newGroups.map((g, i) => ({ ...g, sortOrder: i }));
    setGroups(reordered);
    fetch("/api/portal/settings/groups", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reorder: reordered.map(({ id, sortOrder }) => ({ id, sortOrder })) }),
    });
  }

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">设置</h1>
        <p className="mt-1 text-sm text-muted-foreground">配置工作总结生成分组、模型和提示词。</p>
      </div>

      {/* 分组配置 */}
      <div className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold">Provider 分组</h2>
          <p className="text-xs text-muted-foreground mt-1">
            按优先级顺序穷举各分组内的 Provider。无分组时使用内置双层（Claude → Codex）。 groupTag
            为空则不限制，选取任意可用 Provider。
          </p>
        </div>

        {loading ? (
          <p className="text-xs text-muted-foreground">加载中…</p>
        ) : groups.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">
            尚无分组配置，使用内置 Claude → Codex 兜底。
          </p>
        ) : (
          <div className="space-y-2">
            {groups.map((g, i) => (
              <GroupRow
                key={g.id}
                group={g}
                availableTags={availableTags}
                onUpdate={updateGroup}
                onDelete={deleteGroup}
                onMoveUp={(id) => moveGroup(id, "up")}
                onMoveDown={(id) => moveGroup(id, "down")}
                isFirst={i === 0}
                isLast={i === groups.length - 1}
              />
            ))}
          </div>
        )}

        {/* 新增分组 */}
        <div className="flex items-center gap-2 pt-1">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="分组名称"
            className="h-8 w-28 text-sm"
            disabled={loading}
          />
          <select
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            className="h-8 rounded-md border border-input bg-background px-2 text-sm"
            disabled={loading}
          >
            <option value="">（不限 groupTag）</option>
            {availableTags.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <Input
            value={newModel}
            onChange={(e) => setNewModel(e.target.value)}
            placeholder="模型名（留空默认）"
            className="h-8 flex-1 text-sm font-mono"
            disabled={loading}
          />
          <Button
            size="sm"
            className="h-8"
            onClick={addGroup}
            disabled={addingGroup || loading || !newName.trim()}
          >
            {addingGroup ? "…" : "添加分组"}
          </Button>
        </div>
      </div>

      {/* 提示词 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">工作总结提示词</h2>
          <span className="text-xs text-muted-foreground">
            可用变量：<code className="bg-muted px-1 rounded">{"{userName}"}</code>{" "}
            <code className="bg-muted px-1 rounded">{"{date}"}</code>{" "}
            <code className="bg-muted px-1 rounded">{"{requestCount}"}</code>{" "}
            <code className="bg-muted px-1 rounded">{"{logsText}"}</code>
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          留空则使用内置默认提示词。修改后下次汇总时生效。
        </p>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          disabled={loading}
          rows={16}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          placeholder={loading ? "加载中…" : "留空使用内置默认提示词"}
        />
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={savePrompt} disabled={saving || loading} size="sm">
          {saving ? "保存中…" : "保存提示词"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setPrompt("");
            setMsg(null);
          }}
          disabled={saving || loading}
        >
          恢复默认
        </Button>
        {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
      </div>

      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-muted-foreground">内置默认提示词（只读参考）</h3>
        <pre className="rounded-md border bg-muted/30 px-3 py-2 text-xs font-mono whitespace-pre-wrap text-muted-foreground">
          {defaultPrompt}
        </pre>
      </div>
    </div>
  );
}
