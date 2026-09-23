// Tasks module — list, filters, search, create/edit, complete and delete.
// Follows the same structure as pages/leads/leads.js: one `state` object, a
// single render() that rebuilds the page, and every read/write going through
// the shared `api` wrapper. Nothing here is hardcoded — the list, the filter
// options and the counters all come from the API.
const state = {
  data: null,
  stats: null,
  loading: true,
  error: false,
  errorMessage: "",
  // Filter option sources
  users: [], leads: [], contacts: [], companies: [], deals: [],
  optionsLoaded: false,
  // Filters
  view: "all", search: "", status: "", priority: "", assigneeId: "",
  dueFrom: "", dueTo: "",
  sortBy: "dueDate", sortDir: "asc", page: 1,
  // Transient UI
  busyIds: new Set(),
  toast: null,
};

let mainEl;

function qs(params) {
  const usp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== "" && v !== undefined && v !== null) usp.set(k, v);
  });
  return usp.toString();
}

// --- Data loading -----------------------------------------------------

async function load() {
  state.loading = true;
  state.error = false;
  render();
  const params = qs({
    page: state.page, pageSize: 20, view: state.view, search: state.search,
    status: state.status, priority: state.priority, assigneeId: state.assigneeId,
    dueFrom: state.dueFrom, dueTo: state.dueTo,
    sortBy: state.sortBy, sortDir: state.sortDir,
  });
  try {
    const [data, stats] = await Promise.all([
      api.get(`/api/tasks?${params}`),
      api.get("/api/tasks/stats").catch(() => null),
    ]);
    state.data = data;
    if (stats) state.stats = stats;
  } catch (err) {
    state.error = true;
    state.errorMessage = err.message || "The data couldn't be loaded. Try again.";
  } finally {
    state.loading = false;
    render();
  }
}

async function refreshStats() {
  try {
    state.stats = await api.get("/api/tasks/stats");
  } catch {
    // Counters are supporting chrome; never break the page over them.
  }
}

/** Dropdown sources for the filters and the task form. */
async function loadOptions() {
  const pull = (path) => api.get(path).then((r) => r.items ?? r).catch(() => []);
  const [users, leads, contacts, companies, deals] = await Promise.all([
    pull("/api/users"),
    pull("/api/leads?page=1&pageSize=100&sortBy=createdAt&sortDir=desc"),
    pull("/api/contacts?page=1&pageSize=100&sortBy=createdAt&sortDir=desc"),
    pull("/api/companies?page=1&pageSize=100&sortBy=name&sortDir=asc"),
    pull("/api/deals?page=1&pageSize=100&sortBy=createdAt&sortDir=desc"),
  ]);
  state.users = users;
  state.leads = leads;
  state.contacts = contacts;
  state.companies = companies;
  state.deals = deals;
  state.optionsLoaded = true;
}

function showToast(message) {
  state.toast = message;
  render();
  setTimeout(() => {
    if (state.toast !== message) return;
    state.toast = null;
    render();
  }, 2600);
}

// --- Actions ----------------------------------------------------------

async function toggleComplete(id, completed) {
  state.busyIds.add(id);
  render();
  try {
    await api.patch(`/api/tasks/${id}/complete`, { completed });
    await refreshStats();
    showToast(completed ? "Task marked complete." : "Task reopened.");
    await load();
  } catch (err) {
    state.busyIds.delete(id);
    showToast(err.message || "Couldn't update the task.");
  } finally {
    state.busyIds.delete(id);
  }
}

function confirmDelete(task) {
  const root = document.getElementById("task-confirm-root");
  root.innerHTML = `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 px-4">
      <div role="dialog" aria-modal="true" class="w-full max-w-sm rounded-card border border-border bg-white shadow-lg">
        <div class="border-b border-border px-5 py-4">
          <h2 class="text-sm font-semibold text-navy">Delete task</h2>
        </div>
        <div class="space-y-2 px-5 py-4">
          <p class="text-sm text-navy">Delete &ldquo;${escapeHtml(task.title)}&rdquo;?</p>
          <p class="text-sm text-muted">This can't be undone.</p>
          <p id="confirm-error" class="hidden rounded-md border border-danger/20 bg-danger/5 px-3 py-2 text-sm text-danger"></p>
        </div>
        <div class="flex justify-end gap-2 border-t border-border px-5 py-4">
          <button type="button" id="confirm-cancel" class="rounded-md border border-border bg-white px-4 py-2 text-sm text-navy hover:bg-page">Cancel</button>
          <button type="button" id="confirm-delete" class="rounded-md bg-danger px-4 py-2 text-sm font-medium text-white hover:bg-danger/90">Delete task</button>
        </div>
      </div>
    </div>`;

  const close = () => { root.innerHTML = ""; };
  document.getElementById("confirm-cancel").addEventListener("click", close);
  document.getElementById("confirm-delete").addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    const err = document.getElementById("confirm-error");
    err.classList.add("hidden");
    btn.disabled = true;
    btn.textContent = "Deleting…";
    try {
      await api.del(`/api/tasks/${task.id}`);
      close();
      await refreshStats();
      showToast("Task deleted.");
      await load();
    } catch (ex) {
      err.textContent = ex.message || "Couldn't delete the task.";
      err.classList.remove("hidden");
      btn.disabled = false;
      btn.textContent = "Delete task";
    }
  });
}

