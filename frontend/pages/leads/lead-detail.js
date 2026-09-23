// Ported from src/app/(app)/leads/[id]/page.tsx + ConvertLeadModal.tsx
const leadId = new URLSearchParams(window.location.search).get("id");
let mainEl;
let currentLead = null;
let owners = [];

async function loadLead() {
  mainEl.innerHTML = `<div class="flex items-center justify-center gap-2 py-16 text-sm text-muted">
    <span class="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-action"></span>Loading lead…</div>`;
  try {
    currentLead = await api.get(`/api/leads/${leadId}`);
    if (owners.length === 0) owners = await api.get("/api/users").catch(() => []);
    renderDetail();
  } catch {
    mainEl.innerHTML = `<div class="flex flex-col items-center justify-center gap-2 rounded-card border border-danger/20 bg-danger/5 px-6 py-16 text-center">
      <p class="text-sm font-semibold text-danger">Something went wrong</p>
      <p class="max-w-sm text-sm text-muted">Couldn't load this lead.</p>
      <button onclick="loadLead()" class="mt-3 rounded-md border border-border bg-white px-3 py-1.5 text-sm font-medium text-navy hover:bg-page">Retry</button>
    </div>`;
  }
}

function row(label, valueHtml) {
  return `<div class="flex items-start justify-between gap-3"><span class="text-muted">${label}</span><span class="text-right text-navy">${valueHtml}</span></div>`;
}

