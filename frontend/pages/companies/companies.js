// Ported from src/app/(app)/companies/page.tsx + CompanyFormModal.tsx
const state = {
  data: null, loading: true, error: false, owners: [],
  search: "", ownerId: "", industry: "",
  sortBy: "createdAt", sortDir: "desc", page: 1,
};

let mainEl;

function qs(params) {
  const usp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v !== "" && v != null) usp.set(k, v); });
  return usp.toString();
}

async function load() {
  state.loading = true; state.error = false;
  render();
  try {
    state.data = await api.get(`/api/companies?${qs({
      page: state.page, pageSize: 20, sortBy: state.sortBy, sortDir: state.sortDir,
      search: state.search, ownerId: state.ownerId, industry: state.industry,
    })}`);
  } catch {
    state.error = true;
  } finally {
    state.loading = false;
    render();
  }
}

async function loadFilters() {
  try { state.owners = await api.get("/api/users"); } catch {}
}

function toggleSort(field) {
  if (state.sortBy === field) state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
  else { state.sortBy = field; state.sortDir = "asc"; }
  load();
}

function sortPill(field, label) {
  const active = state.sortBy === field;
  return `<button data-sort="${field}" class="sort-btn rounded-full border px-2.5 py-1 text-xs ${
    active ? "border-action text-action bg-action/10" : "border-border text-muted"}">
    ${label} ${active ? (state.sortDir === "asc" ? "↑" : "↓") : ""}</button>`;
}

