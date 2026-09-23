// Ported from src/app/(app)/leads/page.tsx + LeadFormModal.tsx
const state = {
  data: null, loading: true, error: false,
  owners: [], companies: [],
  search: "", status: "", source: "", priority: "", ownerId: "",
  sortBy: "createdAt", sortDir: "desc", page: 1,
  selected: new Set(),
};

let mainEl;

function qs(params) {
  const usp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v !== "" && v !== undefined && v !== null) usp.set(k, v); });
  return usp.toString();
}

async function load() {
  state.loading = true; state.error = false;
  render();
  try {
    const params = qs({
      page: state.page, pageSize: 20, sortBy: state.sortBy, sortDir: state.sortDir,
      search: state.search, status: state.status, source: state.source,
      priority: state.priority, ownerId: state.ownerId,
    });
    state.data = await api.get(`/api/leads?${params}`);
    state.selected = new Set();
  } catch {
    state.error = true;
  } finally {
    state.loading = false;
    render();
  }
}

async function loadFilters() {
  try { state.owners = await api.get("/api/users"); } catch {}
  try {
    const companies = await api.get("/api/companies?pageSize=100&sortBy=name&sortDir=asc");
    state.companies = companies.items;
  } catch {}
}

function toggleSort(field) {
  if (state.sortBy === field) state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
  else { state.sortBy = field; state.sortDir = "asc"; }
  load();
}

function toggleSelected(id) {
  if (state.selected.has(id)) state.selected.delete(id); else state.selected.add(id);
  render();
}

async function bulkDelete() {
  if (state.selected.size === 0) return;
  if (!confirm(`Delete ${state.selected.size} lead(s)? This cannot be undone.`)) return;
  await api.post("/api/leads/bulk", { ids: Array.from(state.selected), action: "delete" });
  load();
}

async function bulkAssign(ownerId) {
  if (state.selected.size === 0 || !ownerId) return;
  await api.post("/api/leads/bulk", { ids: Array.from(state.selected), action: "assignOwner", ownerId });
  load();
}

function sortPill(field, label) {
  const active = state.sortBy === field;
  return `<button data-sort="${field}" class="sort-btn rounded-full border px-2.5 py-1 text-xs ${active ? "border-action text-action bg-action/10" : "border-border text-muted"}">
    ${label} ${active ? (state.sortDir === "asc" ? "↑" : "↓") : ""}
  </button>`;
}

function optionList(values, current) {
  return values.map((v) => `<option value="${v}" ${v === current ? "selected" : ""}>${formatEnum(v)}</option>`).join("");
}

function renderFilters() {
  return `
    <div class="rounded-card border border-border bg-surface p-4">
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <div class="lg:col-span-2">
          <input id="f-search" type="search" placeholder="Search name, company, email, phone, tag…" value="${escapeHtml(state.search)}"
            class="w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-navy placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-action/40 focus:border-action" />
        </div>
        <select id="f-status" class="w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-action/40 focus:border-action">
          <option value="">All statuses</option>${optionList(LEAD_STATUSES, state.status)}
        </select>
        <select id="f-source" class="w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-action/40 focus:border-action">
          <option value="">All sources</option>${optionList(LEAD_SOURCES, state.source)}
        </select>
        <select id="f-priority" class="w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-action/40 focus:border-action">
          <option value="">All priorities</option>${optionList(LEAD_PRIORITIES, state.priority)}
        </select>
        <select id="f-owner" class="w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-action/40 focus:border-action">
          <option value="">All owners</option>${state.owners.map((o) => `<option value="${o.id}" ${o.id === state.ownerId ? "selected" : ""}>${escapeHtml(o.name)}</option>`).join("")}
        </select>
      </div>
      <div class="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted">
        <span>Sort by</span>
        ${sortPill("createdAt", "Created")}${sortPill("firstName", "Name")}${sortPill("estimatedValue", "Value")}${sortPill("expectedCloseDate", "Close date")}
        ${state.selected.size > 0 ? `
          <div class="ml-auto flex items-center gap-2">
            <span>${state.selected.size} selected</span>
            <select id="bulk-assign" class="rounded-md border border-border bg-white px-2 py-1.5 text-sm text-navy">
              <option value="">Assign owner…</option>${state.owners.map((o) => `<option value="${o.id}">${escapeHtml(o.name)}</option>`).join("")}
            </select>
            <button id="bulk-delete" class="rounded-md bg-danger px-3 py-1.5 text-sm text-white hover:bg-danger/90">Delete</button>
          </div>` : ""}
      </div>
    </div>`;
}

