// Ported from src/app/(app)/contacts/[id]/page.tsx
const contactId = new URLSearchParams(window.location.search).get("id");
let mainEl, contact = null, owners = [], companies = [];

async function loadContact() {
  mainEl.innerHTML = uiLoading("Loading contact…");
  try {
    contact = await api.get(`/api/contacts/${contactId}`);
    if (!owners.length) owners = await api.get("/api/users").catch(() => []);
    if (!companies.length) {
      companies = (await api.get("/api/companies?pageSize=100&sortBy=name&sortDir=asc").catch(() => ({ items: [] }))).items;
    }
    renderDetail();
  } catch {
    mainEl.innerHTML = uiError("retry-btn", "Couldn't load this contact.");
    document.getElementById("retry-btn").addEventListener("click", loadContact);
  }
}

function row(label, valueHtml) {
  return `<div class="flex items-start justify-between gap-3"><span class="text-muted">${label}</span><span class="text-right text-navy">${valueHtml}</span></div>`;
}

function renderDetail() {
  const c = contact;
  const profile = `
    <div class="space-y-3 p-5 text-sm">
      <div class="flex gap-2">${badgeHtml(formatEnum(c.status), contactStatusTone(c.status))}${badgeHtml(formatEnum(c.source), "neutral")}</div>
      ${row("Email", c.email ? `<a href="mailto:${escapeHtml(c.email)}" class="text-action hover:underline">${escapeHtml(c.email)}</a>` : "—")}
      ${row("Phone", escapeHtml(c.phone || "—"))}
      ${row("Mobile", escapeHtml(c.mobilePhone || "—"))}
      ${row("Job title", escapeHtml(c.jobTitle || "—"))}
      ${row("Company", c.company ? `<a href="../companies/detail.html?id=${c.company.id}" class="text-action hover:underline">${escapeHtml(c.company.name)}</a>` : "—")}
      ${row("Owner", escapeHtml(c.owner?.name || "Unassigned"))}
      ${row("Last contacted", formatDate(c.lastContactedAt))}
      ${row("Created", formatDate(c.createdAt))}
      ${[c.address, c.city, c.state, c.country, c.postalCode].some(Boolean)
        ? row("Address", escapeHtml([c.address, c.city, c.state, c.country, c.postalCode].filter(Boolean).join(", ")))
        : ""}
      ${c.website ? row("Website", `<a href="${escapeHtml(c.website)}" target="_blank" rel="noopener" class="text-action hover:underline">${escapeHtml(c.website)}</a>`) : ""}
      ${c.linkedinUrl ? row("LinkedIn", `<a href="${escapeHtml(c.linkedinUrl)}" target="_blank" rel="noopener" class="text-action hover:underline">Profile</a>`) : ""}
      ${c.tags.length ? `<div class="flex flex-wrap gap-1 pt-1">${c.tags.map((t) => badgeHtml(t, "neutral")).join("")}</div>` : ""}
      ${c.notes ? `<div class="pt-2"><p class="text-xs font-medium text-muted">Notes</p><p class="whitespace-pre-wrap text-navy">${escapeHtml(c.notes)}</p></div>` : ""}
    </div>`;

  const dealsHtml = c.deals.length === 0
    ? uiEmpty("No deals yet", "Deals linked to this contact will appear here.")
    : `<ul class="space-y-2 text-sm">${c.deals.map((d) => `
        <li class="flex items-center justify-between rounded-md border border-border px-3 py-2">
          <div>
            <a href="../deals/detail.html?id=${d.id}" class="font-medium text-navy hover:underline">${escapeHtml(d.title)}</a>
            <p class="text-xs text-muted">${escapeHtml(d.stage?.name || "—")} · ${formatCurrency(d.amount)} · Closes ${formatDate(d.expectedCloseDate)}</p>
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
    ? uiEmpty("No tasks yet", "Add a follow-up task for this contact.")
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
          <a href="index.html" class="text-xs text-muted hover:underline">← Back to contacts</a>
          <h1 class="text-lg font-semibold text-navy">${escapeHtml(c.firstName)} ${escapeHtml(c.lastName)}</h1>
          <p class="text-sm text-muted">${escapeHtml(c.jobTitle || "—")}${c.company ? ` at ${escapeHtml(c.company.name)}` : ""}</p>
        </div>
        <div class="flex gap-2">
          <button id="email-btn" class="rounded-md border border-border bg-white px-4 py-2 text-sm text-navy hover:bg-page">Send email</button>
          <button id="edit-btn" class="rounded-md border border-border bg-white px-4 py-2 text-sm text-navy hover:bg-page">Edit</button>
          <button id="delete-btn" class="rounded-md bg-danger px-4 py-2 text-sm font-medium text-white hover:bg-danger/90">Delete</button>
        </div>
      </div>

      <div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div class="space-y-4 lg:col-span-1">
          <div class="rounded-card border border-border bg-surface">
            <div class="px-5 py-4 border-b border-border"><h3 class="text-sm font-semibold text-navy">Contact profile</h3></div>
            ${profile}
          </div>
          ${uiCard("Deals", dealsHtml)}
          ${uiCard("Linked leads", leadsHtml)}
        </div>

        <div class="space-y-4 lg:col-span-2">
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
  document.getElementById("email-btn").addEventListener("click", openEmailModal);
  document.getElementById("delete-btn").addEventListener("click", handleDelete);
  document.getElementById("add-task-form").addEventListener("submit", addTask);
  document.getElementById("add-activity-btn").addEventListener("click", openActivityModal);
  mainEl.querySelectorAll(".complete-task").forEach((b) =>
    b.addEventListener("click", () => completeTask(b.dataset.taskId)));
}

