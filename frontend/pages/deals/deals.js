// Ported from src/app/(app)/deals/page.tsx + DealsBoard.tsx + DealCard.tsx + DealFormModal.tsx
const state = {
  view: "board",             // "board" | "list" — the source defaults to the kanban board
  data: null, boardDeals: null, loading: true, error: false,
  pipelines: [], pipeline: null, owners: [], companies: [], contacts: [],
  search: "", ownerId: "", companyId: "", status: "", stageId: "",
  sortBy: "createdAt", sortDir: "desc", page: 1,
  dragOverStageId: null,
};

let mainEl;

function qs(params) {
  const usp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v !== "" && v != null) usp.set(k, v); });
  return usp.toString();
}

async function loadRefs() {
  try {
    state.pipelines = await api.get("/api/pipelines");
    state.pipeline = state.pipelines[0] || null;
  } catch {}
  try { state.owners = await api.get("/api/users"); } catch {}
  try { state.companies = (await api.get("/api/companies?pageSize=100&sortBy=name&sortDir=asc")).items; } catch {}
  try { state.contacts = (await api.get("/api/contacts?pageSize=100&sortBy=name&sortDir=asc")).items; } catch {}
}

async function load() {
  state.loading = true; state.error = false;
  render();
  try {
    if (state.view === "board") {
      state.boardDeals = await api.get(`/api/deals/board?${qs({
        pipelineId: state.pipeline?.id, ownerId: state.ownerId,
        companyId: state.companyId, search: state.search,
      })}`);
    } else {
      state.data = await api.get(`/api/deals?${qs({
        page: state.page, pageSize: 20, sortBy: state.sortBy, sortDir: state.sortDir,
        search: state.search, ownerId: state.ownerId, companyId: state.companyId,
        status: state.status, stageId: state.stageId, pipelineId: state.pipeline?.id,
      })}`);
    }
  } catch {
    state.error = true;
  } finally {
    state.loading = false;
    render();
  }
}

// ---------- Kanban board ----------
function renderBoard() {
  if (!state.pipeline) {
    return uiEmpty("No pipeline configured", "Create a pipeline with stages before managing deals.");
  }
  const byStage = new Map(state.pipeline.stages.map((s) => [s.id, []]));
  (state.boardDeals || []).forEach((d) => {
    const list = byStage.get(d.stage?.id);
    if (list) list.push(d);
  });

  return `<div class="flex gap-4 overflow-x-auto pb-2">
    ${state.pipeline.stages.map((stage) => {
      const deals = byStage.get(stage.id) || [];
      const total = deals.reduce((sum, d) => sum + Number(d.amount || 0), 0);
      return `
        <div data-stage-id="${stage.id}" class="stage-col flex w-72 shrink-0 flex-col rounded-card border bg-page/40 ${
          state.dragOverStageId === stage.id ? "border-action bg-action/5" : "border-border"}">
          <div class="flex items-center justify-between border-b border-border px-3 py-2.5">
            <div>
              <p class="text-sm font-semibold text-navy">${escapeHtml(stage.name)}</p>
              <p class="text-xs text-muted">${deals.length} deal${deals.length === 1 ? "" : "s"} · ${formatCurrency(total)}</p>
            </div>
            <button data-add-stage="${stage.id}" aria-label="Add deal to ${escapeHtml(stage.name)}"
              class="add-to-stage rounded-md border border-border px-2 py-1 text-xs font-medium text-navy hover:bg-white">+ Add</button>
          </div>
          <div class="flex-1 space-y-2 p-2">
            ${deals.length === 0
              ? `<p class="px-2 py-6 text-center text-xs text-muted">No deals in this stage</p>`
              : deals.map((d) => dealCard(d)).join("")}
          </div>
        </div>`;
    }).join("")}
  </div>`;
}

function dealCard(deal) {
  return `<div draggable="true" data-deal-id="${deal.id}" data-from-stage="${deal.stage?.id || ""}"
      class="deal-card cursor-grab space-y-2 rounded-md border border-border bg-white p-3 shadow-sm active:cursor-grabbing">
    <a href="detail.html?id=${deal.id}" class="block text-sm font-medium text-navy hover:underline">${escapeHtml(deal.title)}</a>
    <div class="flex items-center justify-between text-xs text-muted">
      <span class="font-semibold text-navy">${formatCurrency(deal.amount)}</span>
      ${deal.status !== "OPEN" ? badgeHtml(formatEnum(deal.status), dealStatusTone(deal.status)) : ""}
    </div>
    ${deal.company ? `<p class="truncate text-xs text-muted">${escapeHtml(deal.company.name)}</p>` : ""}
    <div class="flex items-center justify-between text-xs text-muted">
      <span>${escapeHtml(deal.owner?.name || "Unassigned")}</span>
      ${deal.probability !== null && deal.probability !== undefined ? `<span>${deal.probability}%</span>` : ""}
    </div>
    ${deal.expectedCloseDate ? `<p class="text-xs text-muted">Closes ${formatDate(deal.expectedCloseDate)}</p>` : ""}
  </div>`;
}

