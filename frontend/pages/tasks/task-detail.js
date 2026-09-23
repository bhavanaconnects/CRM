// Task detail — shows one task plus every CRM record it is related to.
// Mirrors pages/leads/lead-detail.js: read the id from the query string,
// fetch through the shared api wrapper, and render loading/error/empty.
const taskId = new URLSearchParams(window.location.search).get("id");

const state = {
  task: null, loading: true, error: false, errorMessage: "",
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
    state.task = await api.get(`/api/tasks/${taskId}`);
  } catch (err) {
    state.error = true;
    state.errorMessage = err.message || "This task couldn't be loaded.";
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

function relatedLinks(task) {
  const links = [];
  if (task.lead) {
    links.push({ kind: "Lead", label: `${task.lead.firstName} ${task.lead.lastName}`.trim(),
      meta: task.lead.status ? formatEnum(task.lead.status) : "",
      href: `../leads/detail.html?id=${task.lead.id}` });
  }
  if (task.contact) {
    links.push({ kind: "Contact", label: `${task.contact.firstName} ${task.contact.lastName}`.trim(),
      meta: "", href: `../contacts/detail.html?id=${task.contact.id}` });
  }
  if (task.company) {
    links.push({ kind: "Company", label: task.company.name, meta: "",
      href: `../companies/detail.html?id=${task.company.id}` });
  }
  if (task.deal) {
    links.push({ kind: "Deal", label: task.deal.title, meta: formatCurrency(task.deal.amount),
      href: `../deals/detail.html?id=${task.deal.id}` });
  }

  if (links.length === 0) {
    return `<p class="text-sm text-muted">This task isn't linked to a lead, contact, company or deal yet.</p>`;
  }

  return `<ul class="space-y-2">${links.map((l) => `
    <li>
      <a href="${l.href}" class="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm hover:bg-page">
        <span>
          <span class="block font-medium text-navy">${escapeHtml(l.label || "—")}</span>
          <span class="block text-xs text-muted">${l.kind}${l.meta ? ` · ${escapeHtml(l.meta)}` : ""}</span>
        </span>
        <span class="text-xs text-action">Open →</span>
      </a>
    </li>`).join("")}</ul>`;
}

function render() {
  if (state.loading) { mainEl.innerHTML = uiLoading("Loading task…"); return; }
  if (state.error) {
    mainEl.innerHTML = `<div class="space-y-4">
      <a href="index.html" class="text-sm text-action hover:underline">← Back to tasks</a>
      ${uiError("retry-btn", state.errorMessage)}
    </div>`;
    document.getElementById("retry-btn").addEventListener("click", load);
    return;
  }

  const t = state.task;
  const completed = t.status === "COMPLETED";
  const overdue = isTaskOverdue(t);

  mainEl.innerHTML = `
    <div class="space-y-4">
      <a href="index.html" class="text-sm text-action hover:underline">← Back to tasks</a>

      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 class="text-lg font-semibold ${completed ? "text-muted line-through" : "text-navy"}">${escapeHtml(t.title)}</h1>
          <p class="mt-1 text-sm ${overdue ? "text-danger" : "text-muted"}">${escapeHtml(taskDueLabel(t))}</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button id="toggle-complete" class="rounded-md ${completed ? "border border-border bg-white text-navy hover:bg-page" : "bg-success text-white hover:bg-success/90"} px-4 py-2 text-sm font-medium">
            ${completed ? "Mark incomplete" : "Mark complete"}
          </button>
          <button id="edit-task" class="rounded-md border border-border bg-white px-4 py-2 text-sm text-navy hover:bg-page">Edit</button>
          <button id="delete-task" class="rounded-md border border-danger/30 bg-white px-4 py-2 text-sm text-danger hover:bg-danger/5">Delete</button>
        </div>
      </div>

      <div class="grid gap-6 lg:grid-cols-3">
        <div class="lg:col-span-2 space-y-6">
          ${uiCard("Details", `
            ${detailRow("Status", badgeHtml(taskStatusLabel(t.status), taskStatusTone(t.status)))}
            ${detailRow("Priority", badgeHtml(formatEnum(t.priority), taskPriorityTone(t.priority)))}
            ${detailRow("Due date", `<span class="${overdue ? "text-danger" : ""}">${formatDate(t.dueDate)}</span>`)}
            ${detailRow("Assigned user", escapeHtml(t.assignee?.name || "Unassigned"))}
            ${detailRow("Created", formatDateTime(t.createdAt))}
            ${detailRow("Last updated", formatDateTime(t.updatedAt))}
            ${t.completedAt ? detailRow("Completed", formatDateTime(t.completedAt)) : ""}
          `)}
          ${uiCard("Description", t.description
            ? `<p class="whitespace-pre-wrap text-sm text-navy">${escapeHtml(t.description)}</p>`
            : `<p class="text-sm text-muted">No description was added to this task.</p>`)}
        </div>
        <div class="space-y-6">
          ${uiCard("Related CRM record", relatedLinks(t))}
        </div>
      </div>
    </div>
    ${state.toast ? `<div class="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-md bg-navy px-4 py-2 text-sm text-white shadow-lg">${escapeHtml(state.toast)}</div>` : ""}
    <div id="task-modal-root"></div>
    <div id="task-confirm-root"></div>`;

  document.getElementById("toggle-complete").addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    try {
      state.task = await api.patch(`/api/tasks/${t.id}/complete`, { completed: !completed });
      showToast(completed ? "Task reopened." : "Task marked complete.");
    } catch (err) {
      showToast(err.message || "Couldn't update the task.");
    }
  });

  document.getElementById("edit-task").addEventListener("click", () => openTaskModal(t));
  document.getElementById("delete-task").addEventListener("click", () => confirmDelete(t));
}