async function handleDelete() {
  if (!confirm(`Delete contact "${contact.firstName} ${contact.lastName}"? This cannot be undone.`)) return;
  await api.del(`/api/contacts/${contact.id}`);
  window.location.href = "index.html";
}

async function addTask(e) {
  e.preventDefault();
  const title = document.getElementById("task-title").value.trim();
  if (!title) return;
  await api.post("/api/tasks", {
    title, contactId: contact.id,
    assigneeId: document.getElementById("task-assignee").value || undefined,
    priority: document.getElementById("task-priority").value,
    dueDate: document.getElementById("task-due").value || undefined,
  });
  loadContact();
}

async function completeTask(id) {
  await api.put(`/api/tasks/${id}`, { status: "COMPLETED" });
  loadContact();
}

// Opens the shared activity modal, pre-linked to this contact.
function openActivityModal() {
  buildActivityModal({
    activity: null,
    lockedRelation: {
      kind: "contact", kindLabel: "Contact",
      id: contact.id, label: `${contact.firstName} ${contact.lastName}`,
    },
    rootId: "modal-root",
    fetchOptions: true,
    onSaved: () => loadContact(),
  });
}

function openEditModal() {
  const c = contact;
  const body = `
    <div class="grid grid-cols-2 gap-3">
      ${uiField("First name", `<input required id="ef-firstName" value="${escapeHtml(c.firstName)}" class="${UI_INPUT_CLASS}" />`)}
      ${uiField("Last name", `<input required id="ef-lastName" value="${escapeHtml(c.lastName)}" class="${UI_INPUT_CLASS}" />`)}
    </div>
    <div class="grid grid-cols-2 gap-3">
      ${uiField("Job title", `<input id="ef-jobTitle" value="${escapeHtml(c.jobTitle || "")}" class="${UI_INPUT_CLASS}" />`)}
      ${uiField("Company", `<select id="ef-companyId" class="${UI_INPUT_CLASS}"><option value="">No company</option>${
        companies.map((x) => `<option value="${x.id}" ${x.id === c.company?.id ? "selected" : ""}>${escapeHtml(x.name)}</option>`).join("")}</select>`)}
    </div>
    <div class="grid grid-cols-3 gap-3">
      ${uiField("Email", `<input type="email" id="ef-email" value="${escapeHtml(c.email || "")}" class="${UI_INPUT_CLASS}" />`)}
      ${uiField("Phone", `<input id="ef-phone" value="${escapeHtml(c.phone || "")}" class="${UI_INPUT_CLASS}" />`)}
      ${uiField("Mobile", `<input id="ef-mobilePhone" value="${escapeHtml(c.mobilePhone || "")}" class="${UI_INPUT_CLASS}" />`)}
    </div>
    <div class="grid grid-cols-3 gap-3">
      ${uiField("Status", `<select id="ef-status" class="${UI_INPUT_CLASS}">${uiOptions(CONTACT_STATUSES, c.status)}</select>`)}
      ${uiField("Source", `<select id="ef-source" class="${UI_INPUT_CLASS}">${uiOptions(LEAD_SOURCES, c.source)}</select>`)}
      ${uiField("Owner", `<select id="ef-ownerId" class="${UI_INPUT_CLASS}"><option value="">Unassigned</option>${
        owners.map((o) => `<option value="${o.id}" ${o.id === c.owner?.id ? "selected" : ""}>${escapeHtml(o.name)}</option>`).join("")}</select>`)}
    </div>
    ${uiField("Tags (comma separated)", `<input id="ef-tags" value="${escapeHtml((c.tags || []).join(", "))}" class="${UI_INPUT_CLASS}" />`)}
    ${uiField("Last contacted", `<input type="date" id="ef-lastContactedAt" value="${c.lastContactedAt ? c.lastContactedAt.slice(0, 10) : ""}" class="${UI_INPUT_CLASS}" />`)}
    ${uiField("Notes", `<textarea id="ef-notes" rows="3" class="${UI_INPUT_CLASS}">${escapeHtml(c.notes || "")}</textarea>`)}`;

  const modal = uiModal("modal-root", "Edit contact", body, "Save changes");
  uiSubmit(modal, "Save changes", async () => {
    const v = (id) => document.getElementById(id).value;
    await api.put(`/api/contacts/${c.id}`, {
      firstName: v("ef-firstName"), lastName: v("ef-lastName"), jobTitle: v("ef-jobTitle"),
      companyId: v("ef-companyId") || undefined, email: v("ef-email"), phone: v("ef-phone"),
      mobilePhone: v("ef-mobilePhone"), status: v("ef-status"), source: v("ef-source"),
      ownerId: v("ef-ownerId") || undefined,
      tags: v("ef-tags") ? v("ef-tags").split(",").map((t) => t.trim()).filter(Boolean) : [],
      lastContactedAt: v("ef-lastContactedAt") || undefined, notes: v("ef-notes"),
    });
    loadContact();
  });
}