// --- Rendering --------------------------------------------------------

function renderStats() {
  const s = state.stats;
  const cards = [
    { key: "today", label: "Due today", value: s ? s.dueToday : "—", danger: false },
    { key: "overdue", label: "Overdue", value: s ? s.overdue : "—", danger: s ? s.overdue > 0 : false },
    { key: "all", label: "Open tasks", value: s ? s.open : "—", danger: false },
    { key: "completed", label: "Completed", value: s ? s.completed : "—", danger: false },
  ];
  return `<div class="grid grid-cols-2 gap-4 md:grid-cols-4">
    ${cards.map((c) => `
      <button type="button" data-stat-view="${c.key}"
        class="rounded-card border ${state.view === c.key ? "border-action" : "border-border"} bg-surface p-5 text-left hover:border-action/60">
        <p class="text-xs font-medium uppercase tracking-wide text-muted">${c.label}</p>
        <p class="mt-2 text-2xl font-semibold tabular-nums ${c.danger ? "text-danger" : "text-navy"}">${c.value}</p>
      </button>`).join("")}
  </div>`;
}

function renderViewTabs() {
  return `<div class="flex flex-wrap gap-2">
    ${TASK_VIEWS.map((v) => `
      <button type="button" data-view="${v.key}" class="rounded-full border px-3 py-1.5 text-xs font-medium ${
        state.view === v.key ? "border-action bg-action/10 text-action" : "border-border bg-white text-muted hover:text-navy"
      }">${v.label}</button>`).join("")}
  </div>`;
}

function renderFilters() {
  const userOptions = state.users
    .map((u) => `<option value="${u.id}" ${u.id === state.assigneeId ? "selected" : ""}>${escapeHtml(u.name)}</option>`)
    .join("");
  const statusOptions = TASK_STATUSES
    .map((s) => `<option value="${s}" ${s === state.status ? "selected" : ""}>${taskStatusLabel(s)}</option>`)
    .join("");

  return `
    <div class="rounded-card border border-border bg-surface p-4">
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <div class="lg:col-span-2">
          <input id="f-search" type="search" placeholder="Search title or description…" value="${escapeHtml(state.search)}" class="${UI_INPUT_CLASS}" />
        </div>
        <select id="f-status" class="${UI_INPUT_CLASS}">
          <option value="">All statuses</option>${statusOptions}
        </select>
        <select id="f-priority" class="${UI_INPUT_CLASS}">
          <option value="">All priorities</option>${uiOptions(TASK_PRIORITIES, state.priority)}
        </select>
        <select id="f-assignee" class="${UI_INPUT_CLASS}">
          <option value="">All assignees</option>${userOptions}
        </select>
        <div class="grid grid-cols-2 gap-2">
          <label class="block space-y-1">
            <span class="text-[10px] font-medium uppercase tracking-wide text-muted">Due from</span>
            <input id="f-due-from" type="date" value="${state.dueFrom}" class="${UI_INPUT_CLASS}" />
          </label>
          <label class="block space-y-1">
            <span class="text-[10px] font-medium uppercase tracking-wide text-muted">Due to</span>
            <input id="f-due-to" type="date" value="${state.dueTo}" class="${UI_INPUT_CLASS}" />
          </label>
        </div>
      </div>
      <div class="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted">
        <span>Sort by</span>
        ${sortPill("dueDate", "Due date")}${sortPill("priority", "Priority")}${sortPill("title", "Title")}${sortPill("createdAt", "Created")}
        ${hasActiveFilters() ? `<button id="clear-filters" class="ml-auto rounded-md border border-border bg-white px-3 py-1.5 text-xs text-navy hover:bg-page">Clear filters</button>` : ""}
      </div>
    </div>`;
}

function hasActiveFilters() {
  return Boolean(state.search || state.status || state.priority || state.assigneeId
    || state.dueFrom || state.dueTo || state.view !== "all");
}

function sortPill(field, label) {
  const active = state.sortBy === field;
  return `<button data-sort="${field}" class="sort-btn rounded-full border px-2.5 py-1 text-xs ${
    active ? "border-action text-action bg-action/10" : "border-border text-muted"
  }">${label} ${active ? (state.sortDir === "asc" ? "↑" : "↓") : ""}</button>`;
}