function renderTable() {
  if (state.loading) {
    return `<div class="flex items-center justify-center gap-2 py-16 text-sm text-muted">
      <span class="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-action"></span>Loading leads…</div>`;
  }
  if (state.error) {
    return `<div class="flex flex-col items-center justify-center gap-2 rounded-card border border-danger/20 bg-danger/5 px-6 py-16 text-center">
      <p class="text-sm font-semibold text-danger">Something went wrong</p>
      <p class="max-w-sm text-sm text-muted">The data couldn't be loaded. Try again.</p>
      <button id="retry-btn" class="mt-3 rounded-md border border-border bg-white px-3 py-1.5 text-sm font-medium text-navy hover:bg-page">Retry</button>
    </div>`;
  }
  if (!state.data || state.data.items.length === 0) {
    return `<div class="flex flex-col items-center justify-center gap-2 rounded-card border border-dashed border-border bg-page/50 px-6 py-16 text-center">
      <p class="text-sm font-semibold text-navy">No leads found</p>
      <p class="max-w-sm text-sm text-muted">Try adjusting your filters, or create a new lead to get started.</p>
      <button id="empty-new-lead" class="mt-3 rounded-md bg-action px-3 py-1.5 text-sm font-medium text-white hover:bg-action/90">New lead</button>
    </div>`;
  }

  const headers = ["", "Name", "Company", "Email", "Source", "Status", "Priority", "Est. value", "Owner", "Created"];
  const rows = state.data.items.map((row) => `
    <tr class="border-b border-border last:border-0 hover:bg-page/60" data-id="${row.id}">
      <td class="px-4 py-3 text-navy w-8">
        <input type="checkbox" class="row-check h-4 w-4 rounded border-border" data-id="${row.id}" ${state.selected.has(row.id) ? "checked" : ""} />
      </td>
      <td class="px-4 py-3 text-navy">
        <a href="detail.html?id=${row.id}" class="block hover:underline">
          <p class="font-medium text-navy">${escapeHtml(row.firstName)} ${escapeHtml(row.lastName)}</p>
          <p class="text-xs text-muted">${escapeHtml(row.jobTitle || "—")}</p>
        </a>
      </td>
      <td class="px-4 py-3 text-navy">${escapeHtml(row.company?.name || row.companyName || "—")}</td>
      <td class="px-4 py-3 text-navy">${escapeHtml(row.email || "—")}</td>
      <td class="px-4 py-3 text-navy">${formatEnum(row.source)}</td>
      <td class="px-4 py-3 text-navy">${badgeHtml(formatEnum(row.status), leadStatusTone(row.status))}</td>
      <td class="px-4 py-3 text-navy">${badgeHtml(formatEnum(row.priority), leadPriorityTone(row.priority))}</td>
      <td class="px-4 py-3 text-navy">${formatCurrency(row.estimatedValue)}</td>
      <td class="px-4 py-3 text-navy">${escapeHtml(row.owner?.name || "Unassigned")}</td>
      <td class="px-4 py-3 text-navy">${formatDate(row.createdAt)}</td>
    </tr>`).join("");

  const totalPages = Math.max(1, Math.ceil(state.data.total / state.data.pageSize));

  return `
    <div class="overflow-x-auto">
      <table class="w-full border-collapse text-sm">
        <thead><tr class="border-b border-border text-left text-xs font-semibold uppercase tracking-wide text-muted">
          ${headers.map((h) => `<th class="px-4 py-3">${h}</th>`).join("")}
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div class="flex items-center justify-between px-4 py-3 text-sm text-muted">
      <span>Page ${state.data.page} of ${totalPages} &middot; ${state.data.total} total</span>
      <div class="flex gap-2">
        <button id="prev-page" ${state.data.page <= 1 ? "disabled" : ""} class="rounded-md border border-border bg-white px-3 py-1.5 text-sm text-navy hover:bg-page disabled:opacity-50">Previous</button>
        <button id="next-page" ${state.data.page >= totalPages ? "disabled" : ""} class="rounded-md border border-border bg-white px-3 py-1.5 text-sm text-navy hover:bg-page disabled:opacity-50">Next</button>
      </div>
    </div>`;
}

function render() {
  mainEl.innerHTML = `
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <h1 class="text-lg font-semibold text-navy">Leads</h1>
        <button id="new-lead-btn" class="rounded-md bg-action px-4 py-2 text-sm font-medium text-white hover:bg-action/90">New lead</button>
      </div>
      ${renderFilters()}
      <div class="rounded-card border border-border bg-surface">${renderTable()}</div>
    </div>
    <div id="lead-modal-root"></div>`;

  attachListEvents();
}