function renderDetail() {
  const lead = currentLead;
  mainEl.innerHTML = `
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <div>
          <a href="index.html" class="text-xs text-muted hover:underline">← Back to leads</a>
          <h1 class="text-lg font-semibold text-navy">${escapeHtml(lead.firstName)} ${escapeHtml(lead.lastName)}</h1>
          <p class="text-sm text-muted">${escapeHtml(lead.jobTitle || "—")} at ${escapeHtml(lead.company?.name || lead.companyName || "—")}</p>
        </div>
        <div class="flex gap-2">
          <button id="edit-btn" class="rounded-md border border-border bg-white px-4 py-2 text-sm text-navy hover:bg-page">Edit</button>
          ${lead.status !== "CONVERTED" ? `<button id="convert-btn" class="rounded-md bg-action px-4 py-2 text-sm font-medium text-white hover:bg-action/90">Convert lead</button>` : ""}
          <button id="delete-btn" class="rounded-md bg-danger px-4 py-2 text-sm font-medium text-white hover:bg-danger/90">Delete</button>
        </div>
      </div>

      <div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div class="space-y-4 lg:col-span-1">
          <div class="rounded-card border border-border bg-surface">
            <div class="px-5 py-4 border-b border-border"><h3 class="text-sm font-semibold text-navy">Lead profile</h3></div>
            <div class="space-y-3 p-5 text-sm">
              <div class="flex gap-2">${badgeHtml(formatEnum(lead.status), leadStatusTone(lead.status))}${badgeHtml(formatEnum(lead.priority), leadPriorityTone(lead.priority))}</div>
              ${row("Email", escapeHtml(lead.email || "—"))}
              ${row("Phone", escapeHtml(lead.phone || "—"))}
              ${row("Source", formatEnum(lead.source))}
              ${row("Owner", escapeHtml(lead.owner?.name || "Unassigned"))}
              ${row("Created by", escapeHtml(lead.createdBy?.name || "—"))}
              ${row("Estimated value", formatCurrency(lead.estimatedValue))}
              ${row("Expected close", formatDate(lead.expectedCloseDate))}
              ${row("Created", formatDate(lead.createdAt))}
              ${row("Updated", formatDate(lead.updatedAt))}
              ${lead.convertedAt ? row("Converted", formatDate(lead.convertedAt)) : ""}
              ${lead.company ? row("Company", `<a href="../companies/detail.html?id=${lead.company.id}" class="text-action hover:underline">${escapeHtml(lead.company.name)}</a>`) : ""}
              ${lead.contact ? row("Contact", `<a href="../contacts/detail.html?id=${lead.contact.id}" class="text-action hover:underline">${escapeHtml(lead.contact.firstName)} ${escapeHtml(lead.contact.lastName)}</a>`) : ""}
              ${lead.deal ? row("Deal", `<a href="../deals/detail.html?id=${lead.deal.id}" class="text-action hover:underline">${escapeHtml(lead.deal.title)}</a>`) : ""}
              ${lead.tags.length > 0 ? `<div class="flex flex-wrap gap-1 pt-1">${lead.tags.map((t) => badgeHtml(t, "neutral")).join("")}</div>` : ""}
              ${lead.notes ? `<div class="pt-2"><p class="text-xs font-medium text-muted">Notes</p><p class="whitespace-pre-wrap text-navy">${escapeHtml(lead.notes)}</p></div>` : ""}
            </div>
          </div>

          <div class="rounded-card border border-border bg-surface">
            <div class="px-5 py-4 border-b border-border"><h3 class="text-sm font-semibold text-navy">Tasks &amp; follow-ups</h3></div>
            <div class="space-y-3 p-5">
              ${lead.tasks.length === 0
                ? `<div class="rounded-card border border-dashed border-border bg-page/50 px-6 py-8 text-center"><p class="text-sm font-semibold text-navy">No tasks yet</p><p class="text-sm text-muted">Add a follow-up task for this lead.</p></div>`
                : `<ul class="space-y-2 text-sm">${lead.tasks.map((t) => `
                    <li class="flex items-center justify-between rounded-md border border-border px-3 py-2">
                      <div>
                        <p class="font-medium ${t.status === "COMPLETED" ? "text-muted line-through" : "text-navy"}">${escapeHtml(t.title)}</p>
                        <p class="text-xs text-muted">${formatEnum(t.priority)} · Due ${formatDate(t.dueDate)} · ${formatEnum(t.status)}</p>
                      </div>
                      ${t.status !== "COMPLETED" ? `<button data-task-id="${t.id}" class="complete-task-btn rounded-md border border-border bg-white px-3 py-1.5 text-sm text-navy hover:bg-page">Complete</button>` : ""}
                    </li>`).join("")}</ul>`}
              <form id="add-task-form" class="space-y-2 border-t border-border pt-3">
                <input id="task-title" placeholder="New task title…" class="lf-input" />
                <div class="grid grid-cols-3 gap-2">
                  <select id="task-assignee" class="lf-input"><option value="">Unassigned</option>${owners.map((o) => `<option value="${o.id}">${escapeHtml(o.name)}</option>`).join("")}</select>
                  <select id="task-priority" class="lf-input">${TASK_PRIORITIES.map((p) => `<option value="${p}" ${p === "MEDIUM" ? "selected" : ""}>${formatEnum(p)}</option>`).join("")}</select>
                  <input id="task-due" type="date" class="lf-input" />
                </div>
                <button type="submit" class="rounded-md bg-action px-3 py-1.5 text-sm font-medium text-white hover:bg-action/90">Add task</button>
              </form>
            </div>
          </div>
        </div>

        <div class="lg:col-span-2">
          <div class="rounded-card border border-border bg-surface">
            <div class="px-5 py-4 border-b border-border"><h3 class="text-sm font-semibold text-navy">Timeline</h3></div>
            <div class="space-y-4 p-5">
              <div class="mb-4 flex justify-end">
              <button id="add-activity-btn" class="rounded-md bg-action px-4 py-2 text-sm font-medium text-white hover:bg-action/90">Log activity</button>
            </div>
              ${lead.activities.length === 0
                ? `<div class="rounded-card border border-dashed border-border bg-page/50 px-6 py-8 text-center"><p class="text-sm font-semibold text-navy">No activity yet</p><p class="text-sm text-muted">Calls, emails, meetings, and notes will appear here.</p></div>`
                : `<ol class="relative space-y-4 border-l border-border pl-4">${[...lead.activities].sort((a, b) => new Date(b.occurredAt) - new Date(a.occurredAt)).map((a) => activityTimelineItem(a)).join("")}</ol>`}
            </div>
          </div>
        </div>
      </div>
    </div>
    <div id="lead-modal-root"></div>
    <style>.lf-input { width: 100%; border-radius: 0.375rem; border: 1px solid #E4E9F2; background: white; padding: 0.5rem 0.75rem; font-size: 0.875rem; color: #0B1E3D; }
    .lf-input:focus { outline: none; box-shadow: 0 0 0 2px rgba(47,92,255,0.4); border-color: #2F5CFF; }</style>`;

  document.getElementById("edit-btn").addEventListener("click", () => openEditModal(lead));
  document.getElementById("convert-btn")?.addEventListener("click", () => openConvertModal(lead));
  document.getElementById("delete-btn").addEventListener("click", handleDelete);
  document.getElementById("add-task-form").addEventListener("submit", addTask);
  document.getElementById("add-activity-btn").addEventListener("click", openActivityModal);
  mainEl.querySelectorAll(".complete-task-btn").forEach((btn) => btn.addEventListener("click", () => completeTask(btn.dataset.taskId)));
}

async function handleDelete() {
  if (!confirm(`Delete lead "${currentLead.firstName} ${currentLead.lastName}"? This cannot be undone.`)) return;
  await api.del(`/api/leads/${currentLead.id}`);
  window.location.href = "index.html";
}

