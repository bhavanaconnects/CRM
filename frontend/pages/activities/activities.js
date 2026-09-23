// Activities module — chronological timeline with search, filters and full
// CRUD. Same structure as pages/tasks/tasks.js: one `state` object, a single
// render(), and every read/write through the shared `api` wrapper. Nothing is
// hardcoded — rows and filter options all come from the API.
const state = {
  data: null, loading: true, error: false, errorMessage: "",
  users: [], leads: [], contacts: [], companies: [], deals: [],
  optionsLoaded: false,
  search: "", type: "", status: "", userId: "", dateFrom: "", dateTo: "",
  sortDir: "desc", page: 1,
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

async function load() {
  state.loading = true;
  state.error = false;
  render();
  const params = qs({
    page: state.page, pageSize: 20, search: state.search, type: state.type,
    status: state.status, userId: state.userId,
    dateFrom: state.dateFrom, dateTo: state.dateTo,
    sortBy: "occurredAt", sortDir: state.sortDir,
  });
  try {
    state.data = await api.get(`/api/activities?${params}`);
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
  return Boolean(state.search || state.type || state.status || state.userId
    || state.dateFrom || state.dateTo);
}

function setFilter(patch) {
  Object.assign(state, patch, { page: 1 });
  load();
}

// --- Rendering --------------------------------------------------------

function renderFilters() {
  const userOptions = state.users
    .map((u) => `<option value="${u.id}" ${u.id === state.userId ? "selected" : ""}>${escapeHtml(u.name)}</option>`)
    .join("");
  return `
    <div class="rounded-card border border-border bg-surface p-4">
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <div class="lg:col-span-2">
          <input id="f-search" type="search" placeholder="Search subject or notes…" value="${escapeHtml(state.search)}" class="${UI_INPUT_CLASS}" />
        </div>
        <select id="f-type" class="${UI_INPUT_CLASS}">
          <option value="">All types</option>${uiOptions(ACTIVITY_TYPES, state.type)}
        </select>
        <select id="f-status" class="${UI_INPUT_CLASS}">
          <option value="">All statuses</option>${uiOptions(ACTIVITY_STATUSES, state.status)}
        </select>
        <select id="f-user" class="${UI_INPUT_CLASS}">
          <option value="">All users</option>${userOptions}
        </select>
        <div class="grid grid-cols-2 gap-2">
          <label class="block space-y-1">
            <span class="text-[10px] font-medium uppercase tracking-wide text-muted">From</span>
            <input id="f-date-from" type="date" value="${state.dateFrom}" class="${UI_INPUT_CLASS}" />
          </label>
          <label class="block space-y-1">
            <span class="text-[10px] font-medium uppercase tracking-wide text-muted">To</span>
            <input id="f-date-to" type="date" value="${state.dateTo}" class="${UI_INPUT_CLASS}" />
          </label>
        </div>
      </div>
      <div class="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted">
        <button id="toggle-sort" class="rounded-full border border-border px-2.5 py-1 text-xs text-muted hover:text-navy">
          ${state.sortDir === "desc" ? "Newest first ↓" : "Oldest first ↑"}
        </button>
        ${hasActiveFilters() ? `<button id="clear-filters" class="ml-auto rounded-md border border-border bg-white px-3 py-1.5 text-xs text-navy hover:bg-page">Clear filters</button>` : ""}
      </div>
    </div>`;
}

/** Groups the page's activities by calendar day for the timeline. */
function groupByDay(items) {
  const groups = [];
  items.forEach((a) => {
    const key = a.occurredAt ? new Date(a.occurredAt).toDateString() : "undated";
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.items.push(a);
    else groups.push({ key, label: a.occurredAt ? formatDate(a.occurredAt) : "No date", items: [a] });
  });
  return groups;
}

function renderTimeline() {
  if (state.loading) return uiLoading("Loading activities…");
  if (state.error) return uiError("retry-btn", state.errorMessage);
  if (!state.data || state.data.items.length === 0) {
    const description = hasActiveFilters()
      ? "No activities match these filters. Try clearing them, or log a new activity."
      : "Calls, emails, meetings and notes you log will appear here.";
    return uiEmpty("No activities found", description,
      `<button id="empty-new-activity" class="mt-3 rounded-md bg-action px-3 py-1.5 text-sm font-medium text-white hover:bg-action/90">Log activity</button>`);
  }

  const groups = groupByDay(state.data.items);
  return `
    <div class="space-y-6 p-5">
      ${groups.map((g) => `
        <section>
          <h3 class="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">${escapeHtml(g.label)}</h3>
          <ol class="relative space-y-5 border-l border-border pl-4">
            ${g.items.map((a) => activityTimelineItem(a, {
              showRelated: true,
              actionsHtml: `
                <button data-edit="${a.id}" class="rounded-md border border-border bg-white px-2.5 py-1 text-xs text-navy hover:bg-page">Edit</button>
                <button data-delete="${a.id}" class="rounded-md border border-danger/30 bg-white px-2.5 py-1 text-xs text-danger hover:bg-danger/5">Delete</button>`,
            })).join("")}
          </ol>
        </section>`).join("")}
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
        <h1 class="text-lg font-semibold text-navy">Activities</h1>
        <button id="new-activity-btn" class="rounded-md bg-action px-4 py-2 text-sm font-medium text-white hover:bg-action/90">Log activity</button>
      </div>
      ${renderFilters()}
      <div class="rounded-card border border-border bg-surface">${renderTimeline()}</div>
    </div>
    ${state.toast ? `<div class="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-md bg-navy px-4 py-2 text-sm text-white shadow-lg">${escapeHtml(state.toast)}</div>` : ""}
    <div id="activity-modal-root"></div>
    <div id="activity-confirm-root"></div>`;

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
  document.getElementById("new-activity-btn")?.addEventListener("click", () => openActivityModal(null));
  document.getElementById("empty-new-activity")?.addEventListener("click", () => openActivityModal(null));
  document.getElementById("retry-btn")?.addEventListener("click", load);
  document.getElementById("prev-page")?.addEventListener("click", () => { state.page -= 1; load(); });
  document.getElementById("next-page")?.addEventListener("click", () => { state.page += 1; load(); });

  document.getElementById("f-search")?.addEventListener("input", uiDebounce((e) => {
    setFilter({ search: e.target.value });
  }, 350));
  document.getElementById("f-type")?.addEventListener("change", (e) => setFilter({ type: e.target.value }));
  document.getElementById("f-status")?.addEventListener("change", (e) => setFilter({ status: e.target.value }));
  document.getElementById("f-user")?.addEventListener("change", (e) => setFilter({ userId: e.target.value }));
  document.getElementById("f-date-from")?.addEventListener("change", (e) => setFilter({ dateFrom: e.target.value }));
  document.getElementById("f-date-to")?.addEventListener("change", (e) => setFilter({ dateTo: e.target.value }));
  document.getElementById("toggle-sort")?.addEventListener("click", () =>
    setFilter({ sortDir: state.sortDir === "desc" ? "asc" : "desc" }));
  document.getElementById("clear-filters")?.addEventListener("click", () => setFilter({
    search: "", type: "", status: "", userId: "", dateFrom: "", dateTo: "",
  }));

  mainEl.querySelectorAll("[data-edit]").forEach((btn) => btn.addEventListener("click", () => {
    const activity = state.data.items.find((a) => a.id === btn.dataset.edit);
    if (activity) openActivityModal(activity);
  }));
  mainEl.querySelectorAll("[data-delete]").forEach((btn) => btn.addEventListener("click", () => {
    const activity = state.data.items.find((a) => a.id === btn.dataset.delete);
    if (activity) confirmDelete(activity);
  }));
}

function confirmDelete(activity) {
  const root = document.getElementById("activity-confirm-root");
  root.innerHTML = `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 px-4">
      <div role="dialog" aria-modal="true" class="w-full max-w-sm rounded-card border border-border bg-white shadow-lg">
        <div class="border-b border-border px-5 py-4"><h2 class="text-sm font-semibold text-navy">Delete activity</h2></div>
        <div class="space-y-2 px-5 py-4">
          <p class="text-sm text-navy">Delete &ldquo;${escapeHtml(activitySubject(activity))}&rdquo;?</p>
          <p class="text-sm text-muted">This can't be undone.</p>
          <p id="confirm-error" class="hidden rounded-md border border-danger/20 bg-danger/5 px-3 py-2 text-sm text-danger"></p>
        </div>
        <div class="flex justify-end gap-2 border-t border-border px-5 py-4">
          <button type="button" id="confirm-cancel" class="rounded-md border border-border bg-white px-4 py-2 text-sm text-navy hover:bg-page">Cancel</button>
          <button type="button" id="confirm-delete" class="rounded-md bg-danger px-4 py-2 text-sm font-medium text-white hover:bg-danger/90">Delete activity</button>
        </div>
      </div>
    </div>`;

  document.getElementById("confirm-cancel").addEventListener("click", () => { root.innerHTML = ""; });
  document.getElementById("confirm-delete").addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    const err = document.getElementById("confirm-error");
    err.classList.add("hidden");
    btn.disabled = true;
    btn.textContent = "Deleting…";
    try {
      await api.del(`/api/activities/${activity.id}`);
      root.innerHTML = "";
      showToast("Activity deleted.");
      await load();
    } catch (ex) {
      err.textContent = ex.message || "Couldn't delete the activity.";
      err.classList.remove("hidden");
      btn.disabled = false;
      btn.textContent = "Delete activity";
    }
  });
}

// --- New / Edit activity modal ---------------------------------------

function openActivityModal(activity) {
  const modal = buildActivityModal({
    activity,
    users: state.users, leads: state.leads, contacts: state.contacts,
    companies: state.companies, deals: state.deals,
    fetchOptions: !state.optionsLoaded,
    rootId: "activity-modal-root",
    onSaved: async (saved, wasEdit) => {
      showToast(wasEdit ? "Activity updated." : "Activity logged.");
      await load();
    },
  });
  return modal;
}

// --- init -------------------------------------------------------------
mainEl = renderAppShell("activities");
render();
loadOptions().then(render);
load();
