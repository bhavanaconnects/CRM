// Work module — full CRUD list for the new, standalone WorkItem entity.
// Same structure as pages/tasks/tasks.js: one `state` object, a single
// render() that rebuilds the page, and every read/write through the shared
// `api` wrapper. Nothing here is hardcoded — the list, the filter options
// and the rows all come from the API. This module is independent of Tasks
// and Activities: it talks only to /api/work.
const state = {
  data: null, loading: true, error: false, errorMessage: "",
  users: [], leads: [], contacts: [], companies: [], deals: [],
  optionsLoaded: false,
  search: "", status: "", priority: "", type: "", assigneeId: "",
  dueFrom: "", dueTo: "",
  sortBy: "dueDate", sortDir: "asc", page: 1,
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
    page: state.page, pageSize: 20, search: state.search,
    status: state.status, priority: state.priority, type: state.type,
    assigneeId: state.assigneeId, dueFrom: state.dueFrom, dueTo: state.dueTo,
    sortBy: state.sortBy, sortDir: state.sortDir,
  });
  try {
    state.data = await api.get(`/api/work?${params}`);
  } catch (err) {
    state.error = true;
    state.errorMessage = err.message || "The data couldn't be loaded. Try again.";
  } finally {
    state.loading = false;
    render();
  }
}

async function loadOptions() {
  const pull = (path) => api.get(path).then((r) => r.items ?? r).catch(() => []);
  const [users, leads, contacts, companies, deals] = await Promise.all([
    pull("/api/users"),
    pull("/api/leads?page=1&pageSize=100&sortBy=createdAt&sortDir=desc"),
    pull("/api/contacts?page=1&pageSize=100&sortBy=createdAt&sortDir=desc"),
    pull("/api/companies?page=1&pageSize=100&sortBy=name&sortDir=asc"),
    pull("/api/deals?page=1&pageSize=100&sortBy=createdAt&sortDir=desc"),
  ]);
  Object.assign(state, { users, leads, contacts, companies, deals, optionsLoaded: true });
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

function hasActiveFilters() {
  return Boolean(state.search || state.status || state.priority || state.type
    || state.assigneeId || state.dueFrom || state.dueTo);
}

function setFilter(patch) {
  Object.assign(state, patch, { page: 1 });
  load();
}

// --- Actions ------------------------------------------------------------

function confirmDelete(work) {
  const root = document.getElementById("work-confirm-root");
  root.innerHTML = `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 px-4">
      <div role="dialog" aria-modal="true" class="w-full max-w-sm rounded-card border border-border bg-white shadow-lg">
        <div class="border-b border-border px-5 py-4"><h2 class="text-sm font-semibold text-navy">Delete work item</h2></div>
        <div class="space-y-2 px-5 py-4">
          <p class="text-sm text-navy">Delete &ldquo;${escapeHtml(work.title)}&rdquo;?</p>
          <p class="text-sm text-muted">This can't be undone.</p>
          <p id="confirm-error" class="hidden rounded-md border border-danger/20 bg-danger/5 px-3 py-2 text-sm text-danger"></p>
        </div>
        <div class="flex justify-end gap-2 border-t border-border px-5 py-4">
          <button type="button" id="confirm-cancel" class="rounded-md border border-border bg-white px-4 py-2 text-sm text-navy hover:bg-page">Cancel</button>
          <button type="button" id="confirm-delete" class="rounded-md bg-danger px-4 py-2 text-sm font-medium text-white hover:bg-danger/90">Delete work item</button>
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
      await api.del(`/api/work/${work.id}`);
      close();
      showToast("Work item deleted.");
      await load();
    } catch (ex) {
      err.textContent = ex.message || "Couldn't delete this work item.";
      err.classList.remove("hidden");
      btn.disabled = false;
      btn.textContent = "Delete work item";
    }
  });
}

// --- Rendering ----------------------------------------------------------

function renderFilters() {
  const userOptions = state.users
    .map((u) => `<option value="${u.id}" ${u.id === state.assigneeId ? "selected" : ""}>${escapeHtml(u.name)}</option>`)
    .join("");

  return `
    <div class="rounded-card border border-border bg-surface p-4">
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <div class="lg:col-span-2">
          <input id="f-search" type="search" placeholder="Search title or description…" value="${escapeHtml(state.search)}" class="${UI_INPUT_CLASS}" />
        </div>
        <select id="f-status" class="${UI_INPUT_CLASS}">
          <option value="">All statuses</option>${uiOptions(WORK_STATUSES, state.status)}
        </select>
        <select id="f-priority" class="${UI_INPUT_CLASS}">
          <option value="">All priorities</option>${uiOptions(WORK_PRIORITIES, state.priority)}
        </select>
        <select id="f-type" class="${UI_INPUT_CLASS}">
          <option value="">All types</option>${uiOptions(WORK_TYPES, state.type)}
        </select>
        <select id="f-assignee" class="${UI_INPUT_CLASS}">
          <option value="">All assignees</option>${userOptions}
        </select>
      </div>
      <div class="mt-3 grid grid-cols-2 gap-2 sm:w-96">
        <label class="block space-y-1">
          <span class="text-[10px] font-medium uppercase tracking-wide text-muted">Due from</span>
          <input id="f-due-from" type="date" value="${state.dueFrom}" class="${UI_INPUT_CLASS}" />
        </label>
        <label class="block space-y-1">
          <span class="text-[10px] font-medium uppercase tracking-wide text-muted">Due to</span>
          <input id="f-due-to" type="date" value="${state.dueTo}" class="${UI_INPUT_CLASS}" />
        </label>
      </div>
      <div class="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted">
        <span>Sort by</span>
        ${sortPill("dueDate", "Due date")}${sortPill("priority", "Priority")}${sortPill("title", "Title")}${sortPill("createdAt", "Created")}
        ${hasActiveFilters() ? `<button id="clear-filters" class="ml-auto rounded-md border border-border bg-white px-3 py-1.5 text-xs text-navy hover:bg-page">Clear filters</button>` : ""}
      </div>
    </div>`;
}

function sortPill(field, label) {
  const active = state.sortBy === field;
  return `<button data-sort="${field}" class="sort-btn rounded-full border px-2.5 py-1 text-xs ${
    active ? "border-action text-action bg-action/10" : "border-border text-muted"
  }">${label} ${active ? (state.sortDir === "asc" ? "↑" : "↓") : ""}</button>`;
}