async function addTask(e) {
  e.preventDefault();
  const title = document.getElementById("task-title").value.trim();
  if (!title) return;
  await api.post("/api/tasks", {
    title, leadId: currentLead.id,
    assigneeId: document.getElementById("task-assignee").value || undefined,
    priority: document.getElementById("task-priority").value,
    dueDate: document.getElementById("task-due").value || undefined,
  });
  loadLead();
}

async function completeTask(id) {
  await api.put(`/api/tasks/${id}`, { status: "COMPLETED" });
  loadLead();
}

// Opens the shared activity modal, pre-linked to this lead.
function openActivityModal() {
  buildActivityModal({
    activity: null,
    lockedRelation: {
      kind: "lead", kindLabel: "Lead",
      id: currentLead.id, label: `${currentLead.firstName} ${currentLead.lastName}`,
    },
    rootId: "lead-modal-root",
    fetchOptions: true,
    onSaved: () => loadLead(),
  });
}

// --- Edit modal (reuses the same form as the list page's New Lead modal) ---
function openEditModal(lead) {
  api.get("/api/companies?pageSize=100&sortBy=name&sortDir=asc").then((c) => {
    window.leadFormCompanies = c.items;
  }).catch(() => { window.leadFormCompanies = []; });
  renderEditForm(lead);
}

function renderEditForm(lead) {
  const companies = window.leadFormCompanies || [];
  const root = document.getElementById("lead-modal-root");
  root.innerHTML = `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 px-4">
      <div role="dialog" aria-modal="true" class="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-card border border-border bg-white shadow-lg">
        <div class="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 class="text-sm font-semibold text-navy">Edit lead</h2>
          <button id="ef-close" class="text-muted hover:text-navy">✕</button>
        </div>
        <form id="ef-form" class="space-y-4 p-5">
          <p id="ef-error" class="hidden rounded-md border border-danger/20 bg-danger/5 px-3 py-2 text-sm text-danger"></p>
          <div class="grid grid-cols-2 gap-3">
            ${field("First name", `<input required id="ef-firstName" value="${escapeHtml(lead.firstName)}" class="lf-input" />`)}
            ${field("Last name", `<input required id="ef-lastName" value="${escapeHtml(lead.lastName)}" class="lf-input" />`)}
          </div>
          <div class="grid grid-cols-2 gap-3">
            ${field("Email", `<input type="email" id="ef-email" value="${escapeHtml(lead.email || "")}" class="lf-input" />`)}
            ${field("Phone", `<input id="ef-phone" value="${escapeHtml(lead.phone || "")}" class="lf-input" />`)}
          </div>
          <div class="grid grid-cols-3 gap-3">
            ${field("Source", `<select id="ef-source" class="lf-input">${LEAD_SOURCES.map((s) => `<option value="${s}" ${s === lead.source ? "selected" : ""}>${formatEnum(s)}</option>`).join("")}</select>`)}
            ${field("Status", `<select id="ef-status" class="lf-input">${LEAD_STATUSES.map((s) => `<option value="${s}" ${s === lead.status ? "selected" : ""}>${formatEnum(s)}</option>`).join("")}</select>`)}
            ${field("Priority", `<select id="ef-priority" class="lf-input">${LEAD_PRIORITIES.map((p) => `<option value="${p}" ${p === lead.priority ? "selected" : ""}>${formatEnum(p)}</option>`).join("")}</select>`)}
          </div>
          <div class="grid grid-cols-2 gap-3">
            ${field("Owner", `<select id="ef-ownerId" class="lf-input"><option value="">Unassigned</option>${owners.map((o) => `<option value="${o.id}" ${o.id === lead.owner?.id ? "selected" : ""}>${escapeHtml(o.name)}</option>`).join("")}</select>`)}
            ${field("Estimated value (₹)", `<input type="number" min="0" id="ef-estimatedValue" value="${lead.estimatedValue ?? ""}" class="lf-input" />`)}
          </div>
          ${field("Notes", `<textarea id="ef-notes" rows="3" class="lf-input">${escapeHtml(lead.notes || "")}</textarea>`)}
          <div class="flex justify-end gap-2 pt-2">
            <button type="button" id="ef-cancel" class="rounded-md border border-border bg-white px-4 py-2 text-sm text-navy hover:bg-page">Cancel</button>
            <button type="submit" class="rounded-md bg-action px-4 py-2 text-sm font-medium text-white hover:bg-action/90">Save changes</button>
          </div>
        </form>
      </div>
    </div>`;
  document.getElementById("ef-close").addEventListener("click", () => (root.innerHTML = ""));
  document.getElementById("ef-cancel").addEventListener("click", () => (root.innerHTML = ""));
  document.getElementById("ef-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const val = (id) => document.getElementById(id).value;
    try {
      await api.put(`/api/leads/${lead.id}`, {
        firstName: val("ef-firstName"), lastName: val("ef-lastName"), email: val("ef-email"), phone: val("ef-phone"),
        source: val("ef-source"), status: val("ef-status"), priority: val("ef-priority"),
        ownerId: val("ef-ownerId") || undefined,
        estimatedValue: val("ef-estimatedValue") ? Number(val("ef-estimatedValue")) : undefined,
        notes: val("ef-notes"),
      });
      root.innerHTML = "";
      loadLead();
    } catch (err) {
      document.getElementById("ef-error").textContent = err.message;
      document.getElementById("ef-error").classList.remove("hidden");
    }
  });
}