function relatedCell(task) {
  const related = taskRelatedRecord(task);
  if (!related) return `<span class="text-muted">—</span>`;
  return `<a href="${related.href}" class="related-link block hover:underline">
    <span class="text-navy">${escapeHtml(related.label || "—")}</span>
    <span class="block text-xs text-muted">${related.kind}</span>
  </a>`;
}

function renderRow(task) {
  const completed = task.status === "COMPLETED";
  const overdue = isTaskOverdue(task);
  const busy = state.busyIds.has(task.id);
  return `
    <tr class="border-b border-border last:border-0 hover:bg-page/60" data-id="${task.id}">
      <td class="w-8 px-4 py-3">
        <input type="checkbox" class="task-complete h-4 w-4 rounded border-border" data-id="${task.id}"
          ${completed ? "checked" : ""} ${busy ? "disabled" : ""} aria-label="Mark complete" />
      </td>
      <td class="px-4 py-3">
        <a href="detail.html?id=${task.id}" class="block hover:underline">
          <p class="font-medium ${completed ? "text-muted line-through" : "text-navy"}">${escapeHtml(task.title)}</p>
          ${task.description ? `<p class="mt-0.5 line-clamp-1 text-xs text-muted">${escapeHtml(task.description)}</p>` : ""}
        </a>
      </td>
      <td class="px-4 py-3">${badgeHtml(taskStatusLabel(task.status), taskStatusTone(task.status))}</td>
      <td class="px-4 py-3">${badgeHtml(formatEnum(task.priority), taskPriorityTone(task.priority))}</td>
      <td class="px-4 py-3 ${overdue ? "text-danger" : "text-navy"}">
        <span>${formatDate(task.dueDate)}</span>
        ${overdue ? `<span class="block text-xs text-danger">Overdue</span>` : ""}
      </td>
      <td class="px-4 py-3 text-navy">${escapeHtml(task.assignee?.name || "Unassigned")}</td>
      <td class="px-4 py-3">${relatedCell(task)}</td>
      <td class="px-4 py-3 text-navy">${formatDate(task.createdAt)}</td>
      <td class="px-4 py-3 text-right whitespace-nowrap">
        <button data-edit="${task.id}" class="rounded-md border border-border bg-white px-2.5 py-1.5 text-xs text-navy hover:bg-page">Edit</button>
        <button data-delete="${task.id}" class="rounded-md border border-danger/30 bg-white px-2.5 py-1.5 text-xs text-danger hover:bg-danger/5">Delete</button>
      </td>
    </tr>`;
}

function renderTable() {
  if (state.loading) return uiLoading("Loading tasks…");
  if (state.error) return uiError("retry-btn", state.errorMessage);
  if (!state.data || state.data.items.length === 0) {
    const description = hasActiveFilters()
      ? "No tasks match these filters. Try clearing them, or add a new task."
      : "Tasks you create will show up here.";
    return uiEmpty("No tasks found", description,
      `<button id="empty-new-task" class="mt-3 rounded-md bg-action px-3 py-1.5 text-sm font-medium text-white hover:bg-action/90">Add Task</button>`);
  }

  const headers = ["", "Task", "Status", "Priority", "Due date", "Assigned to", "Related record", "Created", ""];
  return `
    <div class="overflow-x-auto">
      <table class="w-full border-collapse text-sm">
        <thead><tr class="border-b border-border text-left text-xs font-semibold uppercase tracking-wide text-muted">
          ${headers.map((h) => `<th class="px-4 py-3">${h}</th>`).join("")}
        </tr></thead>
        <tbody>${state.data.items.map(renderRow).join("")}</tbody>
      </table>
    </div>
    ${uiPagination(state.data.page, state.data.total, state.data.pageSize)}`;
}

