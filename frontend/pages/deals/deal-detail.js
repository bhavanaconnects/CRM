// Ported from src/app/(app)/deals/[id]/page.tsx
const dealId = new URLSearchParams(window.location.search).get("id");
let mainEl, deal = null, owners = [], pipelines = [], companies = [], contacts = [];
// Follow-ups are calendar events linked to this deal (relatedDealId).
// Ported from the FollowUpsCard in src/app/(app)/deals/[id]/page.tsx.
let followUps = [];
const FOLLOW_UP_TYPES = ["CALL", "MEETING", "DEMO", "FOLLOW_UP", "TASK", "OTHER"];

async function loadDeal() {
  mainEl.innerHTML = uiLoading("Loading deal…");
  try {
    deal = await api.get(`/api/deals/${dealId}`);
    // Non-fatal: the follow-ups list is a secondary panel on the deal page.
    followUps = await api.get(`/api/calendar?relatedDealId=${dealId}`).catch(() => []);
    if (!owners.length) owners = await api.get("/api/users").catch(() => []);
    if (!pipelines.length) pipelines = await api.get("/api/pipelines").catch(() => []);
    if (!companies.length) companies = (await api.get("/api/companies?pageSize=100&sortBy=name&sortDir=asc").catch(() => ({ items: [] }))).items;
    if (!contacts.length) contacts = (await api.get("/api/contacts?pageSize=100&sortBy=name&sortDir=asc").catch(() => ({ items: [] }))).items;
    renderDetail();
  } catch {
    mainEl.innerHTML = uiError("retry-btn", "Couldn't load this deal.");
    document.getElementById("retry-btn").addEventListener("click", loadDeal);
  }
}

function row(label, valueHtml) {
  return `<div class="flex items-start justify-between gap-3"><span class="text-muted">${label}</span><span class="text-right text-navy">${valueHtml}</span></div>`;
}

function renderDetail() {
  const d = deal;
  const pipeline = pipelines.find((p) => p.id === d.pipeline?.id);

  const stageBar = pipeline ? `
    <div class="flex flex-wrap gap-1">
      ${pipeline.stages.map((s) => `
        <button data-stage="${s.id}" class="stage-btn rounded-md border px-3 py-1.5 text-xs ${
          s.id === d.stage?.id ? "border-action bg-action text-white" : "border-border bg-white text-navy hover:bg-page"
        }">${escapeHtml(s.name)}</button>`).join("")}
    </div>` : "";

  const tasksHtml = d.tasks.length === 0
    ? uiEmpty("No tasks yet", "Add a follow-up task for this deal.")
    : `<ul class="space-y-2 text-sm">${d.tasks.map((t) => `
        <li class="flex items-center justify-between rounded-md border border-border px-3 py-2">
          <div>
            <p class="font-medium ${t.status === "COMPLETED" ? "text-muted line-through" : "text-navy"}">${escapeHtml(t.title)}</p>
            <p class="text-xs text-muted">${formatEnum(t.priority)} · Due ${formatDate(t.dueDate)} · ${formatEnum(t.status)}</p>
          </div>
          ${t.status !== "COMPLETED" ? `<button data-task-id="${t.id}" class="complete-task rounded-md border border-border bg-white px-3 py-1.5 text-sm text-navy hover:bg-page">Complete</button>` : ""}
        </li>`).join("")}</ul>`;

  const timelineHtml = d.activities.length === 0
    ? uiEmpty("No activity yet", "Calls, emails, meetings, and notes will appear here.")
    : `<ol class="relative space-y-4 border-l border-border pl-4">${d.activities.map((a) => activityTimelineItem(a)).join("")}</ol>`;

  mainEl.innerHTML = `
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <div>
          <a href="index.html" class="text-xs text-muted hover:underline">← Back to deals</a>
          <h1 class="text-lg font-semibold text-navy">${escapeHtml(d.title)}</h1>
          <p class="text-sm text-muted">${escapeHtml(d.company?.name || "No company")}${
            d.contact ? ` · ${escapeHtml(d.contact.firstName)} ${escapeHtml(d.contact.lastName)}` : ""}</p>
        </div>
        <div class="flex gap-2">
          ${d.status === "OPEN" ? `
            <button id="won-btn" class="rounded-md bg-success px-4 py-2 text-sm font-medium text-white hover:bg-success/90">Mark won</button>
            <button id="lost-btn" class="rounded-md border border-danger/40 bg-white px-4 py-2 text-sm font-medium text-danger hover:bg-danger/5">Mark lost</button>`
            : `<button id="reopen-btn" class="rounded-md border border-border bg-white px-4 py-2 text-sm text-navy hover:bg-page">Reopen</button>`}
          <button id="edit-btn" class="rounded-md border border-border bg-white px-4 py-2 text-sm text-navy hover:bg-page">Edit</button>
          <button id="delete-btn" class="rounded-md bg-danger px-4 py-2 text-sm font-medium text-white hover:bg-danger/90">Delete</button>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-4 md:grid-cols-4">
        ${[["Amount", formatCurrency(d.amount)],
           ["Probability", d.probability != null ? d.probability + "%" : "—"],
           ["Stage", escapeHtml(d.stage?.name || "—")],
           ["Status", formatEnum(d.status)]].map(([label, value]) => `
          <div class="rounded-card border border-border bg-surface p-5">
            <p class="text-xs font-medium uppercase tracking-wide text-muted">${label}</p>
            <p class="mt-2 text-lg font-semibold text-navy">${value}</p>
          </div>`).join("")}
      </div>

      ${stageBar ? uiCard("Move stage", stageBar) : ""}

      <div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div class="space-y-4 lg:col-span-1">
          <div class="rounded-card border border-border bg-surface">
            <div class="px-5 py-4 border-b border-border"><h3 class="text-sm font-semibold text-navy">Deal profile</h3></div>
            <div class="space-y-3 p-5 text-sm">
              <div>${badgeHtml(formatEnum(d.status), dealStatusTone(d.status))}</div>
              ${row("Pipeline", escapeHtml(d.pipeline?.name || "—"))}
              ${row("Stage", escapeHtml(d.stage?.name || "—"))}
              ${row("Amount", formatCurrency(d.amount))}
              ${row("Owner", escapeHtml(d.owner?.name || "Unassigned"))}
              ${row("Company", d.company ? `<a href="../companies/detail.html?id=${d.company.id}" class="text-action hover:underline">${escapeHtml(d.company.name)}</a>` : "—")}
              ${row("Contact", d.contact ? `<a href="../contacts/detail.html?id=${d.contact.id}" class="text-action hover:underline">${escapeHtml(d.contact.firstName)} ${escapeHtml(d.contact.lastName)}</a>` : "—")}
              ${row("Expected close", formatDate(d.expectedCloseDate))}
              ${d.closedAt ? row("Closed", formatDate(d.closedAt)) : ""}
              ${row("Created", formatDate(d.createdAt))}
            </div>
          </div>
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
          ${uiCard("Follow-ups", followUpsPanel())}
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
  document.getElementById("won-btn")?.addEventListener("click", () => setStatus("WON"));
  document.getElementById("lost-btn")?.addEventListener("click", () => setStatus("LOST"));
  document.getElementById("reopen-btn")?.addEventListener("click", () => setStatus("OPEN"));
  document.getElementById("add-task-form").addEventListener("submit", addTask);
  document.getElementById("add-activity-btn").addEventListener("click", openActivityModal);
  document.getElementById("add-followup-form").addEventListener("submit", addFollowUp);
  mainEl.querySelectorAll(".complete-task").forEach((b) => b.addEventListener("click", () => completeTask(b.dataset.taskId)));
  mainEl.querySelectorAll(".stage-btn").forEach((b) => b.addEventListener("click", async () => {
    if (b.dataset.stage === deal.stage?.id) return;
    try { await api.put(`/api/deals/${deal.id}/stage`, { stageId: b.dataset.stage }); }
    catch (e) { alert(e.message); }
    loadDeal();
  }));
}