function field(label, inputHtml) {
  return `<label class="block space-y-1"><span class="text-xs font-medium text-muted">${label}</span>${inputHtml}</label>`;
}

// --- Convert modal ---
function openConvertModal(lead) {
  const root = document.getElementById("lead-modal-root");
  const defaultTitle = `${lead.firstName} ${lead.lastName} — New Opportunity`;
  root.innerHTML = `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 px-4">
      <div role="dialog" aria-modal="true" class="w-full max-w-lg rounded-card border border-border bg-white shadow-lg">
        <div class="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 class="text-sm font-semibold text-navy">Convert lead</h2>
          <button id="cf-close" class="text-muted hover:text-navy">✕</button>
        </div>
        <form id="cf-form" class="space-y-4 p-5">
          <p id="cf-error" class="hidden rounded-md border border-danger/20 bg-danger/5 px-3 py-2 text-sm text-danger"></p>
          <p class="text-sm text-muted">This will create (or link to) a company${lead.companyName ? ` — "${escapeHtml(lead.companyName)}"` : ""} and a contact for
            <strong class="text-navy">${escapeHtml(lead.firstName)} ${escapeHtml(lead.lastName)}</strong>. Existing records with a matching name, email, or phone are reused instead of duplicated.</p>
          <label class="flex items-center gap-2 text-sm text-navy">
            <input type="checkbox" id="cf-create-deal" checked class="h-4 w-4 rounded border-border" /> Also create a deal in the pipeline
          </label>
          <div id="cf-deal-fields" class="grid grid-cols-2 gap-3">
            <label class="block space-y-1"><span class="text-xs font-medium text-muted">Deal name</span><input id="cf-deal-title" value="${escapeHtml(defaultTitle)}" class="lf-input" /></label>
            <label class="block space-y-1"><span class="text-xs font-medium text-muted">Amount (₹)</span><input type="number" min="0" id="cf-deal-amount" value="${lead.estimatedValue ?? ""}" class="lf-input" /></label>
          </div>
          <div class="flex justify-end gap-2 pt-2">
            <button type="button" id="cf-cancel" class="rounded-md border border-border bg-white px-4 py-2 text-sm text-navy hover:bg-page">Cancel</button>
            <button type="submit" class="rounded-md bg-action px-4 py-2 text-sm font-medium text-white hover:bg-action/90">Convert lead</button>
          </div>
        </form>
      </div>
    </div>
    <style>.lf-input { width: 100%; border-radius: 0.375rem; border: 1px solid #E4E9F2; background: white; padding: 0.5rem 0.75rem; font-size: 0.875rem; color: #0B1E3D; }</style>`;

  document.getElementById("cf-close").addEventListener("click", () => (root.innerHTML = ""));
  document.getElementById("cf-cancel").addEventListener("click", () => (root.innerHTML = ""));
  document.getElementById("cf-create-deal").addEventListener("change", (e) => {
    document.getElementById("cf-deal-fields").style.display = e.target.checked ? "grid" : "none";
  });
  document.getElementById("cf-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const createDeal = document.getElementById("cf-create-deal").checked;
    try {
      await api.post(`/api/leads/${lead.id}/convert`, {
        company: { mode: "new" },
        contact: { mode: "new" },
        deal: createDeal
          ? { create: true, title: document.getElementById("cf-deal-title").value, amount: document.getElementById("cf-deal-amount").value ? Number(document.getElementById("cf-deal-amount").value) : undefined }
          : { create: false },
      });
      root.innerHTML = "";
      loadLead();
    } catch (err) {
      document.getElementById("cf-error").textContent = err.message;
      document.getElementById("cf-error").classList.remove("hidden");
    }
  });
}

mainEl = renderAppShell("leads");
loadLead();