function attachListEvents() {
  document.getElementById("new-lead-btn")?.addEventListener("click", () => openLeadModal(null));
  document.getElementById("empty-new-lead")?.addEventListener("click", () => openLeadModal(null));
  document.getElementById("retry-btn")?.addEventListener("click", load);
  document.getElementById("bulk-delete")?.addEventListener("click", bulkDelete);
  document.getElementById("bulk-assign")?.addEventListener("change", (e) => bulkAssign(e.target.value));
  document.getElementById("prev-page")?.addEventListener("click", () => { state.page -= 1; load(); });
  document.getElementById("next-page")?.addEventListener("click", () => { state.page += 1; load(); });

  document.getElementById("f-search")?.addEventListener("input", debounce((e) => { state.search = e.target.value; state.page = 1; load(); }, 350));
  document.getElementById("f-status")?.addEventListener("change", (e) => { state.status = e.target.value; state.page = 1; load(); });
  document.getElementById("f-source")?.addEventListener("change", (e) => { state.source = e.target.value; state.page = 1; load(); });
  document.getElementById("f-priority")?.addEventListener("change", (e) => { state.priority = e.target.value; state.page = 1; load(); });
  document.getElementById("f-owner")?.addEventListener("change", (e) => { state.ownerId = e.target.value; state.page = 1; load(); });

  mainEl.querySelectorAll(".sort-btn").forEach((btn) => btn.addEventListener("click", () => toggleSort(btn.dataset.sort)));
  mainEl.querySelectorAll(".row-check").forEach((cb) => cb.addEventListener("click", (e) => { e.stopPropagation(); toggleSelected(cb.dataset.id); }));
}

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

// --- New / Edit lead modal (ported from LeadFormModal.tsx) ---
function openLeadModal(lead) {
  const form = lead ? {
    firstName: lead.firstName, lastName: lead.lastName, email: lead.email || "", phone: lead.phone || "",
    companyName: lead.companyName || "", companyId: lead.company?.id || "", jobTitle: lead.jobTitle || "",
    source: lead.source, status: lead.status, priority: lead.priority, ownerId: lead.owner?.id || "",
    estimatedValue: lead.estimatedValue != null ? String(lead.estimatedValue) : "",
    expectedCloseDate: lead.expectedCloseDate ? lead.expectedCloseDate.slice(0, 10) : "",
    notes: lead.notes || "", tags: (lead.tags || []).join(", "),
  } : {
    firstName: "", lastName: "", email: "", phone: "", companyName: "", companyId: "", jobTitle: "",
    source: "OTHER", status: "NEW", priority: "MEDIUM", ownerId: "", estimatedValue: "",
    expectedCloseDate: "", notes: "", tags: "",
  };

  const root = document.getElementById("lead-modal-root");
  root.innerHTML = `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 px-4">
      <div role="dialog" aria-modal="true" class="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-card border border-border bg-white shadow-lg">
        <div class="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 class="text-sm font-semibold text-navy">${lead ? "Edit lead" : "New lead"}</h2>
          <button id="lead-modal-close" class="text-muted hover:text-navy">✕</button>
        </div>
        <form id="lead-form" class="space-y-4 p-5">
          <p id="lead-form-error" class="hidden rounded-md border border-danger/20 bg-danger/5 px-3 py-2 text-sm text-danger"></p>
          <div class="grid grid-cols-2 gap-3">
            ${field("firstName", "First name", `<input required id="lf-firstName" value="${escapeHtml(form.firstName)}" class="lf-input" />`)}
            ${field("lastName", "Last name", `<input required id="lf-lastName" value="${escapeHtml(form.lastName)}" class="lf-input" />`)}
          </div>
          <div class="grid grid-cols-2 gap-3">
            ${field("email", "Email", `<input type="email" id="lf-email" value="${escapeHtml(form.email)}" class="lf-input" />`)}
            ${field("phone", "Phone", `<input id="lf-phone" value="${escapeHtml(form.phone)}" class="lf-input" />`)}
          </div>
          <div class="grid grid-cols-2 gap-3">
            ${field("companyName", "Company name", `<input id="lf-companyName" value="${escapeHtml(form.companyName)}" class="lf-input" />`)}
            ${field("jobTitle", "Job title", `<input id="lf-jobTitle" value="${escapeHtml(form.jobTitle)}" class="lf-input" />`)}
          </div>
          ${field("companyId", "Linked company", `<select id="lf-companyId" class="lf-input">
            <option value="">No linked company</option>
            ${state.companies.map((c) => `<option value="${c.id}" ${c.id === form.companyId ? "selected" : ""}>${escapeHtml(c.name)}</option>`).join("")}
          </select>`)}
          <div class="grid grid-cols-3 gap-3">
            ${field("source", "Source", `<select id="lf-source" class="lf-input">${optionList(LEAD_SOURCES, form.source)}</select>`)}
            ${field("status", "Status", `<select id="lf-status" class="lf-input">${optionList(LEAD_STATUSES, form.status)}</select>`)}
            ${field("priority", "Priority", `<select id="lf-priority" class="lf-input">${optionList(LEAD_PRIORITIES, form.priority)}</select>`)}
          </div>
          <div class="grid grid-cols-2 gap-3">
            ${field("ownerId", "Owner", `<select id="lf-ownerId" class="lf-input">
              <option value="">Unassigned</option>
              ${state.owners.map((o) => `<option value="${o.id}" ${o.id === form.ownerId ? "selected" : ""}>${escapeHtml(o.name)}</option>`).join("")}
            </select>`)}
            ${field("estimatedValue", "Estimated value (₹)", `<input type="number" min="0" id="lf-estimatedValue" value="${escapeHtml(form.estimatedValue)}" class="lf-input" />`)}
          </div>
          <div class="grid grid-cols-2 gap-3">
            ${field("expectedCloseDate", "Expected close date", `<input type="date" id="lf-expectedCloseDate" value="${form.expectedCloseDate}" class="lf-input" />`)}
            ${field("tags", "Tags (comma separated)", `<input id="lf-tags" value="${escapeHtml(form.tags)}" class="lf-input" />`)}
          </div>
          ${field("notes", "Notes", `<textarea id="lf-notes" rows="3" class="lf-input">${escapeHtml(form.notes)}</textarea>`)}
          <div class="flex justify-end gap-2 pt-2">
            <button type="button" id="lead-form-cancel" class="rounded-md border border-border bg-white px-4 py-2 text-sm text-navy hover:bg-page">Cancel</button>
            <button type="submit" id="lead-form-submit" class="rounded-md bg-action px-4 py-2 text-sm font-medium text-white hover:bg-action/90">${lead ? "Save changes" : "Create lead"}</button>
          </div>
        </form>
      </div>
    </div>
    <style>.lf-input { width: 100%; border-radius: 0.375rem; border: 1px solid #E4E9F2; background: white; padding: 0.5rem 0.75rem; font-size: 0.875rem; color: #0B1E3D; }
    .lf-input:focus { outline: none; box-shadow: 0 0 0 2px rgba(47,92,255,0.4); border-color: #2F5CFF; }</style>`;

  document.getElementById("lead-modal-close").addEventListener("click", closeLeadModal);
  document.getElementById("lead-form-cancel").addEventListener("click", closeLeadModal);
  document.getElementById("lead-form").addEventListener("submit", (e) => submitLeadForm(e, lead));
}