function relatedCell(work) {
  const related = workRelatedRecord(work);
  if (!related) return `<span class="text-muted">—</span>`;
  return `<a href="${related.href}" class="block hover:underline">
    <span class="text-navy">${escapeHtml(related.label || "—")}</span>
    <span class="block text-xs text-muted">${related.kind}</span>
  </a>`;
}

function renderRow(work) {
  const overdue = isWorkOverdue(work);
  return `
    <tr class="border-b border-border last:border-0 hover:bg-page/60" data-id="${work.id}">
      <td class="px-4 py-3">
        <a href="detail.html?id=${work.id}" class="block hover:underline">
          <p class="font-medium text-navy">${workTypeIcon(work.type)} ${escapeHtml(work.title)}</p>
          ${work.description ? `<p class="mt-0.5 line-clamp-1 text-xs text-muted">${escapeHtml(work.description)}</p>` : ""}
        </a>
      </td>
      <td class="px-4 py-3">${badgeHtml(formatEnum(work.type), "action")}</td>
      <td class="px-4 py-3">${badgeHtml(formatEnum(work.status), workStatusTone(work.status))}</td>
      <td class="px-4 py-3">${badgeHtml(formatEnum(work.priority), workPriorityTone(work.priority))}</td>
      <td class="px-4 py-3 ${overdue ? "text-danger" : "text-navy"}">
        <span>${formatDate(work.dueDate)}</span>
        ${overdue ? `<span class="block text-xs text-danger">Overdue</span>` : ""}
      </td>
      <td class="px-4 py-3 text-navy">${escapeHtml(work.assignee?.name || "Unassigned")}</td>
      <td class="px-4 py-3">${relatedCell(work)}</td>
      <td class="px-4 py-3 text-navy">${formatDate(work.createdAt)}</td>
      <td class="px-4 py-3 text-right whitespace-nowrap">
        <button data-edit="${work.id}" class="rounded-md border border-border bg-white px-2.5 py-1.5 text-xs text-navy hover:bg-page">Edit</button>
        <button data-delete="${work.id}" class="rounded-md border border-danger/30 bg-white px-2.5 py-1.5 text-xs text-danger hover:bg-danger/5">Delete</button>
      </td>
    </tr>`;
}