function followUpsPanel() {
  const sorted = [...followUps].sort((a, b) => new Date(a.startAt) - new Date(b.startAt));
  const list = sorted.length === 0
    ? uiEmpty("No follow-ups scheduled", "Schedule a call, meeting, or follow-up for this deal.")
    : `<ul class="space-y-2 text-sm">${sorted.map((ev) => `
        <li class="rounded-md border border-border px-3 py-2">
          <p class="font-medium text-navy">${escapeHtml(ev.title)}</p>
          <p class="text-xs text-muted">${formatEnum(ev.eventType || "MEETING")} · ${formatDateTime(ev.startAt)}</p>
        </li>`).join("")}</ul>`;

  return `${list}
    <form id="add-followup-form" class="mt-3 space-y-2 border-t border-border pt-3">
      <input id="fu-title" placeholder="Follow-up title…" class="${UI_INPUT_CLASS}" />
      <div class="grid grid-cols-2 gap-2">
        <select id="fu-type" class="${UI_INPUT_CLASS}">${uiOptions(FOLLOW_UP_TYPES, "FOLLOW_UP")}</select>
        <input id="fu-startAt" type="datetime-local" class="${UI_INPUT_CLASS}" />
      </div>
      <button type="submit" class="rounded-md bg-action px-3 py-1.5 text-sm font-medium text-white hover:bg-action/90">Schedule follow-up</button>
    </form>`;
}

async function addFollowUp(e) {
  e.preventDefault();
  const title = document.getElementById("fu-title").value.trim();
  const startAt = document.getElementById("fu-startAt").value;
  if (!title || !startAt) return;
  await api.post("/api/calendar", {
    title,
    startAt: new Date(startAt).toISOString(),
    eventType: document.getElementById("fu-type").value,
    relatedDealId: deal.id,
  });
  loadDeal();
}

async function setStatus(status) {
  await api.put(`/api/deals/${deal.id}`, { status });
  loadDeal();
}

async function handleDelete() {
  if (!confirm(`Delete deal "${deal.title}"? This cannot be undone.`)) return;
  await api.del(`/api/deals/${deal.id}`);
  window.location.href = "index.html";
}

