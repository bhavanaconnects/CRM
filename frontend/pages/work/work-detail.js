// Work item detail — one work item plus the CRM record it relates to.
const workId = new URLSearchParams(window.location.search).get("id");

const state = {
  work: null, loading: true, error: false, errorMessage: "",
  users: [], leads: [], contacts: [], companies: [], deals: [],
  optionsLoaded: false,
  toast: null,
};

let mainEl;

async function load() {
  state.loading = true;
  state.error = false;
  render();
  try {
    state.work = await api.get(`/api/work/${workId}`);
  } catch (err) {
    state.error = true;
    state.errorMessage = err.message || "This work item couldn't be loaded.";
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

function detailRow(label, valueHtml) {
  return `<div class="flex items-start justify-between gap-4 border-b border-border py-2.5 last:border-0">
    <span class="text-xs font-medium uppercase tracking-wide text-muted">${label}</span>
    <span class="text-right text-sm text-navy">${valueHtml}</span>
  </div>`;
}

function relatedCard(work) {
  const related = workRelatedRecord(work);
  if (!related) {
    return `<p class="text-sm text-muted">This work item isn't linked to a lead, contact, company or deal.</p>`;
  }
  return `<a href="${related.href}" class="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm hover:bg-page">
    <span>
      <span class="block font-medium text-navy">${escapeHtml(related.label || "—")}</span>
      <span class="block text-xs text-muted">${related.kind}</span>
    </span>
    <span class="text-xs text-action">Open →</span>
  </a>`;
}

function render() {
  if (state.loading) { mainEl.innerHTML = uiLoading("Loading work item…"); return; }
  if (state.error) {
    mainEl.innerHTML = `<div class="space-y-4">
      <a href="index.html" class="text-sm text-action hover:underline">← Back to work</a>
      ${uiError("retry-btn", state.errorMessage)}
    </div>`;
    document.getElementById("retry-btn").addEventListener("click", load);
    return;
  }

  const w = state.work;
  const overdue = isWorkOverdue(w);

  mainEl.innerHTML = `
    <div class="space-y-4">
      <a href="index.html" class="text-sm text-action hover:underline">← Back to work</a>

      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 class="text-lg font-semibold text-navy">${workTypeIcon(w.type)} ${escapeHtml(w.title)}</h1>
          <p class="mt-1 text-sm ${overdue ? "text-danger" : "text-muted"}">${overdue ? "Overdue · " : ""}${formatDate(w.dueDate)}</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button id="edit-work" class="rounded-md border border-border bg-white px-4 py-2 text-sm text-navy hover:bg-page">Edit</button>
          <button id="delete-work" class="rounded-md border border-danger/30 bg-white px-4 py-2 text-sm text-danger hover:bg-danger/5">Delete</button>
        </div>
      </div>

      <div class="grid gap-6 lg:grid-cols-3">
        <div class="space-y-6 lg:col-span-2">
          ${uiCard("Details", `
            ${detailRow("Type / category", badgeHtml(formatEnum(w.type), "action"))}
            ${detailRow("Status", badgeHtml(formatEnum(w.status), workStatusTone(w.status)))}
            ${detailRow("Priority", badgeHtml(formatEnum(w.priority), workPriorityTone(w.priority)))}
            ${detailRow("Due date", `<span class="${overdue ? "text-danger" : ""}">${formatDate(w.dueDate)}</span>`)}
            ${detailRow("Assigned user", escapeHtml(w.assignee?.name || "Unassigned"))}
            ${detailRow("Created", formatDateTime(w.createdAt))}
            ${detailRow("Last updated", formatDateTime(w.updatedAt))}
          `)}
          ${uiCard("Description", w.description
            ? `<p class="whitespace-pre-wrap text-sm text-navy">${escapeHtml(w.description)}</p>`
            : `<p class="text-sm text-muted">No description was added to this work item.</p>`)}
        </div>
        <div class="space-y-6">${uiCard("Related CRM record", relatedCard(w))}</div>
      </div>
    </div>
    ${state.toast ? `<div class="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-md bg-navy px-4 py-2 text-sm text-white shadow-lg">${escapeHtml(state.toast)}</div>` : ""}
    <div id="work-modal-root"></div>
    <div id="work-confirm-root"></div>`;

  document.getElementById("edit-work").addEventListener("click", () => openWorkModal(w));
  document.getElementById("delete-work").addEventListener("click", () => confirmDelete(w));
}

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

  document.getElementById("confirm-cancel").addEventListener("click", () => { root.innerHTML = ""; });
  document.getElementById("confirm-delete").addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    const err = document.getElementById("confirm-error");
    err.classList.add("hidden");
    btn.disabled = true;
    btn.textContent = "Deleting…";
    try {
      await api.del(`/api/work/${work.id}`);
      window.location.href = "index.html";
    } catch (ex) {
      err.textContent = ex.message || "Couldn't delete this work item.";
      err.classList.remove("hidden");
      btn.disabled = false;
      btn.textContent = "Delete work item";
    }
  });
}

function openWorkModal(work) {
  const form = {
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
  };

  const opts = (items, current, label) => items
    .map((i) => `<option value="${i.id}" ${i.id === current ? "selected" : ""}>${escapeHtml(label(i))}</option>`)
    .join("");
  const personLabel = (p) => `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim();

  const body = `
    ${uiField("Title <span class='text-danger'>*</span>",
      `<input id="wf-title" required maxlength="200" value="${escapeHtml(form.title)}" class="${UI_INPUT_CLASS}" />`)}
    ${uiField("Description",
      `<textarea id="wf-description" rows="3" maxlength="4000" class="${UI_INPUT_CLASS}">${escapeHtml(form.description)}</textarea>`)}
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
    ${state.optionsLoaded ? "" : `<p class="text-xs text-muted">Loading assignees and CRM records…</p>`}
    <div class="space-y-3 rounded-md border border-border bg-page/40 p-3">
      <p class="text-xs font-semibold uppercase tracking-wide text-muted">Related CRM records</p>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        ${uiField("Lead", `<select id="wf-leadId" class="${UI_INPUT_CLASS}"><option value="">None</option>${opts(state.leads, form.leadId, personLabel)}</select>`)}
        ${uiField("Contact", `<select id="wf-contactId" class="${UI_INPUT_CLASS}"><option value="">None</option>${opts(state.contacts, form.contactId, personLabel)}</select>`)}
        ${uiField("Company", `<select id="wf-companyId" class="${UI_INPUT_CLASS}"><option value="">None</option>${opts(state.companies, form.companyId, (c) => c.name)}</select>`)}
        ${uiField("Deal", `<select id="wf-dealId" class="${UI_INPUT_CLASS}"><option value="">None</option>${opts(state.deals, form.dealId, (d) => d.title)}</select>`)}
      </div>
    </div>`;

  const modal = uiModal("work-modal-root", "Edit work item", body, "Save changes");
  uiSubmit(modal, "Save changes", async () => {
    const val = (id) => document.getElementById(id).value;
    const title = val("wf-title").trim();
    if (!title) throw new Error("Title is required.");
    if (!val("wf-type")) throw new Error("Type is required.");
    if (!val("wf-priority")) throw new Error("Priority is required.");
    if (!val("wf-status")) throw new Error("Status is required.");

    state.work = await api.put(`/api/work/${work.id}`, {
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
    });
    showToast("Work item updated.");
  });
}

// --- init -------------------------------------------------------------
mainEl = renderAppShell("work");
if (!workId) {
  state.loading = false;
  state.error = true;
  state.errorMessage = "No work item was specified.";
  render();
} else {
  render();
  loadOptions();
  load();
}