function render() {
  const active = document.activeElement;
  const focusId = active && active.id ? active.id : null;
  const caret = focusId === "f-search" && typeof active.selectionStart === "number"
    ? active.selectionStart : null;

  mainEl.innerHTML = `
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <h1 class="text-lg font-semibold text-navy">Tasks</h1>
        <button id="new-task-btn" class="rounded-md bg-action px-4 py-2 text-sm font-medium text-white hover:bg-action/90">Add Task</button>
      </div>
      ${renderStats()}
      ${renderViewTabs()}
      ${renderFilters()}
      <div class="rounded-card border border-border bg-surface">${renderTable()}</div>
    </div>
    ${state.toast ? `<div class="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-md bg-navy px-4 py-2 text-sm text-white shadow-lg">${escapeHtml(state.toast)}</div>` : ""}
    <div id="task-modal-root"></div>
    <div id="task-confirm-root"></div>`;

  attachEvents();

  if (focusId) {
    const el = document.getElementById(focusId);
    if (el) {
      el.focus();
      if (caret !== null && typeof el.setSelectionRange === "function") {
        try { el.setSelectionRange(caret, caret); } catch { /* unsupported input type */ }
      }
    }
  }
}

function setFilter(patch) {
  Object.assign(state, patch, { page: 1 });
  load();
}

function attachEvents() {
  document.getElementById("new-task-btn")?.addEventListener("click", () => openTaskModal(null));
  document.getElementById("empty-new-task")?.addEventListener("click", () => openTaskModal(null));
  document.getElementById("retry-btn")?.addEventListener("click", load);
  document.getElementById("prev-page")?.addEventListener("click", () => { state.page -= 1; load(); });
  document.getElementById("next-page")?.addEventListener("click", () => { state.page += 1; load(); });

  document.getElementById("f-search")?.addEventListener("input", uiDebounce((e) => {
    setFilter({ search: e.target.value });
  }, 350));
  document.getElementById("f-status")?.addEventListener("change", (e) => setFilter({ status: e.target.value }));
  document.getElementById("f-priority")?.addEventListener("change", (e) => setFilter({ priority: e.target.value }));
  document.getElementById("f-assignee")?.addEventListener("change", (e) => setFilter({ assigneeId: e.target.value }));
  document.getElementById("f-due-from")?.addEventListener("change", (e) => setFilter({ dueFrom: e.target.value }));
  document.getElementById("f-due-to")?.addEventListener("change", (e) => setFilter({ dueTo: e.target.value }));
  document.getElementById("clear-filters")?.addEventListener("click", () => setFilter({
    search: "", status: "", priority: "", assigneeId: "", dueFrom: "", dueTo: "", view: "all",
  }));

  mainEl.querySelectorAll("[data-view]").forEach((btn) =>
    btn.addEventListener("click", () => setFilter({ view: btn.dataset.view })));
  mainEl.querySelectorAll("[data-stat-view]").forEach((btn) =>
    btn.addEventListener("click", () => setFilter({ view: btn.dataset.statView })));

  mainEl.querySelectorAll(".sort-btn").forEach((btn) => btn.addEventListener("click", () => {
    const field = btn.dataset.sort;
    if (state.sortBy === field) state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
    else { state.sortBy = field; state.sortDir = "asc"; }
    state.page = 1;
    load();
  }));

  mainEl.querySelectorAll(".task-complete").forEach((cb) => cb.addEventListener("change", (e) => {
    e.stopPropagation();
    toggleComplete(cb.dataset.id, cb.checked);
  }));

  mainEl.querySelectorAll("[data-edit]").forEach((btn) => btn.addEventListener("click", () => {
    const task = state.data.items.find((t) => t.id === btn.dataset.edit);
    if (task) openTaskModal(task);
  }));

  mainEl.querySelectorAll("[data-delete]").forEach((btn) => btn.addEventListener("click", () => {
    const task = state.data.items.find((t) => t.id === btn.dataset.delete);
    if (task) confirmDelete(task);
  }));
}

// --- New / Edit task modal -------------------------------------------