function confirmDelete(task) {
  const root = document.getElementById("task-confirm-root");
  root.innerHTML = `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 px-4">
      <div role="dialog" aria-modal="true" class="w-full max-w-sm rounded-card border border-border bg-white shadow-lg">
        <div class="border-b border-border px-5 py-4"><h2 class="text-sm font-semibold text-navy">Delete task</h2></div>
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

  document.getElementById("confirm-cancel").addEventListener("click", () => { root.innerHTML = ""; });
  document.getElementById("confirm-delete").addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    const err = document.getElementById("confirm-error");
    err.classList.add("hidden");
    btn.disabled = true;
    btn.textContent = "Deleting…";
    try {
      await api.del(`/api/tasks/${task.id}`);
      window.location.href = "index.html";
    } catch (ex) {
      err.textContent = ex.message || "Couldn't delete the task.";
      err.classList.remove("hidden");
      btn.disabled = false;
      btn.textContent = "Delete task";
    }
  });
}

function openTaskModal(task) {
  const form = {
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
  };

  const opts = (items, current, label) => items
    .map((i) => `<option value="${i.id}" ${i.id === current ? "selected" : ""}>${escapeHtml(label(i))}</option>`)
    .join("");
  const personLabel = (p) => `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim();
  const statusOptions = TASK_STATUSES
    .map((s) => `<option value="${s}" ${s === form.status ? "selected" : ""}>${taskStatusLabel(s)}</option>`)
    .join("");

  const body = `
    ${uiField("Title <span class='text-danger'>*</span>",
      `<input id="tf-title" required maxlength="200" value="${escapeHtml(form.title)}" class="${UI_INPUT_CLASS}" />`)}
    ${uiField("Description",
      `<textarea id="tf-description" rows="3" maxlength="2000" class="${UI_INPUT_CLASS}">${escapeHtml(form.description)}</textarea>`)}
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
      ${uiField("Status <span class='text-danger'>*</span>", `<select id="tf-status" class="${UI_INPUT_CLASS}">${statusOptions}</select>`)}
      ${uiField("Priority <span class='text-danger'>*</span>", `<select id="tf-priority" class="${UI_INPUT_CLASS}">${uiOptions(TASK_PRIORITIES, form.priority)}</select>`)}
      ${uiField("Due date", `<input type="date" id="tf-dueDate" value="${form.dueDate}" class="${UI_INPUT_CLASS}" />`)}
    </div>
    ${uiField("Assigned user", `<select id="tf-assigneeId" class="${UI_INPUT_CLASS}">
      <option value="">Unassigned</option>${opts(state.users, form.assigneeId, (u) => u.name)}
    </select>`)}
    ${state.optionsLoaded ? "" : `<p class="text-xs text-muted">Loading assignees and CRM records…</p>`}
    <div class="space-y-3 rounded-md border border-border bg-page/40 p-3">
      <p class="text-xs font-semibold uppercase tracking-wide text-muted">Related CRM records</p>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        ${uiField("Lead", `<select id="tf-leadId" class="${UI_INPUT_CLASS}"><option value="">None</option>${opts(state.leads, form.leadId, personLabel)}</select>`)}
        ${uiField("Contact", `<select id="tf-contactId" class="${UI_INPUT_CLASS}"><option value="">None</option>${opts(state.contacts, form.contactId, personLabel)}</select>`)}
        ${uiField("Company", `<select id="tf-companyId" class="${UI_INPUT_CLASS}"><option value="">None</option>${opts(state.companies, form.companyId, (c) => c.name)}</select>`)}
        ${uiField("Deal", `<select id="tf-dealId" class="${UI_INPUT_CLASS}"><option value="">None</option>${opts(state.deals, form.dealId, (d) => d.title)}</select>`)}
      </div>
    </div>`;

  const modal = uiModal("task-modal-root", "Edit task", body, "Save changes");
  uiSubmit(modal, "Save changes", async () => {
    const val = (id) => document.getElementById(id).value;
    const title = val("tf-title").trim();
    if (!title) throw new Error("Title is required.");
    if (!val("tf-status")) throw new Error("Status is required.");
    if (!val("tf-priority")) throw new Error("Priority is required.");

    state.task = await api.put(`/api/tasks/${task.id}`, {
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
    });
    showToast("Task updated.");
  });
}

// --- init -------------------------------------------------------------
mainEl = renderAppShell("tasks");
if (!taskId) {
  state.loading = false;
  state.error = true;
  state.errorMessage = "No task was specified.";
  render();
} else {
  render();
  loadOptions();
  load();
}
