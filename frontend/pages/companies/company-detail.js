// Ported from src/app/(app)/companies/[id]/page.tsx
const companyId = new URLSearchParams(window.location.search).get("id");
let mainEl, company = null, owners = [];

async function loadCompany() {
  mainEl.innerHTML = uiLoading("Loading company…");
  try {
    company = await api.get(`/api/companies/${companyId}`);
    if (!owners.length) owners = await api.get("/api/users").catch(() => []);
    renderDetail();
  } catch {
    mainEl.innerHTML = uiError("retry-btn", "Couldn't load this company.");
    document.getElementById("retry-btn").addEventListener("click", loadCompany);
  }
}

function row(label, valueHtml) {
  return `<div class="flex items-start justify-between gap-3"><span class="text-muted">${label}</span><span class="text-right text-navy">${valueHtml}</span></div>`;
}

function renderDetail() {
  const c = company;

  const contactsHtml = c.contacts.length === 0
    ? uiEmpty("No contacts yet", "Contacts linked to this company will appear here.")
    : `<ul class="space-y-2 text-sm">${c.contacts.map((ct) => `
        <li class="flex items-center justify-between rounded-md border border-border px-3 py-2">
          <div>
            <a href="../contacts/detail.html?id=${ct.id}" class="font-medium text-navy hover:underline">${escapeHtml(ct.firstName)} ${escapeHtml(ct.lastName)}</a>
            <p class="text-xs text-muted">${escapeHtml(ct.jobTitle || "—")}${ct.email ? ` · ${escapeHtml(ct.email)}` : ""}${ct.phone ? ` · ${escapeHtml(ct.phone)}` : ""}</p>
          </div>
          ${badgeHtml(formatEnum(ct.status), contactStatusTone(ct.status))}
        </li>`).join("")}</ul>`;

  const dealsHtml = c.deals.length === 0
    ? uiEmpty("No deals yet", "Deals linked to this company will appear here.")
    : `<ul class="space-y-2 text-sm">${c.deals.map((d) => `
        <li class="flex items-center justify-between rounded-md border border-border px-3 py-2">
          <div>
            <a href="../deals/detail.html?id=${d.id}" class="font-medium text-navy hover:underline">${escapeHtml(d.title)}</a>
            <p class="text-xs text-muted">${escapeHtml(d.stage?.name || "—")} · ${formatCurrency(d.amount)}${
              d.contact ? ` · ${escapeHtml(d.contact.firstName)} ${escapeHtml(d.contact.lastName)}` : ""} · Closes ${formatDate(d.expectedCloseDate)}</p>
          </div>
          ${badgeHtml(formatEnum(d.status), dealStatusTone(d.status))}
        </li>`).join("")}</ul>`;

  const leadsHtml = c.leads.length === 0
    ? `<p class="text-sm text-muted">No linked leads.</p>`
    : `<ul class="space-y-2 text-sm">${c.leads.map((l) => `
        <li class="flex items-center justify-between rounded-md border border-border px-3 py-2">
          <a href="../leads/detail.html?id=${l.id}" class="font-medium text-navy hover:underline">${escapeHtml(l.firstName)} ${escapeHtml(l.lastName)}</a>
          ${badgeHtml(formatEnum(l.status), leadStatusTone(l.status))}
        </li>`).join("")}</ul>`;

  const tasksHtml = c.tasks.length === 0
    ? uiEmpty("No tasks yet", "Add a follow-up task for this company.")
    : `<ul class="space-y-2 text-sm">${c.tasks.map((t) => `
        <li class="flex items-center justify-between rounded-md border border-border px-3 py-2">
          <div>
            <p class="font-medium ${t.status === "COMPLETED" ? "text-muted line-through" : "text-navy"}">${escapeHtml(t.title)}</p>
            <p class="text-xs text-muted">${formatEnum(t.priority)} · Due ${formatDate(t.dueDate)} · ${formatEnum(t.status)}</p>
          </div>
          ${t.status !== "COMPLETED" ? `<button data-task-id="${t.id}" class="complete-task rounded-md border border-border bg-white px-3 py-1.5 text-sm text-navy hover:bg-page">Complete</button>` : ""}
        </li>`).join("")}</ul>`;

  const timelineHtml = c.activities.length === 0
    ? uiEmpty("No activity yet", "Calls, emails, meetings, and notes will appear here.")
    : `<ol class="relative space-y-4 border-l border-border pl-4">${c.activities.map((a) => activityTimelineItem(a)).join("")}</ol>`;

  mainEl.innerHTML = `
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <div>
          <a href="index.html" class="text-xs text-muted hover:underline">← Back to companies</a>
          <h1 class="text-lg font-semibold text-navy">${escapeHtml(c.name)}</h1>
          <p class="text-sm text-muted">${escapeHtml(c.industry || "—")}</p>
        </div>
        <div class="flex gap-2">
          <button id="edit-btn" class="rounded-md border border-border bg-white px-4 py-2 text-sm text-navy hover:bg-page">Edit</button>
          <button id="delete-btn" class="rounded-md bg-danger px-4 py-2 text-sm font-medium text-white hover:bg-danger/90">Delete</button>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-4 md:grid-cols-4">
        ${[["Contacts", c.counts.contacts], ["Deals", c.counts.deals]].map(([label, value]) => `
          <div class="rounded-card border border-border bg-surface p-5">
            <p class="text-xs font-medium uppercase tracking-wide text-muted">${label}</p>
            <p class="mt-2 text-2xl font-semibold tabular-nums text-navy">${value}</p>
          </div>`).join("")}
      </div>

      <div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div class="space-y-4 lg:col-span-1">
          <div class="rounded-card border border-border bg-surface">
            <div class="px-5 py-4 border-b border-border"><h3 class="text-sm font-semibold text-navy">Company profile</h3></div>
            <div class="space-y-3 p-5 text-sm">
              ${row("Industry", escapeHtml(c.industry || "—"))}
              ${row("Website", c.website ? `<a href="${escapeHtml(c.website)}" target="_blank" rel="noopener" class="text-action hover:underline">${escapeHtml(c.website)}</a>` : "—")}
              ${row("Phone", escapeHtml(c.phone || "—"))}
              ${row("Owner", escapeHtml(c.owner?.name || "Unassigned"))}
              ${row("Created", formatDate(c.createdAt))}
              ${row("Updated", formatDate(c.updatedAt))}
            </div>
          </div>
          ${uiCard("Linked leads", leadsHtml)}
        </div>

        <div class="space-y-4 lg:col-span-2">
          ${uiCard("Contacts", contactsHtml)}
          ${uiCard("Deals", dealsHtml)}
          ${uiCard("Tasks &amp; follow-ups", `
            ${tasksHtml}
            <form id="add-task-form" class="mt-3 space-y-2 border-t border-border pt-3">
              <input id="task-title" placeholder="New task title…" class="${UI_INPUT_CLASS}" />
              <div class="grid grid-cols-3 gap-2">
                <select id="task-assignee" class="${UI_INPUT_CLASS}"><option value="">Unassigned</option>${owners.map((o) => `<option value="${o.id}">${escapeHtml(o.name)}</option>`).join("")}</select>
                <select id="task-priority" class="${UI_INPUT_CLASS}">${uiOptions(TASK_PRIORITIES, "MEDIUM")}</select>
                <input id="task-due" type="date" class="${UI_INPUT_CLASS}" />
              </div>
              <button type="submit" class="rounded-md bg-action px-3 py-1.5 text-sm font-medium text-white hover:bg-action/90">Add task</button>
            </form>`)}
          ${uiCard("Timeline", `
            <div class="mb-4 flex justify-end">
              <button id="add-activity-btn" class="rounded-md bg-action px-4 py-2 text-sm font-medium text-white hover:bg-action/90">Log activity</button>
            </div>
            ${timelineHtml}`)}
        </div>
      </div>
    </div>
    <div id="modal-root"></div>`;

  document.getElementById("edit-btn").addEventListener("click", openEditModal);
  document.getElementById("delete-btn").addEventListener("click", handleDelete);
  document.getElementById("add-task-form").addEventListener("submit", addTask);
  document.getElementById("add-activity-btn").addEventListener("click", openActivityModal);
  mainEl.querySelectorAll(".complete-task").forEach((b) =>
    b.addEventListener("click", () => completeTask(b.dataset.taskId)));
}