function renderTable() {
  if (state.loading) return uiLoading("Loading companies…");
  if (state.error) return uiError();
  if (!state.data || state.data.items.length === 0) {
    return uiEmpty("No companies found", "Try adjusting your filters, or create a new company to get started.",
      `<button id="empty-new" class="mt-3 rounded-md bg-action px-3 py-1.5 text-sm font-medium text-white hover:bg-action/90">New company</button>`);
  }

  const headers = ["Name", "Industry", "Website", "Phone", "Contacts", "Deals", "Owner", "Created", ""];
  const rows = state.data.items.map((row) => `
    <tr class="border-b border-border last:border-0 hover:bg-page/60">
      <td class="px-4 py-3">
        <a href="detail.html?id=${row.id}" class="font-medium text-navy hover:underline">${escapeHtml(row.name)}</a>
      </td>
      <td class="px-4 py-3 text-navy">${escapeHtml(row.industry || "—")}</td>
      <td class="px-4 py-3">${row.website
        ? `<a href="${escapeHtml(row.website)}" target="_blank" rel="noopener" class="text-action hover:underline">${escapeHtml(row.website)}</a>`
        : `<span class="text-navy">—</span>`}</td>
      <td class="px-4 py-3 text-navy">${escapeHtml(row.phone || "—")}</td>
      <td class="px-4 py-3 text-navy tabular-nums">${row.counts.contacts}</td>
      <td class="px-4 py-3 text-navy tabular-nums">${row.counts.deals}</td>
      <td class="px-4 py-3 text-navy">${escapeHtml(row.owner?.name || "Unassigned")}</td>
      <td class="px-4 py-3 text-navy">${formatDate(row.createdAt)}</td>
      <td class="px-4 py-3">
        <div class="flex justify-end gap-2">
          <button data-edit-id="${row.id}" class="row-edit rounded-md border border-border px-2.5 py-1 text-xs font-medium text-navy hover:bg-page">Edit</button>
          <button data-delete-id="${row.id}" class="row-delete rounded-md border border-danger/20 px-2.5 py-1 text-xs font-medium text-danger hover:bg-danger/5">Delete</button>
        </div>
      </td>
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
  mainEl.innerHTML = `
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <h1 class="text-lg font-semibold text-navy">Companies</h1>
        <button id="new-btn" class="rounded-md bg-action px-4 py-2 text-sm font-medium text-white hover:bg-action/90">New company</button>
      </div>

      <div class="rounded-card border border-border bg-surface p-4">
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div class="lg:col-span-2">
            <input id="f-search" type="search" placeholder="Search name, industry, website, phone…"
              value="${escapeHtml(state.search)}" class="${UI_INPUT_CLASS}" />
          </div>
          <input id="f-industry" placeholder="Filter by industry" value="${escapeHtml(state.industry)}" class="${UI_INPUT_CLASS}" />
          <select id="f-owner" class="${UI_INPUT_CLASS}"><option value="">All owners</option>${
            state.owners.map((o) => `<option value="${o.id}" ${o.id === state.ownerId ? "selected" : ""}>${escapeHtml(o.name)}</option>`).join("")}</select>
        </div>
        <div class="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted">
          <span>Sort by</span>
          ${sortPill("createdAt", "Created")}${sortPill("name", "Name")}${sortPill("industry", "Industry")}
        </div>
      </div>

      <div class="rounded-card border border-border bg-surface">${renderTable()}</div>
    </div>
    <div id="modal-root"></div>`;
  attachEvents();
}

function attachEvents() {
  document.getElementById("new-btn")?.addEventListener("click", () => openCompanyModal(null));
  document.getElementById("empty-new")?.addEventListener("click", () => openCompanyModal(null));
  document.getElementById("retry-btn")?.addEventListener("click", load);
  document.getElementById("prev-page")?.addEventListener("click", () => { state.page -= 1; load(); });
  document.getElementById("next-page")?.addEventListener("click", () => { state.page += 1; load(); });
  document.getElementById("f-search")?.addEventListener("input", uiDebounce((e) => { state.search = e.target.value; state.page = 1; load(); }, 350));
  document.getElementById("f-industry")?.addEventListener("input", uiDebounce((e) => { state.industry = e.target.value; state.page = 1; load(); }, 350));
  document.getElementById("f-owner")?.addEventListener("change", (e) => { state.ownerId = e.target.value; state.page = 1; load(); });
  mainEl.querySelectorAll(".sort-btn").forEach((b) => b.addEventListener("click", () => toggleSort(b.dataset.sort)));

  mainEl.querySelectorAll(".row-edit").forEach((b) => b.addEventListener("click", () => {
    const company = state.data.items.find((x) => x.id === b.dataset.editId);
    if (company) openCompanyModal(company);
  }));

  mainEl.querySelectorAll(".row-delete").forEach((b) => b.addEventListener("click", async () => {
    const company = state.data.items.find((x) => x.id === b.dataset.deleteId);
    if (!company) return;
    if (!confirm(`Delete company "${company.name}"? This cannot be undone.`)) return;
    try {
      await api.del(`/api/companies/${company.id}`);
    } catch (e) {
      alert(e.message || "Couldn't delete that company.");
    }
    load();
  }));
}

// --- Create / edit modal (ported from CompanyFormModal.tsx) ---
function openCompanyModal(company) {
  const f = company || {};
  const body = `
    ${uiField("Company name", `<input required id="mf-name" value="${escapeHtml(f.name || "")}" class="${UI_INPUT_CLASS}" />`)}
    ${uiField("Industry", `<input id="mf-industry" value="${escapeHtml(f.industry || "")}" class="${UI_INPUT_CLASS}" />`)}
    <div class="grid grid-cols-2 gap-3">
      ${uiField("Website", `<input id="mf-website" placeholder="https://…" value="${escapeHtml(f.website || "")}" class="${UI_INPUT_CLASS}" />`)}
      ${uiField("Phone", `<input id="mf-phone" value="${escapeHtml(f.phone || "")}" class="${UI_INPUT_CLASS}" />`)}
    </div>
    ${uiField("Owner", `<select id="mf-ownerId" class="${UI_INPUT_CLASS}"><option value="">Unassigned</option>${
      state.owners.map((o) => `<option value="${o.id}" ${o.id === f.owner?.id ? "selected" : ""}>${escapeHtml(o.name)}</option>`).join("")}</select>`)}
    <p id="dup-warning" class="hidden rounded-md border border-warning/30 bg-warning/5 px-3 py-2 text-sm text-warning"></p>`;

  const label = company ? "Save changes" : "Create company";
  const modal = uiModal("modal-root", company ? "Edit company" : "New company", body, label);

  // Duplicate name check, matching the source's create flow.
  document.getElementById("mf-name").addEventListener("blur", async () => {
    if (company) return;
    const name = document.getElementById("mf-name").value.trim();
    if (!name) return;
    try {
      const match = await api.get(`/api/companies/duplicate-check?name=${encodeURIComponent(name)}`);
      const warn = document.getElementById("dup-warning");
      if (match) {
        warn.textContent = `A company named "${match.name}" already exists in your organization.`;
        warn.classList.remove("hidden");
      } else {
        warn.classList.add("hidden");
      }
    } catch {}
  });

  uiSubmit(modal, label, async () => {
    const v = (id) => document.getElementById(id).value;
    const payload = {
      name: v("mf-name"), industry: v("mf-industry"),
      website: v("mf-website"), phone: v("mf-phone"),
      ownerId: v("mf-ownerId") || undefined,
    };
    if (company) await api.put(`/api/companies/${company.id}`, payload);
    else await api.post("/api/companies", payload);
    load();
  });
}

mainEl = renderAppShell("companies");
render();
loadFilters().then(render);
load();