// ---------- List view ----------
function renderList() {
  if (!state.data || state.data.items.length === 0) {
    return uiEmpty("No deals found", "Try adjusting your filters, or create a new deal to get started.",
      `<button id="empty-new" class="mt-3 rounded-md bg-action px-3 py-1.5 text-sm font-medium text-white hover:bg-action/90">New deal</button>`);
  }
  const headers = ["Deal", "Company", "Contact", "Stage", "Amount", "Probability", "Status", "Owner", "Expected close"];
  const rows = state.data.items.map((d) => `
    <tr class="border-b border-border last:border-0 hover:bg-page/60">
      <td class="px-4 py-3"><a href="detail.html?id=${d.id}" class="font-medium text-navy hover:underline">${escapeHtml(d.title)}</a></td>
      <td class="px-4 py-3 text-navy">${escapeHtml(d.company?.name || "—")}</td>
      <td class="px-4 py-3 text-navy">${d.contact ? `${escapeHtml(d.contact.firstName)} ${escapeHtml(d.contact.lastName)}` : "—"}</td>
      <td class="px-4 py-3 text-navy">${escapeHtml(d.stage?.name || "—")}</td>
      <td class="px-4 py-3 text-navy">${formatCurrency(d.amount)}</td>
      <td class="px-4 py-3 text-navy">${d.probability != null ? d.probability + "%" : "—"}</td>
      <td class="px-4 py-3">${badgeHtml(formatEnum(d.status), dealStatusTone(d.status))}</td>
      <td class="px-4 py-3 text-navy">${escapeHtml(d.owner?.name || "Unassigned")}</td>
      <td class="px-4 py-3 text-navy">${formatDate(d.expectedCloseDate)}</td>
    </tr>`).join("");

  return `<div class="overflow-x-auto">
      <table class="w-full border-collapse text-sm">
        <thead><tr class="border-b border-border text-left text-xs font-semibold uppercase tracking-wide text-muted">
          ${headers.map((h) => `<th class="px-4 py-3">${h}</th>`).join("")}
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    ${uiPagination(state.data.page, state.data.total, state.data.pageSize)}`;
}

function render() {
  const body = state.loading ? uiLoading("Loading deals…")
    : state.error ? uiError()
    : state.view === "board" ? renderBoard() : renderList();

  mainEl.innerHTML = `
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <h1 class="text-lg font-semibold text-navy">Deals</h1>
        <div class="flex items-center gap-2">
          <div class="flex rounded-md border border-border bg-white p-0.5">
            <button id="view-board" class="rounded px-3 py-1.5 text-sm ${state.view === "board" ? "bg-action text-white" : "text-navy"}">Board</button>
            <button id="view-list" class="rounded px-3 py-1.5 text-sm ${state.view === "list" ? "bg-action text-white" : "text-navy"}">List</button>
          </div>
          <button id="new-btn" class="rounded-md bg-action px-4 py-2 text-sm font-medium text-white hover:bg-action/90">New deal</button>
        </div>
      </div>

      <div class="rounded-card border border-border bg-surface p-4">
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div class="lg:col-span-2">
            <input id="f-search" type="search" placeholder="Search deal, company, contact…" value="${escapeHtml(state.search)}" class="${UI_INPUT_CLASS}" />
          </div>
          <select id="f-pipeline" class="${UI_INPUT_CLASS}">${
            state.pipelines.map((p) => `<option value="${p.id}" ${p.id === state.pipeline?.id ? "selected" : ""}>${escapeHtml(p.name)}</option>`).join("")}</select>
          <select id="f-owner" class="${UI_INPUT_CLASS}"><option value="">All owners</option>${
            state.owners.map((o) => `<option value="${o.id}" ${o.id === state.ownerId ? "selected" : ""}>${escapeHtml(o.name)}</option>`).join("")}</select>
          <select id="f-company" class="${UI_INPUT_CLASS}"><option value="">All companies</option>${
            state.companies.map((c) => `<option value="${c.id}" ${c.id === state.companyId ? "selected" : ""}>${escapeHtml(c.name)}</option>`).join("")}</select>
        </div>
        ${state.view === "list" ? `
          <div class="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <select id="f-status" class="${UI_INPUT_CLASS}"><option value="">All statuses</option>${uiOptions(DEAL_STATUSES, state.status)}</select>
            <select id="f-stage" class="${UI_INPUT_CLASS}"><option value="">All stages</option>${
              (state.pipeline?.stages || []).map((s) => `<option value="${s.id}" ${s.id === state.stageId ? "selected" : ""}>${escapeHtml(s.name)}</option>`).join("")}</select>
            <select id="f-sort" class="${UI_INPUT_CLASS}">
              ${[["createdAt", "Created"], ["amount", "Amount"], ["probability", "Probability"], ["expectedCloseDate", "Close date"], ["title", "Title"], ["updatedAt", "Updated"]]
                .map(([v, l]) => `<option value="${v}" ${v === state.sortBy ? "selected" : ""}>Sort by ${l}</option>`).join("")}
            </select>
          </div>` : ""}
      </div>

      ${state.view === "board" ? body : `<div class="rounded-card border border-border bg-surface">${body}</div>`}
    </div>
    <div id="modal-root"></div>`;

  attachEvents();
}