function renderTable() {
  if (state.loading) return uiLoading("Loading work items…");
  if (state.error) return uiError("retry-btn", state.errorMessage);
  if (!state.data || state.data.items.length === 0) {
    const description = hasActiveFilters()
      ? "No work items match these filters. Try clearing them, or add a new one."
      : "Work items you create will show up here.";
    return uiEmpty("No work items found", description,
      `<button id="empty-new-work" class="mt-3 rounded-md bg-action px-3 py-1.5 text-sm font-medium text-white hover:bg-action/90">Add work item</button>`);
  }

  const headers = ["Title", "Type", "Status", "Priority", "Due date", "Assigned to", "Related record", "Created", ""];
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
        <h1 class="text-lg font-semibold text-navy">Work</h1>
        <button id="new-work-btn" class="rounded-md bg-action px-4 py-2 text-sm font-medium text-white hover:bg-action/90">Add work item</button>
      </div>
      ${renderFilters()}
      <div class="rounded-card border border-border bg-surface">${renderTable()}</div>
    </div>
    ${state.toast ? `<div class="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-md bg-navy px-4 py-2 text-sm text-white shadow-lg">${escapeHtml(state.toast)}</div>` : ""}
    <div id="work-modal-root"></div>
    <div id="work-confirm-root"></div>`;

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

function attachEvents() {
  document.getElementById("new-work-btn")?.addEventListener("click", () => openWorkModal(null));
  document.getElementById("empty-new-work")?.addEventListener("click", () => openWorkModal(null));
  document.getElementById("retry-btn")?.addEventListener("click", load);
  document.getElementById("prev-page")?.addEventListener("click", () => { state.page -= 1; load(); });
  document.getElementById("next-page")?.addEventListener("click", () => { state.page += 1; load(); });

  document.getElementById("f-search")?.addEventListener("input", uiDebounce((e) => {
    setFilter({ search: e.target.value });
  }, 350));
  document.getElementById("f-status")?.addEventListener("change", (e) => setFilter({ status: e.target.value }));
  document.getElementById("f-priority")?.addEventListener("change", (e) => setFilter({ priority: e.target.value }));
  document.getElementById("f-type")?.addEventListener("change", (e) => setFilter({ type: e.target.value }));
  document.getElementById("f-assignee")?.addEventListener("change", (e) => setFilter({ assigneeId: e.target.value }));
  document.getElementById("f-due-from")?.addEventListener("change", (e) => setFilter({ dueFrom: e.target.value }));
  document.getElementById("f-due-to")?.addEventListener("change", (e) => setFilter({ dueTo: e.target.value }));
  document.getElementById("clear-filters")?.addEventListener("click", () => setFilter({
    search: "", status: "", priority: "", type: "", assigneeId: "", dueFrom: "", dueTo: "",
  }));

  mainEl.querySelectorAll(".sort-btn").forEach((btn) => btn.addEventListener("click", () => {
    const field = btn.dataset.sort;
    if (state.sortBy === field) state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
    else { state.sortBy = field; state.sortDir = "asc"; }
    state.page = 1;
    load();
  }));

  mainEl.querySelectorAll("[data-edit]").forEach((btn) => btn.addEventListener("click", () => {
    const work = state.data.items.find((w) => w.id === btn.dataset.edit);
    if (work) openWorkModal(work);
  }));
  mainEl.querySelectorAll("[data-delete]").forEach((btn) => btn.addEventListener("click", () => {
    const work = state.data.items.find((w) => w.id === btn.dataset.delete);
    if (work) confirmDelete(work);
  }));
}

// --- New / Edit work item modal -----------------------------------------

function openWorkModal(work) {
  const form = work ? {
    title: work.title || "",
    description: work.description || "",
    type: work.type || "TASK",
    priority: work.priority || "MEDIUM",
    status: work.status || "OPEN",
    dueDate: work.dueDate ? work.dueDate.slice(0, 10) : "",
    assigneeId: work.assignee?.id || "",
    leadId: work.lead?.id || "",
    contactId: work.contact?.id || "",
    companyId: work.company?.id || "",
    dealId: work.deal?.id || "",
  } : {
    title: "", description: "", type: "TASK", priority: "MEDIUM", status: "OPEN",
    dueDate: "", assigneeId: "", leadId: "", contactId: "", companyId: "", dealId: "",
  };

  const opts = (items, current, label) => items
    .map((i) => `<option value="${i.id}" ${i.id === current ? "selected" : ""}>${escapeHtml(label(i))}</option>`)
    .join("");
  const personLabel = (p) => `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim();
  const loadingNote = state.optionsLoaded ? "" :
    `<p class="text-xs text-muted">Loading assignees and CRM records…</p>`;

  const body = `
    ${uiField("Title <span class='text-danger'>*</span>",
      `<input id="wf-title" required maxlength="200" value="${escapeHtml(form.title)}" class="${UI_INPUT_CLASS}" placeholder="e.g. Prepare renewal proposal" />`)}
    ${uiField("Description",
      `<textarea id="wf-description" rows="3" maxlength="4000" class="${UI_INPUT_CLASS}" placeholder="Optional details">${escapeHtml(form.description)}</textarea>`)}
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
      ${uiField("Type / category <span class='text-danger'>*</span>", `<select id="wf-type" class="${UI_INPUT_CLASS}">${uiOptions(WORK_TYPES, form.type)}</select>`)}
      ${uiField("Priority <span class='text-danger'>*</span>", `<select id="wf-priority" class="${UI_INPUT_CLASS}">${uiOptions(WORK_PRIORITIES, form.priority)}</select>`)}
      ${uiField("Status <span class='text-danger'>*</span>", `<select id="wf-status" class="${UI_INPUT_CLASS}">${uiOptions(WORK_STATUSES, form.status)}</select>`)}
    </div>
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
      ${uiField("Due date", `<input type="date" id="wf-dueDate" value="${form.dueDate}" class="${UI_INPUT_CLASS}" />`)}
      ${uiField("Assigned user", `<select id="wf-assigneeId" class="${UI_INPUT_CLASS}">
        <option value="">Unassigned</option>${opts(state.users, form.assigneeId, (u) => u.name)}
      </select>`)}
    </div>
    ${loadingNote}
    <div class="space-y-3 rounded-md border border-border bg-page/40 p-3">
      <p class="text-xs font-semibold uppercase tracking-wide text-muted">Related CRM records</p>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        ${uiField("Lead", `<select id="wf-leadId" class="${UI_INPUT_CLASS}">
          <option value="">None</option>${opts(state.leads, form.leadId, personLabel)}
        </select>`)}
        ${uiField("Contact", `<select id="wf-contactId" class="${UI_INPUT_CLASS}">
          <option value="">None</option>${opts(state.contacts, form.contactId, personLabel)}
        </select>`)}
        ${uiField("Company", `<select id="wf-companyId" class="${UI_INPUT_CLASS}">
          <option value="">None</option>${opts(state.companies, form.companyId, (c) => c.name)}
        </select>`)}
        ${uiField("Deal", `<select id="wf-dealId" class="${UI_INPUT_CLASS}">
          <option value="">None</option>${opts(state.deals, form.dealId, (d) => d.title)}
        </select>`)}
      </div>
    </div>`;

  const submitLabel = work ? "Save changes" : "Create work item";
  const modal = uiModal("work-modal-root", work ? "Edit work item" : "Add work item", body, submitLabel);

  uiSubmit(modal, submitLabel, async () => {
    const val = (id) => document.getElementById(id).value;
    const title = val("wf-title").trim();
    if (!title) throw new Error("Title is required.");
    if (title.length > 200) throw new Error("Title must be 200 characters or fewer.");
    if (!val("wf-type")) throw new Error("Type is required.");
    if (!val("wf-priority")) throw new Error("Priority is required.");
    if (!val("wf-status")) throw new Error("Status is required.");

    const payload = {
      title,
      description: val("wf-description").trim() || null,
      type: val("wf-type"),
      priority: val("wf-priority"),
      status: val("wf-status"),
      dueDate: val("wf-dueDate") || null,
      assigneeId: val("wf-assigneeId") || null,
      leadId: val("wf-leadId") || null,
      contactId: val("wf-contactId") || null,
      companyId: val("wf-companyId") || null,
      dealId: val("wf-dealId") || null,
    };

    if (work) await api.put(`/api/work/${work.id}`, payload);
    else await api.post("/api/work", payload);

    showToast(work ? "Work item updated." : "Work item created.");
    await load();
  });
}

// --- init -----------------------------------------------------------------
mainEl = renderAppShell("work");
render();
loadOptions().then(render);
load();
