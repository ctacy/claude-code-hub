"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { Loader2, RefreshCw } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useVirtualizedInfiniteList } from "@/hooks/use-virtualized-infinite-list";
import { getIoLogsBatch, type IoLogItem } from "@/lib/api-client/v1/actions/io-logs";
import { searchUsersForFilter } from "@/lib/api-client/v1/actions/users";

type FetchLogsFn = typeof getIoLogsBatch;
type FetchUsersFn = typeof searchUsersForFilter;
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/utils/date-format";
import { IoLogDetailSheet } from "./io-log-detail-sheet";

const BATCH_SIZE = 50;
const ROW_HEIGHT = 56;
const AUTO_REFRESH_INTERVAL_MS = 5000;

function statusVariant(code: number | null): "default" | "destructive" | "outline" | "secondary" {
  if (!code) return "outline";
  if (code >= 200 && code < 300) return "default";
  if (code >= 400) return "destructive";
  return "secondary";
}

function truncate(str: string | null | undefined, max = 80): string {
  if (!str) return "—";
  return str.length <= max ? str : `${str.slice(0, max)}…`;
}

function requestPreview(body: string | null): string {
  if (!body) return "—";
  return truncate(body);
}

export function IoLogsView({
  fetchLogs = getIoLogsBatch,
  fetchUsers = searchUsersForFilter,
}: {
  fetchLogs?: FetchLogsFn;
  fetchUsers?: FetchUsersFn;
} = {}) {
  const t = useTranslations("ioLogs");
  const locale = useLocale();
  const [selectedLog, setSelectedLog] = useState<IoLogItem | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);

  // Filter inputs (draft) vs applied filters (drive the query)
  const [userNameInput, setUserNameInput] = useState("");
  const [startTimeInput, setStartTimeInput] = useState("");
  const [endTimeInput, setEndTimeInput] = useState("");
  const [keywordInput, setKeywordInput] = useState("");
  const [filters, setFilters] = useState<{
    userName: string;
    startTime: string;
    endTime: string;
    keyword: string;
  }>({ userName: "", startTime: "", endTime: "", keyword: "" });

  // User options for the filter dropdown (value = userName snapshot)
  const [userOptions, setUserOptions] = useState<string[]>([]);
  useEffect(() => {
    let alive = true;
    void fetchUsers(undefined, 500).then((result) => {
      if (!alive || !result.ok) return;
      // Dedupe by name; filter snapshots are matched by name
      setUserOptions([...new Set(result.data.map((u) => u.name))]);
    });
    return () => {
      alive = false;
    };
  }, []);

  // datetime-local (no tz) → ISO string with offset; empty → null
  const toIso = (v: string): string | null => (v ? new Date(v).toISOString() : null);

  const applyFilters = useCallback(() => {
    setFilters({
      userName: userNameInput.trim(),
      startTime: startTimeInput,
      endTime: endTimeInput,
      keyword: keywordInput.trim(),
    });
  }, [userNameInput, startTimeInput, endTimeInput, keywordInput]);

  const resetFilters = useCallback(() => {
    setUserNameInput("");
    setStartTimeInput("");
    setEndTimeInput("");
    setKeywordInput("");
    setFilters({ userName: "", startTime: "", endTime: "", keyword: "" });
  }, []);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useInfiniteQuery({
    queryKey: ["io-logs-batch", filters],
    queryFn: async ({ pageParam }) => {
      const result = await fetchLogs({
        cursor: pageParam ?? null,
        limit: BATCH_SIZE,
        userName: filters.userName || null,
        startTime: toIso(filters.startTime),
        endTime: toIso(filters.endTime),
        keyword: filters.keyword || null,
      });
      if (!result.ok) throw new Error(result.error ?? "Failed to fetch I/O logs");
      return result.data;
    },
    getNextPageParam: (lastPage) => lastPage.pageInfo.nextCursor ?? undefined,
    initialPageParam: undefined as string | undefined,
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  });

  // 自动刷新：开启后每 5s 拉取最新一页（refetch 只重取已加载分页的第一页起，回到最新数据）
  useEffect(() => {
    if (!autoRefresh) return;
    const timer = setInterval(() => {
      void refetch();
    }, AUTO_REFRESH_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [autoRefresh, refetch]);

  const pages = data?.pages;
  const rows = useMemo(() => pages?.flatMap((p) => p.items) ?? [], [pages]);

  const getItemKey = useCallback((index: number) => rows[index]?.id ?? `loader-${index}`, [rows]);

  const { parentRef, rowVirtualizer, virtualItems, handleScroll } = useVirtualizedInfiniteList({
    itemCount: rows.length + (hasNextPage ? 1 : 0),
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
    getItemKey,
  });

  const openDetail = (log: IoLogItem) => {
    setSelectedLog(log);
    setDetailOpen(true);
  };

  return (
    <div className="space-y-4">
      {/* Toolbar: 筛选条件 + 手动刷新 + 5s 自动刷新（同一行） */}
      <div className="flex items-end gap-3 overflow-x-auto">
        <div className="flex flex-col gap-1 shrink-0">
          <label htmlFor="io-logs-filter-user" className="text-xs text-muted-foreground">
            {t("columns.user")}
          </label>
          <Select
            value={userNameInput || "__all__"}
            onValueChange={(v) => setUserNameInput(v === "__all__" ? "" : v)}
          >
            <SelectTrigger id="io-logs-filter-user" className="h-8 w-40">
              <SelectValue placeholder={t("filters.allUsers")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{t("filters.allUsers")}</SelectItem>
              {userOptions.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="io-logs-filter-keyword" className="text-xs text-muted-foreground">
            {t("filters.keyword")}
          </label>
          <Input
            id="io-logs-filter-keyword"
            type="text"
            placeholder={t("filters.keywordPlaceholder")}
            value={keywordInput}
            onChange={(e) => setKeywordInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyFilters()}
            className="h-8 w-48"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="io-logs-filter-start" className="text-xs text-muted-foreground">
            {t("filters.startTime")}
          </label>
          <Input
            id="io-logs-filter-start"
            type="datetime-local"
            value={startTimeInput}
            onChange={(e) => setStartTimeInput(e.target.value)}
            className="h-8 w-52"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="io-logs-filter-end" className="text-xs text-muted-foreground">
            {t("filters.endTime")}
          </label>
          <Input
            id="io-logs-filter-end"
            type="datetime-local"
            value={endTimeInput}
            onChange={(e) => setEndTimeInput(e.target.value)}
            className="h-8 w-52"
          />
        </div>
        <Button variant="default" size="sm" onClick={applyFilters}>
          {t("filters.apply")}
        </Button>
        <Button variant="ghost" size="sm" onClick={resetFilters}>
          {t("filters.reset")}
        </Button>
        <div className="flex-1" />
        <div className="flex items-center gap-4 shrink-0">
          <div className="flex items-center gap-2">
            <Switch
              id="io-logs-auto-refresh"
              checked={autoRefresh}
              onCheckedChange={setAutoRefresh}
            />
            <label
              htmlFor="io-logs-auto-refresh"
              className="text-sm text-muted-foreground cursor-pointer select-none"
            >
              {t("autoRefresh")}
            </label>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void refetch()}
            disabled={isRefetching}
          >
            <RefreshCw className={cn("h-4 w-4 mr-1.5", isRefetching && "animate-spin")} />
            {t("refresh")}
          </Button>
        </div>
      </div>

      <div className="rounded-md border">
        {/* Header */}
        <div className="bg-muted/30 border-b sticky top-0 z-10">
          <div className="flex items-center h-9 text-xs font-medium text-muted-foreground/80 tracking-wide">
            <div className="flex-[0.9] min-w-[150px] pl-3 truncate">{t("columns.time")}</div>
            <div className="flex-[0.7] min-w-[60px] px-1.5 truncate">{t("columns.requestId")}</div>
            <div className="flex-[0.5] min-w-[60px] px-1.5 truncate">{t("columns.user")}</div>
            <div className="flex-[0.5] min-w-[60px] px-1.5 truncate">{t("columns.token")}</div>
            <div className="flex-[1.0] min-w-[120px] px-1.5 truncate">{t("columns.model")}</div>
            <div className="flex-[0.5] min-w-[60px] px-1.5 truncate">{t("columns.status")}</div>
            <div className="flex-[2.5] min-w-[200px] px-1.5 pr-3 truncate">
              {t("columns.requestPreview")}
            </div>
          </div>
        </div>

        {/* Body */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : isError ? (
          <div className="text-center py-8 text-destructive">
            {error instanceof Error ? error.message : t("loadError")}
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">{t("empty")}</div>
        ) : (
          <div ref={parentRef} className="h-[600px] overflow-auto" onScroll={handleScroll}>
            <div
              style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
                width: "100%",
                position: "relative",
              }}
            >
              {virtualItems.map((virtualRow) => {
                const isLoaderRow = virtualRow.index >= rows.length;
                const log = rows[virtualRow.index];

                if (isLoaderRow) {
                  return (
                    <div
                      key="loader"
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        height: `${virtualRow.size}px`,
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                      className="flex items-center justify-center"
                    >
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  );
                }

                return (
                  <div
                    key={log.id}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                    className={cn(
                      "flex items-center text-sm border-b border-border/40 transition-colors hover:bg-accent/50 cursor-pointer"
                    )}
                    onClick={() => openDetail(log)}
                  >
                    <div className="flex-[0.9] min-w-[150px] font-mono text-xs pl-3 truncate">
                      {formatDate(log.createdAt, "yyyy-MM-dd HH:mm:ss", locale)}
                    </div>
                    <div className="flex-[0.7] min-w-[60px] px-1.5 font-mono text-xs truncate text-muted-foreground">
                      #{log.requestId}
                    </div>
                    <div
                      className="flex-[0.5] min-w-[60px] px-1.5 text-xs truncate"
                      title={log.userName ?? ""}
                    >
                      {log.userName ?? <span className="text-muted-foreground">—</span>}
                    </div>
                    <div
                      className="flex-[0.5] min-w-[60px] px-1.5 text-xs truncate text-muted-foreground"
                      title={log.keyName ?? ""}
                    >
                      {log.keyName ?? "—"}
                    </div>
                    <div
                      className="flex-[1.0] min-w-[120px] px-1.5 truncate"
                      title={log.originalModel ?? log.model ?? ""}
                    >
                      {(log.originalModel ?? log.model) ? (
                        <Badge variant="secondary" className="text-[10px] max-w-full truncate">
                          {log.originalModel ?? log.model}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </div>
                    <div className="flex-[0.5] min-w-[60px] px-1.5">
                      {log.statusCode ? (
                        <Badge variant={statusVariant(log.statusCode)} className="text-[10px]">
                          {log.statusCode}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </div>
                    <div
                      className="flex-[2.5] min-w-[200px] px-1.5 pr-3 font-mono text-xs truncate text-muted-foreground"
                      title={
                        log.requestBody ? JSON.stringify(log.requestBody).slice(0, 200) : undefined
                      }
                    >
                      {requestPreview(log.requestBody)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <IoLogDetailSheet log={selectedLog} open={detailOpen} onOpenChange={setDetailOpen} />
    </div>
  );
}