function openEmailModal() {
  const body = `
    ${uiField("To", `<input required id="em-to" value="${escapeHtml(contact.email || "")}" class="${UI_INPUT_CLASS}" />`)}
    <div class="grid grid-cols-2 gap-3">
      ${uiField("Cc", `<input id="em-cc" class="${UI_INPUT_CLASS}" />`)}
      ${uiField("Bcc", `<input id="em-bcc" class="${UI_INPUT_CLASS}" />`)}
    </div>
    ${uiField("Subject", `<input required id="em-subject" class="${UI_INPUT_CLASS}" />`)}
    ${uiField("Message", `<textarea required id="em-body" rows="6" class="${UI_INPUT_CLASS}"></textarea>`)}
    <p class="text-xs text-muted">Sent through the CRM's configured provider and logged against this contact's timeline.</p>`;

  const modal = uiModal("modal-root", "Send email", body, "Send email");
  uiSubmit(modal, "Send email", async () => {
    const v = (id) => document.getElementById(id).value;
    await api.post("/api/email/send", {
      to: v("em-to"), cc: v("em-cc") || undefined, bcc: v("em-bcc") || undefined,
      subject: v("em-subject"), body: v("em-body"),
      relatedContactId: contact.id,
      relatedCompanyId: contact.company?.id || undefined,
    });
    loadContact();
  });
}

mainEl = renderAppShell("contacts");
loadContact();