function field(name, label, inputHtml) {
  return `<label class="block space-y-1"><span class="text-xs font-medium text-muted">${label}</span>${inputHtml}</label>`;
}

function closeLeadModal() {
  document.getElementById("lead-modal-root").innerHTML = "";
}

async function submitLeadForm(e, lead) {
  e.preventDefault();
  const submitBtn = document.getElementById("lead-form-submit");
  const errorEl = document.getElementById("lead-form-error");
  errorEl.classList.add("hidden");
  submitBtn.disabled = true;
  submitBtn.textContent = "Saving…";

  const val = (id) => document.getElementById(id).value;
  const tags = val("lf-tags") ? val("lf-tags").split(",").map((t) => t.trim()).filter(Boolean) : [];
  const payload = {
    firstName: val("lf-firstName"), lastName: val("lf-lastName"),
    email: val("lf-email"), phone: val("lf-phone"), companyName: val("lf-companyName"),
    companyId: val("lf-companyId") || undefined, jobTitle: val("lf-jobTitle"),
    source: val("lf-source"), status: val("lf-status"), priority: val("lf-priority"),
    ownerId: val("lf-ownerId") || undefined,
    estimatedValue: val("lf-estimatedValue") ? Number(val("lf-estimatedValue")) : undefined,
    expectedCloseDate: val("lf-expectedCloseDate") || undefined,
    notes: val("lf-notes"), tags,
  };

  try {
    if (lead) await api.put(`/api/leads/${lead.id}`, payload);
    else await api.post("/api/leads", payload);
    closeLeadModal();
    load();
  } catch (err) {
    errorEl.textContent = err.message || "Something went wrong. Please try again.";
    errorEl.classList.remove("hidden");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = lead ? "Save changes" : "Create lead";
  }
}

// --- init ---
mainEl = renderAppShell("leads");
render();
loadFilters().then(render);
load();