function openTaskModal(task) {
  const form = task ? {
    title: task.title || "",
    description: task.description || "",
    status: task.status || "PENDING",
    priority: task.priority || "MEDIUM",
    dueDate: task.dueDate ? task.dueDate.slice(0, 10) : "",
    assigneeId: task.assignee?.id || "",
    leadId: task.lead?.id || "",
    contactId: task.contact?.id || "",
    companyId: task.company?.id || "",
    dealId: task.deal?.id || "",
  } : {
    title: "", description: "", status: "PENDING", priority: "MEDIUM", dueDate: "",
    assigneeId: "", leadId: "", contactId: "", companyId: "", dealId: "",
  };

  const opts = (items, current, label) => items
    .map((i) => `<option value="${i.id}" ${i.id === current ? "selected" : ""}>${escapeHtml(label(i))}</option>`)
    .join("");
  const personLabel = (p) => `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim();
  const statusOptions = TASK_STATUSES
    .map((s) => `<option value="${s}" ${s === form.status ? "selected" : ""}>${taskStatusLabel(s)}</option>`)
    .join("");
  const loadingNote = state.optionsLoaded ? "" :
    `<p class="text-xs text-muted">Loading assignees and CRM records…</p>`;

  const body = `
    ${uiField("Title <span class='text-danger'>*</span>",
      `<input id="tf-title" required maxlength="200" value="${escapeHtml(form.title)}" class="${UI_INPUT_CLASS}" placeholder="e.g. Call back about the proposal" />`)}
    ${uiField("Description",
      `<textarea id="tf-description" rows="3" maxlength="2000" class="${UI_INPUT_CLASS}" placeholder="Optional details">${escapeHtml(form.description)}</textarea>`)}
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
      ${uiField("Status <span class='text-danger'>*</span>", `<select id="tf-status" class="${UI_INPUT_CLASS}">${statusOptions}</select>`)}
      ${uiField("Priority <span class='text-danger'>*</span>", `<select id="tf-priority" class="${UI_INPUT_CLASS}">${uiOptions(TASK_PRIORITIES, form.priority)}</select>`)}
      ${uiField("Due date", `<input type="date" id="tf-dueDate" value="${form.dueDate}" class="${UI_INPUT_CLASS}" />`)}
    </div>
    ${uiField("Assigned user", `<select id="tf-assigneeId" class="${UI_INPUT_CLASS}">
      <option value="">Unassigned</option>${opts(state.users, form.assigneeId, (u) => u.name)}
    </select>`)}
    ${loadingNote}
    <div class="space-y-3 rounded-md border border-border bg-page/40 p-3">
      <p class="text-xs font-semibold uppercase tracking-wide text-muted">Related CRM records</p>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        ${uiField("Lead", `<select id="tf-leadId" class="${UI_INPUT_CLASS}">
          <option value="">None</option>${opts(state.leads, form.leadId, personLabel)}
        </select>`)}
        ${uiField("Contact", `<select id="tf-contactId" class="${UI_INPUT_CLASS}">
          <option value="">None</option>${opts(state.contacts, form.contactId, personLabel)}
        </select>`)}
        ${uiField("Company", `<select id="tf-companyId" class="${UI_INPUT_CLASS}">
          <option value="">None</option>${opts(state.companies, form.companyId, (c) => c.name)}
        </select>`)}
        ${uiField("Deal", `<select id="tf-dealId" class="${UI_INPUT_CLASS}">
          <option value="">None</option>${opts(state.deals, form.dealId, (d) => d.title)}
        </select>`)}
      </div>
    </div>`;

  const submitLabel = task ? "Save changes" : "Create task";
  const modal = uiModal("task-modal-root", task ? "Edit task" : "Add Task", body, submitLabel);

  uiSubmit(modal, submitLabel, async () => {
    const val = (id) => document.getElementById(id).value;
    const title = val("tf-title").trim();
    // Required-field validation before the request goes out.
    if (!title) throw new Error("Title is required.");
    if (title.length > 200) throw new Error("Title must be 200 characters or fewer.");
    if (!val("tf-status")) throw new Error("Status is required.");
    if (!val("tf-priority")) throw new Error("Priority is required.");

    const payload = {
      title,
      description: val("tf-description").trim() || null,
      status: val("tf-status"),
      priority: val("tf-priority"),
      dueDate: val("tf-dueDate") || null,
      assigneeId: val("tf-assigneeId") || null,
      leadId: val("tf-leadId") || null,
      contactId: val("tf-contactId") || null,
      companyId: val("tf-companyId") || null,
      dealId: val("tf-dealId") || null,
    };

    if (task) await api.put(`/api/tasks/${task.id}`, payload);
    else await api.post("/api/tasks", payload);

    await refreshStats();
    showToast(task ? "Task updated." : "Task created.");
    await load();
  });
}

// --- init -------------------------------------------------------------
// Deep links such as ../tasks/index.html?view=overdue (used by the dashboard
// and My Work) open the page on that quick filter.
const requestedView = new URLSearchParams(window.location.search).get("view");
if (requestedView && TASK_VIEWS.some((v) => v.key === requestedView)) {
  state.view = requestedView;
}

mainEl = renderAppShell("tasks");
render();
loadOptions().then(render);
load();