async function addTask(e) {
  e.preventDefault();
  const title = document.getElementById("task-title").value.trim();
  if (!title) return;
  await api.post("/api/tasks", {
    title, dealId: deal.id,
    assigneeId: document.getElementById("task-assignee").value || undefined,
    priority: document.getElementById("task-priority").value,
    dueDate: document.getElementById("task-due").value || undefined,
  });
  loadDeal();
}

async function completeTask(id) {
  await api.put(`/api/tasks/${id}`, { status: "COMPLETED" });
  loadDeal();
}

// Opens the shared activity modal, pre-linked to this deal.
function openActivityModal() {
  buildActivityModal({
    activity: null,
    lockedRelation: {
      kind: "deal", kindLabel: "Deal",
      id: deal.id, label: deal.title,
    },
    rootId: "modal-root",
    fetchOptions: true,
    onSaved: () => loadDeal(),
  });
}

function openEditModal() {
  const d = deal;
  const pipelineId = d.pipeline?.id || "";
  const stages = (pipelines.find((p) => p.id === pipelineId) || pipelines[0])?.stages || [];
  const body = `
    ${uiField("Deal title", `<input required id="ef-title" value="${escapeHtml(d.title)}" class="${UI_INPUT_CLASS}" />`)}
    <div class="grid grid-cols-2 gap-3">
      ${uiField("Amount (₹)", `<input required type="number" min="0" step="0.01" id="ef-amount" value="${d.amount ?? ""}" class="${UI_INPUT_CLASS}" />`)}
      ${uiField("Probability (%)", `<input type="number" min="0" max="100" id="ef-probability" value="${d.probability ?? ""}" class="${UI_INPUT_CLASS}" />`)}
    </div>
    <div class="grid grid-cols-2 gap-3">
      ${uiField("Pipeline", `<select id="ef-pipelineId" class="${UI_INPUT_CLASS}">${
        pipelines.map((p) => `<option value="${p.id}" ${p.id === pipelineId ? "selected" : ""}>${escapeHtml(p.name)}</option>`).join("")}</select>`)}
      ${uiField("Stage", `<select id="ef-stageId" class="${UI_INPUT_CLASS}">${
        stages.map((s) => `<option value="${s.id}" ${s.id === d.stage?.id ? "selected" : ""}>${escapeHtml(s.name)}</option>`).join("")}</select>`)}
    </div>
    <div class="grid grid-cols-2 gap-3">
      ${uiField("Company", `<select id="ef-companyId" class="${UI_INPUT_CLASS}"><option value="">No company</option>${
        companies.map((c) => `<option value="${c.id}" ${c.id === d.company?.id ? "selected" : ""}>${escapeHtml(c.name)}</option>`).join("")}</select>`)}
      ${uiField("Contact", `<select id="ef-contactId" class="${UI_INPUT_CLASS}"><option value="">No contact</option>${
        contacts.map((c) => `<option value="${c.id}" ${c.id === d.contact?.id ? "selected" : ""}>${escapeHtml(c.firstName)} ${escapeHtml(c.lastName)}</option>`).join("")}</select>`)}
    </div>
    <div class="grid grid-cols-3 gap-3">
      ${uiField("Owner", `<select id="ef-ownerId" class="${UI_INPUT_CLASS}"><option value="">Unassigned</option>${
        owners.map((o) => `<option value="${o.id}" ${o.id === d.owner?.id ? "selected" : ""}>${escapeHtml(o.name)}</option>`).join("")}</select>`)}
      ${uiField("Status", `<select id="ef-status" class="${UI_INPUT_CLASS}">${uiOptions(DEAL_STATUSES, d.status)}</select>`)}
      ${uiField("Expected close", `<input type="date" id="ef-expectedCloseDate" value="${d.expectedCloseDate ? d.expectedCloseDate.slice(0, 10) : ""}" class="${UI_INPUT_CLASS}" />`)}
    </div>`;

  const modal = uiModal("modal-root", "Edit deal", body, "Save changes");
  document.getElementById("ef-pipelineId").addEventListener("change", (e) => {
    const p = pipelines.find((x) => x.id === e.target.value);
    document.getElementById("ef-stageId").innerHTML =
      (p?.stages || []).map((s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join("");
  });

  uiSubmit(modal, "Save changes", async () => {
    const v = (id) => document.getElementById(id).value;
    await api.put(`/api/deals/${d.id}`, {
      title: v("ef-title"), amount: Number(v("ef-amount")),
      probability: v("ef-probability") ? Number(v("ef-probability")) : undefined,
      pipelineId: v("ef-pipelineId"), stageId: v("ef-stageId"),
      companyId: v("ef-companyId") || undefined, contactId: v("ef-contactId") || undefined,
      ownerId: v("ef-ownerId") || undefined, status: v("ef-status"),
      expectedCloseDate: v("ef-expectedCloseDate") || undefined,
    });
    loadDeal();
  });
}

mainEl = renderAppShell("deals");
loadDeal();