function attachEvents() {
  document.getElementById("view-board").addEventListener("click", () => { state.view = "board"; load(); });
  document.getElementById("view-list").addEventListener("click", () => { state.view = "list"; state.page = 1; load(); });
  document.getElementById("new-btn").addEventListener("click", () => openDealModal(null, state.pipeline?.stages?.[0]?.id));
  document.getElementById("empty-new")?.addEventListener("click", () => openDealModal(null, state.pipeline?.stages?.[0]?.id));
  document.getElementById("retry-btn")?.addEventListener("click", load);
  document.getElementById("prev-page")?.addEventListener("click", () => { state.page -= 1; load(); });
  document.getElementById("next-page")?.addEventListener("click", () => { state.page += 1; load(); });

  document.getElementById("f-search").addEventListener("input", uiDebounce((e) => { state.search = e.target.value; state.page = 1; load(); }, 350));
  document.getElementById("f-pipeline")?.addEventListener("change", (e) => {
    state.pipeline = state.pipelines.find((p) => p.id === e.target.value) || null;
    state.stageId = ""; state.page = 1; load();
  });
  document.getElementById("f-owner").addEventListener("change", (e) => { state.ownerId = e.target.value; state.page = 1; load(); });
  document.getElementById("f-company").addEventListener("change", (e) => { state.companyId = e.target.value; state.page = 1; load(); });
  document.getElementById("f-status")?.addEventListener("change", (e) => { state.status = e.target.value; state.page = 1; load(); });
  document.getElementById("f-stage")?.addEventListener("change", (e) => { state.stageId = e.target.value; state.page = 1; load(); });
  document.getElementById("f-sort")?.addEventListener("change", (e) => { state.sortBy = e.target.value; load(); });

  // --- Drag and drop between stage columns ---
  mainEl.querySelectorAll(".deal-card").forEach((card) => {
    card.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/deal-id", card.dataset.dealId);
      e.dataTransfer.setData("text/from-stage-id", card.dataset.fromStage);
      e.dataTransfer.effectAllowed = "move";
    });
  });

  mainEl.querySelectorAll(".stage-col").forEach((col) => {
    col.addEventListener("dragover", (e) => {
      e.preventDefault();
      if (state.dragOverStageId !== col.dataset.stageId) {
        state.dragOverStageId = col.dataset.stageId;
        col.classList.add("border-action", "bg-action/5");
      }
    });
    col.addEventListener("dragleave", () => {
      col.classList.remove("border-action", "bg-action/5");
      if (state.dragOverStageId === col.dataset.stageId) state.dragOverStageId = null;
    });
    col.addEventListener("drop", async (e) => {
      e.preventDefault();
      state.dragOverStageId = null;
      const dealId = e.dataTransfer.getData("text/deal-id");
      const fromStage = e.dataTransfer.getData("text/from-stage-id");
      const toStage = col.dataset.stageId;
      if (!dealId || fromStage === toStage) { load(); return; }
      try {
        await api.put(`/api/deals/${dealId}/stage`, { stageId: toStage });
      } catch (err) {
        alert(err.message || "Couldn't move that deal.");
      }
      load();
    });
  });

  mainEl.querySelectorAll(".add-to-stage").forEach((btn) =>
    btn.addEventListener("click", () => openDealModal(null, btn.dataset.addStage)));
}

