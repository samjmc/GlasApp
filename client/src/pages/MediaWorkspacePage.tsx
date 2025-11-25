import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";

type SavedView = {
  id: string;
  name: string;
  description: string | null;
  filters: any;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type ExportRecord = {
  id: string;
  view_id: string | null;
  requested_by: string | null;
  format: string;
  status: string;
  download_url: string | null;
  metadata: any;
  created_at: string;
  completed_at: string | null;
};

const fetchViews = async (): Promise<SavedView[]> => {
  const response = await fetch("/api/debate-workspace/views");
  if (!response.ok) {
    throw new Error("Failed to load saved views");
  }
  const payload = await response.json();
  return payload?.views ?? [];
};

const fetchExports = async (): Promise<ExportRecord[]> => {
  const response = await fetch("/api/debate-workspace/exports?limit=20");
  if (!response.ok) {
    throw new Error("Failed to load export history");
  }
  const payload = await response.json();
  return payload?.exports ?? [];
};

const MediaWorkspacePage = () => {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [formState, setFormState] = useState({
    name: "",
    description: "",
    period: "latest",
    customStart: "",
    customEnd: "",
    party: "",
    topic: "",
    chamber: "",
    requestedBy: "",
  });

  const {
    data: savedViews = [],
    isLoading: viewsLoading,
    isError: viewsError,
    error: viewsErrorObj,
  } = useQuery({
    queryKey: ["debate-workspace", "views"],
    queryFn: fetchViews,
    staleTime: 2 * 60 * 1000,
  });

  const {
    data: exports = [],
    isLoading: exportsLoading,
    isError: exportsError,
    error: exportsErrorObj,
  } = useQuery({
    queryKey: ["debate-workspace", "exports"],
    queryFn: fetchExports,
    staleTime: 2 * 60 * 1000,
  });

  const createViewMutation = useMutation({
    mutationFn: async (payload: any) => {
      const response = await fetch("/api/debate-workspace/views", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Failed to create saved view");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["debate-workspace", "views"] });
      setFormState((prev) => ({
        ...prev,
        name: "",
        description: "",
        party: "",
        topic: "",
        chamber: "",
      }));
    },
  });

  const deleteViewMutation = useMutation({
    mutationFn: async (viewId: string) => {
      const response = await fetch(`/api/debate-workspace/views/${viewId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("Failed to delete saved view");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["debate-workspace", "views"] });
    },
  });

  const exportMutation = useMutation({
    mutationFn: async (payload: { viewId?: string; filters?: any; requestedBy?: string }) => {
      const response = await fetch("/api/debate-workspace/exports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Failed to generate export");
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["debate-workspace", "exports"] });

      const base64 = data?.export?.csvBase64;
      if (base64) {
        const csv = atob(base64);
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        const period = data?.export?.period;
        const filename = period
          ? `debate-export-${period.start}-${period.end}.csv`
          : `debate-export-${Date.now()}.csv`;
        link.setAttribute("download", filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
    },
  });

  const periodOptions = useMemo(
    () => [
      { value: "latest", label: "Latest available week" },
      { value: "7d", label: "Trailing 7 days" },
      { value: "30d", label: "Trailing 30 days" },
      { value: "custom", label: "Custom range" },
    ],
    []
  );

  const computeFilters = () => {
    let period: any = "latest";
    if (formState.period === "7d" || formState.period === "30d") {
      const days = formState.period === "7d" ? 7 : 30;
      const end = new Date();
      const start = new Date();
      start.setDate(end.getDate() - days);
      period = {
        start: start.toISOString().split("T")[0],
        end: end.toISOString().split("T")[0],
      };
    } else if (formState.period === "custom" && formState.customStart && formState.customEnd) {
      period = {
        start: formState.customStart,
        end: formState.customEnd,
      };
    }

    return {
      period,
      party: formState.party || null,
      topic: formState.topic || null,
      chamber: formState.chamber || null,
    };
  };

  const handleCreateView = (event: React.FormEvent) => {
    event.preventDefault();
    if (!formState.name) return;

    createViewMutation.mutate({
      name: formState.name,
      description: formState.description,
      filters: computeFilters(),
      createdBy: formState.requestedBy || null,
    });
  };

  const runAdhocExport = () => {
    exportMutation.mutate({
      filters: computeFilters(),
      requestedBy: formState.requestedBy || null,
    });
  };

  return (
    <div className="space-y-8 p-6">
      <header className="space-y-2">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Media & Partner Workspace</h1>
          <button
            onClick={() => setLocation("/debates")}
            className="text-sm font-medium text-primary hover:text-primary/80"
          >
            ← Back to Debates
          </button>
        </div>
        <p className="text-gray-600 dark:text-gray-400 max-w-3xl">
          Curate saved views, generate CSV exports, and share consistent debate insights with partners. Saved filters
          track the latest ingest so media teams can refresh reports in a single click.
        </p>
      </header>

      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <h2 className="text-xl font-semibold mb-4">Create a saved view</h2>

        <form onSubmit={handleCreateView} className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-200">Name</label>
            <input
              type="text"
              value={formState.name}
              onChange={(event) => setFormState((prev) => ({ ...prev, name: event.target.value }))}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              placeholder="Weekly housing highlights"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-200">Owner / Contact (optional)</label>
            <input
              type="text"
              value={formState.requestedBy}
              onChange={(event) => setFormState((prev) => ({ ...prev, requestedBy: event.target.value }))}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              placeholder="media@glas.ie"
            />
          </div>

          <div className="lg:col-span-2 space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-200">Description</label>
            <textarea
              value={formState.description}
              onChange={(event) => setFormState((prev) => ({ ...prev, description: event.target.value }))}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              placeholder="Auto-refreshing housing coverage with top surging TDs."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-200">Time period</label>
            <select
              value={formState.period}
              onChange={(event) => setFormState((prev) => ({ ...prev, period: event.target.value }))}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            >
              {periodOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {formState.period === "custom" && (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-200">Start date</label>
                <input
                  type="date"
                  value={formState.customStart}
                  onChange={(event) => setFormState((prev) => ({ ...prev, customStart: event.target.value }))}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-200">End date</label>
                <input
                  type="date"
                  value={formState.customEnd}
                  onChange={(event) => setFormState((prev) => ({ ...prev, customEnd: event.target.value }))}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                  required
                />
              </div>
            </>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-200">Party filter</label>
            <input
              type="text"
              value={formState.party}
              onChange={(event) => setFormState((prev) => ({ ...prev, party: event.target.value }))}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              placeholder="e.g. Fine Gael"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-200">Topic filter</label>
            <input
              type="text"
              value={formState.topic}
              onChange={(event) => setFormState((prev) => ({ ...prev, topic: event.target.value }))}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              placeholder="e.g. Housing & Homelessness"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-200">Chamber filter</label>
            <select
              value={formState.chamber}
              onChange={(event) => setFormState((prev) => ({ ...prev, chamber: event.target.value }))}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            >
              <option value="">All</option>
              <option value="dail">Dáil</option>
              <option value="seanad">Seanad</option>
            </select>
          </div>

          <div className="lg:col-span-2 flex flex-wrap items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={createViewMutation.isLoading}
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {createViewMutation.isLoading ? "Saving…" : "Save view"}
            </button>
            <button
              type="button"
              onClick={runAdhocExport}
              disabled={exportMutation.isLoading}
              className="rounded-md border border-primary px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {exportMutation.isLoading ? "Exporting…" : "Run one-off export"}
            </button>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Exports return CSV snapshots based on the filters above and log automatically in export history.
            </p>
          </div>
        </form>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Saved views</h2>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {viewsLoading ? "Loading…" : `${savedViews.length} view${savedViews.length === 1 ? "" : "s"}`}
          </span>
        </div>
        {viewsError ? (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400">
            {viewsErrorObj instanceof Error ? viewsErrorObj.message : "Failed to load saved views"}
          </p>
        ) : savedViews.length === 0 ? (
          <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
            No saved views yet. Create one above to keep partner filters handy.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {savedViews.map((view) => (
              <article
                key={view.id}
                className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm dark:border-gray-800 dark:bg-gray-900/40"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{view.name}</h3>
                    {view.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400">{view.description}</p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-500 dark:text-gray-400">
                      <span className="rounded-full bg-gray-100 px-2 py-1 dark:bg-gray-800">
                        Period:{" "}
                        {view.filters?.period === "latest"
                          ? "Latest"
                          : `${view.filters?.period?.start ?? "?"} → ${view.filters?.period?.end ?? "?"}`}
                      </span>
                      {view.filters?.party && (
                        <span className="rounded-full bg-gray-100 px-2 py-1 dark:bg-gray-800">
                          Party: {view.filters.party}
                        </span>
                      )}
                      {view.filters?.topic && (
                        <span className="rounded-full bg-gray-100 px-2 py-1 dark:bg-gray-800">
                          Topic: {view.filters.topic}
                        </span>
                      )}
                      {view.filters?.chamber && (
                        <span className="rounded-full bg-gray-100 px-2 py-1 dark:bg-gray-800">
                          Chamber: {view.filters.chamber}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        exportMutation.mutate({
                          viewId: view.id,
                          requestedBy: view.created_by || formState.requestedBy || null,
                        })
                      }
                      className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary/90"
                    >
                      Export CSV
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteViewMutation.mutate(view.id)}
                      className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 dark:border-red-500/40 dark:text-red-300 dark:hover:bg-red-500/10"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Export history</h2>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {exportsLoading ? "Loading…" : `${exports.length} export${exports.length === 1 ? "" : "s"}`}
          </span>
        </div>
        {exportsError ? (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400">
            {exportsErrorObj instanceof Error ? exportsErrorObj.message : "Failed to load export history"}
          </p>
        ) : exports.length === 0 ? (
          <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
            Export runs will appear here with timing, filters, and requester metadata.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-800">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  <th className="py-2 pr-4">Created</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Rows</th>
                  <th className="py-2 pr-4">Period</th>
                  <th className="py-2 pr-4">Triggered by</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {exports.map((entry) => {
                  const period = entry.metadata?.period;
                  return (
                    <tr key={entry.id} className="text-gray-700 dark:text-gray-200">
                      <td className="py-2 pr-4">
                        {new Date(entry.created_at).toLocaleString("en-IE", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="py-2 pr-4">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            entry.status === "completed"
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200"
                              : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                          }`}
                        >
                          {entry.status}
                        </span>
                      </td>
                      <td className="py-2 pr-4">{entry.metadata?.rowCount ?? "—"}</td>
                      <td className="py-2 pr-4">
                        {period ? `${period.start} → ${period.end}` : "Latest"}
                      </td>
                      <td className="py-2 pr-4">{entry.requested_by || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <footer className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <h2 className="text-lg font-semibold">Need more automation?</h2>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Pipeline hooks can push exports directly to S3 / GCS or email digests on a schedule. Let us know your
          preferred workflow and we’ll wire the partner automation during the next phase.
        </p>
        <a
          href="mailto:media@glas.ie"
          className="mt-4 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90"
        >
          Contact media support
        </a>
      </footer>
    </div>
  );
};

export default MediaWorkspacePage;