async function handleDelete() {
  if (!confirm(`Delete company "${company.name}"? This cannot be undone.`)) return;
  await api.del(`/api/companies/${company.id}`);
  window.location.href = "index.html";
}

async function addTask(e) {
  e.preventDefault();
  const title = document.getElementById("task-title").value.trim();
  if (!title) return;
  await api.post("/api/tasks", {
    title, companyId: company.id,
    assigneeId: document.getElementById("task-assignee").value || undefined,
    priority: document.getElementById("task-priority").value,
    dueDate: document.getElementById("task-due").value || undefined,
  });
  loadCompany();
}

async function completeTask(id) {
  await api.put(`/api/tasks/${id}`, { status: "COMPLETED" });
  loadCompany();
}

// Opens the shared activity modal, pre-linked to this company.
function openActivityModal() {
  buildActivityModal({
    activity: null,
    lockedRelation: {
      kind: "company", kindLabel: "Company",
      id: company.id, label: company.name,
    },
    rootId: "modal-root",
    fetchOptions: true,
    onSaved: () => loadCompany(),
  });
}

function openEditModal() {
  const c = company;
  const body = `
    ${uiField("Company name", `<input required id="ef-name" value="${escapeHtml(c.name)}" class="${UI_INPUT_CLASS}" />`)}
    ${uiField("Industry", `<input id="ef-industry" value="${escapeHtml(c.industry || "")}" class="${UI_INPUT_CLASS}" />`)}
    <div class="grid grid-cols-2 gap-3">
      ${uiField("Website", `<input id="ef-website" placeholder="https://…" value="${escapeHtml(c.website || "")}" class="${UI_INPUT_CLASS}" />`)}
      ${uiField("Phone", `<input id="ef-phone" value="${escapeHtml(c.phone || "")}" class="${UI_INPUT_CLASS}" />`)}
    </div>
    ${uiField("Owner", `<select id="ef-ownerId" class="${UI_INPUT_CLASS}"><option value="">Unassigned</option>${
      owners.map((o) => `<option value="${o.id}" ${o.id === c.owner?.id ? "selected" : ""}>${escapeHtml(o.name)}</option>`).join("")}</select>`)}`;

  const modal = uiModal("modal-root", "Edit company", body, "Save changes");
  uiSubmit(modal, "Save changes", async () => {
    const v = (id) => document.getElementById(id).value;
    await api.put(`/api/companies/${c.id}`, {
      name: v("ef-name"), industry: v("ef-industry"), website: v("ef-website"),
      phone: v("ef-phone"), ownerId: v("ef-ownerId") || undefined,
    });
    loadCompany();
  });
}

mainEl = renderAppShell("companies");
loadCompany();