// --- Create / edit modal (ported from DealFormModal.tsx) ---
function openDealModal(deal, presetStageId) {
  const f = deal || {};
  const pipelineId = f.pipeline?.id || state.pipeline?.id || "";
  const stages = (state.pipelines.find((p) => p.id === pipelineId) || state.pipeline)?.stages || [];
  const currentStage = f.stage?.id || presetStageId || stages[0]?.id;

  const body = `
    ${uiField("Deal title", `<input required id="df-title" value="${escapeHtml(f.title || "")}" class="${UI_INPUT_CLASS}" />`)}
    <div class="grid grid-cols-2 gap-3">
      ${uiField("Amount (₹)", `<input required type="number" min="0" step="0.01" id="df-amount" value="${f.amount ?? ""}" class="${UI_INPUT_CLASS}" />`)}
      ${uiField("Probability (%)", `<input type="number" min="0" max="100" id="df-probability" value="${f.probability ?? ""}" class="${UI_INPUT_CLASS}" />`)}
    </div>
    <div class="grid grid-cols-2 gap-3">
      ${uiField("Pipeline", `<select id="df-pipelineId" class="${UI_INPUT_CLASS}">${
        state.pipelines.map((p) => `<option value="${p.id}" ${p.id === pipelineId ? "selected" : ""}>${escapeHtml(p.name)}</option>`).join("")}</select>`)}
      ${uiField("Stage", `<select id="df-stageId" class="${UI_INPUT_CLASS}">${
        stages.map((s) => `<option value="${s.id}" ${s.id === currentStage ? "selected" : ""}>${escapeHtml(s.name)}</option>`).join("")}</select>`)}
    </div>
    <div class="grid grid-cols-2 gap-3">
      ${uiField("Company", `<select id="df-companyId" class="${UI_INPUT_CLASS}"><option value="">No company</option>${
        state.companies.map((c) => `<option value="${c.id}" ${c.id === f.company?.id ? "selected" : ""}>${escapeHtml(c.name)}</option>`).join("")}</select>`)}
      ${uiField("Contact", `<select id="df-contactId" class="${UI_INPUT_CLASS}"><option value="">No contact</option>${
        state.contacts.map((c) => `<option value="${c.id}" ${c.id === f.contact?.id ? "selected" : ""}>${escapeHtml(c.firstName)} ${escapeHtml(c.lastName)}</option>`).join("")}</select>`)}
    </div>
    <div class="grid grid-cols-3 gap-3">
      ${uiField("Owner", `<select id="df-ownerId" class="${UI_INPUT_CLASS}"><option value="">Unassigned</option>${
        state.owners.map((o) => `<option value="${o.id}" ${o.id === f.owner?.id ? "selected" : ""}>${escapeHtml(o.name)}</option>`).join("")}</select>`)}
      ${uiField("Status", `<select id="df-status" class="${UI_INPUT_CLASS}">${uiOptions(DEAL_STATUSES, f.status || "OPEN")}</select>`)}
      ${uiField("Expected close", `<input type="date" id="df-expectedCloseDate" value="${f.expectedCloseDate ? f.expectedCloseDate.slice(0, 10) : ""}" class="${UI_INPUT_CLASS}" />`)}
    </div>`;

  const label = deal ? "Save changes" : "Create deal";
  const modal = uiModal("modal-root", deal ? "Edit deal" : "New deal", body, label);

  // Changing pipeline repopulates its stages.
  document.getElementById("df-pipelineId").addEventListener("change", (e) => {
    const p = state.pipelines.find((x) => x.id === e.target.value);
    const sel = document.getElementById("df-stageId");
    sel.innerHTML = (p?.stages || []).map((s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join("");
  });

  uiSubmit(modal, label, async () => {
    const v = (id) => document.getElementById(id).value;
    const payload = {
      title: v("df-title"), amount: Number(v("df-amount")),
      probability: v("df-probability") ? Number(v("df-probability")) : undefined,
      pipelineId: v("df-pipelineId"), stageId: v("df-stageId"),
      companyId: v("df-companyId") || undefined, contactId: v("df-contactId") || undefined,
      ownerId: v("df-ownerId") || undefined, status: v("df-status"),
      expectedCloseDate: v("df-expectedCloseDate") || undefined,
    };
    if (deal) await api.put(`/api/deals/${deal.id}`, payload);
    else await api.post("/api/deals", payload);
    load();
  });
}

mainEl = renderAppShell("deals");
render();
loadRefs().then(() => { render(); load(); });
