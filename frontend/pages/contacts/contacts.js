// Ported from src/app/(app)/contacts/page.tsx + ContactFormModal.tsx
const state = {
  data: null, loading: true, error: false,
  owners: [], companies: [],
  search: "", status: "", source: "", ownerId: "", companyId: "", tag: "",
  sortBy: "createdAt", sortDir: "desc", page: 1,
  selected: new Set(),
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
    state.data = await api.get(`/api/contacts?${qs({
      page: state.page, pageSize: 20, sortBy: state.sortBy, sortDir: state.sortDir,
      search: state.search, status: state.status, source: state.source,
      ownerId: state.ownerId, companyId: state.companyId, tag: state.tag,
    })}`);
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
  try { state.companies = (await api.get("/api/companies?pageSize=100&sortBy=name&sortDir=asc")).items; } catch {}
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

function renderFilters() {
  return `
    <div class="rounded-card border border-border bg-surface p-4">
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <div class="lg:col-span-2">
          <input id="f-search" type="search" placeholder="Search name, email, phone, title, tag, company…"
            value="${escapeHtml(state.search)}" class="${UI_INPUT_CLASS}" />
        </div>
        <select id="f-status" class="${UI_INPUT_CLASS}"><option value="">All statuses</option>${uiOptions(CONTACT_STATUSES, state.status)}</select>
        <select id="f-source" class="${UI_INPUT_CLASS}"><option value="">All sources</option>${uiOptions(LEAD_SOURCES, state.source)}</select>
        <select id="f-owner" class="${UI_INPUT_CLASS}"><option value="">All owners</option>${
          state.owners.map((o) => `<option value="${o.id}" ${o.id === state.ownerId ? "selected" : ""}>${escapeHtml(o.name)}</option>`).join("")}</select>
        <select id="f-company" class="${UI_INPUT_CLASS}"><option value="">All companies</option>${
          state.companies.map((c) => `<option value="${c.id}" ${c.id === state.companyId ? "selected" : ""}>${escapeHtml(c.name)}</option>`).join("")}</select>
      </div>
      <div class="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted">
        <span>Sort by</span>
        ${sortPill("createdAt", "Created")}${sortPill("name", "Name")}${sortPill("company", "Company")}${sortPill("lastContactedAt", "Last contacted")}
        ${state.selected.size > 0 ? `
          <div class="ml-auto flex items-center gap-2">
            <span>${state.selected.size} selected</span>
            <select id="bulk-owner" class="rounded-md border border-border bg-white px-2 py-1.5 text-sm text-navy">
              <option value="">Assign owner…</option>${state.owners.map((o) => `<option value="${o.id}">${escapeHtml(o.name)}</option>`).join("")}
            </select>
            <select id="bulk-status" class="rounded-md border border-border bg-white px-2 py-1.5 text-sm text-navy">
              <option value="">Set status…</option>${uiOptions(CONTACT_STATUSES, "")}
            </select>
            <button id="bulk-delete" class="rounded-md bg-danger px-3 py-1.5 text-sm text-white hover:bg-danger/90">Delete</button>
          </div>` : ""}
      </div>
    </div>`;
}

function renderTable() {
  if (state.loading) return uiLoading("Loading contacts…");
  if (state.error) return uiError();
  if (!state.data || state.data.items.length === 0) {
    return uiEmpty("No contacts found", "Try adjusting your filters, or create a new contact to get started.",
      `<button id="empty-new" class="mt-3 rounded-md bg-action px-3 py-1.5 text-sm font-medium text-white hover:bg-action/90">New contact</button>`);
  }

  const headers = ["", "Name", "Company", "Job title", "Email", "Phone", "Status", "Source", "Owner", "Last contacted"];
  const rows = state.data.items.map((row) => `
    <tr class="border-b border-border last:border-0 hover:bg-page/60">
      <td class="px-4 py-3 w-8"><input type="checkbox" class="row-check h-4 w-4 rounded border-border" data-id="${row.id}" ${state.selected.has(row.id) ? "checked" : ""} /></td>
      <td class="px-4 py-3">
        <a href="detail.html?id=${row.id}" class="block hover:underline">
          <p class="font-medium text-navy">${escapeHtml(row.firstName)} ${escapeHtml(row.lastName)}</p>
          ${row.tags.length ? `<p class="text-xs text-muted">${row.tags.map(escapeHtml).join(", ")}</p>` : ""}
        </a>
      </td>
      <td class="px-4 py-3 text-navy">${escapeHtml(row.company?.name || "—")}</td>
      <td class="px-4 py-3 text-navy">${escapeHtml(row.jobTitle || "—")}</td>
      <td class="px-4 py-3 text-navy">${escapeHtml(row.email || "—")}</td>
      <td class="px-4 py-3 text-navy">${escapeHtml(row.phone || "—")}</td>
      <td class="px-4 py-3">${badgeHtml(formatEnum(row.status), contactStatusTone(row.status))}</td>
      <td class="px-4 py-3 text-navy">${formatEnum(row.source)}</td>
      <td class="px-4 py-3 text-navy">${escapeHtml(row.owner?.name || "Unassigned")}</td>
      <td class="px-4 py-3 text-navy">${formatDate(row.lastContactedAt)}</td>
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
        <h1 class="text-lg font-semibold text-navy">Contacts</h1>
        <button id="new-btn" class="rounded-md bg-action px-4 py-2 text-sm font-medium text-white hover:bg-action/90">New contact</button>
      </div>
      ${renderFilters()}
      <div class="rounded-card border border-border bg-surface">${renderTable()}</div>
    </div>
    <div id="modal-root"></div>`;
  attachEvents();
}

function attachEvents() {
  document.getElementById("new-btn")?.addEventListener("click", () => openContactModal(null));
  document.getElementById("empty-new")?.addEventListener("click", () => openContactModal(null));
  document.getElementById("retry-btn")?.addEventListener("click", load);
  document.getElementById("prev-page")?.addEventListener("click", () => { state.page -= 1; load(); });
  document.getElementById("next-page")?.addEventListener("click", () => { state.page += 1; load(); });

  document.getElementById("f-search")?.addEventListener("input", uiDebounce((e) => { state.search = e.target.value; state.page = 1; load(); }, 350));
  ["status", "source", "owner", "company"].forEach((key) => {
    const map = { status: "status", source: "source", owner: "ownerId", company: "companyId" };
    document.getElementById(`f-${key}`)?.addEventListener("change", (e) => {
      state[map[key]] = e.target.value; state.page = 1; load();
    });
  });

  mainEl.querySelectorAll(".sort-btn").forEach((b) => b.addEventListener("click", () => toggleSort(b.dataset.sort)));
  mainEl.querySelectorAll(".row-check").forEach((cb) => cb.addEventListener("click", (e) => {
    e.stopPropagation();
    if (state.selected.has(cb.dataset.id)) state.selected.delete(cb.dataset.id);
    else state.selected.add(cb.dataset.id);
    render();
  }));

  document.getElementById("bulk-delete")?.addEventListener("click", async () => {
    if (!confirm(`Delete ${state.selected.size} contact(s)? This cannot be undone.`)) return;
    await api.post("/api/contacts/bulk", { ids: [...state.selected], action: "delete" });
    load();
  });
  document.getElementById("bulk-owner")?.addEventListener("change", async (e) => {
    if (!e.target.value) return;
    await api.post("/api/contacts/bulk", { ids: [...state.selected], action: "assignOwner", ownerId: e.target.value });
    load();
  });
  document.getElementById("bulk-status")?.addEventListener("change", async (e) => {
    if (!e.target.value) return;
    await api.post("/api/contacts/bulk", { ids: [...state.selected], action: "setStatus", status: e.target.value });
    load();
  });
}

// --- Create / edit modal (ported from ContactFormModal.tsx) ---
function openContactModal(contact) {
  const f = contact || {};
  const body = `
    <div class="grid grid-cols-2 gap-3">
      ${uiField("First name", `<input required id="cf-firstName" value="${escapeHtml(f.firstName || "")}" class="${UI_INPUT_CLASS}" />`)}
      ${uiField("Last name", `<input required id="cf-lastName" value="${escapeHtml(f.lastName || "")}" class="${UI_INPUT_CLASS}" />`)}
    </div>
    <div class="grid grid-cols-2 gap-3">
      ${uiField("Job title", `<input id="cf-jobTitle" value="${escapeHtml(f.jobTitle || "")}" class="${UI_INPUT_CLASS}" />`)}
      ${uiField("Company", `<select id="cf-companyId" class="${UI_INPUT_CLASS}"><option value="">No company</option>${
        state.companies.map((c) => `<option value="${c.id}" ${c.id === f.company?.id ? "selected" : ""}>${escapeHtml(c.name)}</option>`).join("")}</select>`)}
    </div>
    <div class="grid grid-cols-3 gap-3">
      ${uiField("Email", `<input type="email" id="cf-email" value="${escapeHtml(f.email || "")}" class="${UI_INPUT_CLASS}" />`)}
      ${uiField("Phone", `<input id="cf-phone" value="${escapeHtml(f.phone || "")}" class="${UI_INPUT_CLASS}" />`)}
      ${uiField("Mobile", `<input id="cf-mobilePhone" value="${escapeHtml(f.mobilePhone || "")}" class="${UI_INPUT_CLASS}" />`)}
    </div>
    <div class="grid grid-cols-3 gap-3">
      ${uiField("Status", `<select id="cf-status" class="${UI_INPUT_CLASS}">${uiOptions(CONTACT_STATUSES, f.status || "ACTIVE")}</select>`)}
      ${uiField("Source", `<select id="cf-source" class="${UI_INPUT_CLASS}">${uiOptions(LEAD_SOURCES, f.source || "OTHER")}</select>`)}
      ${uiField("Owner", `<select id="cf-ownerId" class="${UI_INPUT_CLASS}"><option value="">Unassigned</option>${
        state.owners.map((o) => `<option value="${o.id}" ${o.id === f.owner?.id ? "selected" : ""}>${escapeHtml(o.name)}</option>`).join("")}</select>`)}
    </div>
    ${uiField("Tags (comma separated)", `<input id="cf-tags" value="${escapeHtml((f.tags || []).join(", "))}" class="${UI_INPUT_CLASS}" />`)}
    ${uiField("Address", `<input id="cf-address" value="${escapeHtml(f.address || "")}" class="${UI_INPUT_CLASS}" />`)}
    <div class="grid grid-cols-4 gap-3">
      ${uiField("City", `<input id="cf-city" value="${escapeHtml(f.city || "")}" class="${UI_INPUT_CLASS}" />`)}
      ${uiField("State", `<input id="cf-state" value="${escapeHtml(f.state || "")}" class="${UI_INPUT_CLASS}" />`)}
      ${uiField("Country", `<input id="cf-country" value="${escapeHtml(f.country || "")}" class="${UI_INPUT_CLASS}" />`)}
      ${uiField("Postal code", `<input id="cf-postalCode" value="${escapeHtml(f.postalCode || "")}" class="${UI_INPUT_CLASS}" />`)}
    </div>
    <div class="grid grid-cols-2 gap-3">
      ${uiField("Website", `<input id="cf-website" placeholder="https://…" value="${escapeHtml(f.website || "")}" class="${UI_INPUT_CLASS}" />`)}
      ${uiField("LinkedIn", `<input id="cf-linkedinUrl" placeholder="https://…" value="${escapeHtml(f.linkedinUrl || "")}" class="${UI_INPUT_CLASS}" />`)}
    </div>
    ${uiField("Last contacted", `<input type="date" id="cf-lastContactedAt" value="${f.lastContactedAt ? f.lastContactedAt.slice(0, 10) : ""}" class="${UI_INPUT_CLASS}" />`)}
    ${uiField("Notes", `<textarea id="cf-notes" rows="3" class="${UI_INPUT_CLASS}">${escapeHtml(f.notes || "")}</textarea>`)}
    <p id="dup-warning" class="hidden rounded-md border border-warning/30 bg-warning/5 px-3 py-2 text-sm text-warning"></p>`;

  const label = contact ? "Save changes" : "Create contact";
  const modal = uiModal("modal-root", contact ? "Edit contact" : "New contact", body, label);

  // Duplicate check on email/phone blur, matching the source's create flow.
  const checkDup = async () => {
    if (contact) return;
    const email = document.getElementById("cf-email").value.trim();
    const phone = document.getElementById("cf-phone").value.trim();
    if (!email && !phone) return;
    try {
      const match = await api.get(`/api/contacts/duplicate-check?${qs({ email, phone })}`);
      const warn = document.getElementById("dup-warning");
      if (match) {
        warn.textContent = `Possible duplicate: ${match.firstName} ${match.lastName} already exists with this email or phone.`;
        warn.classList.remove("hidden");
      } else {
        warn.classList.add("hidden");
      }
    } catch {}
  };
  document.getElementById("cf-email").addEventListener("blur", checkDup);
  document.getElementById("cf-phone").addEventListener("blur", checkDup);

  uiSubmit(modal, label, async () => {
    const v = (id) => document.getElementById(id).value;
    const payload = {
      firstName: v("cf-firstName"), lastName: v("cf-lastName"), jobTitle: v("cf-jobTitle"),
      email: v("cf-email"), phone: v("cf-phone"), mobilePhone: v("cf-mobilePhone"),
      companyId: v("cf-companyId") || undefined, ownerId: v("cf-ownerId") || undefined,
      status: v("cf-status"), source: v("cf-source"),
      tags: v("cf-tags") ? v("cf-tags").split(",").map((t) => t.trim()).filter(Boolean) : [],
      address: v("cf-address"), city: v("cf-city"), state: v("cf-state"),
      country: v("cf-country"), postalCode: v("cf-postalCode"),
      website: v("cf-website"), linkedinUrl: v("cf-linkedinUrl"),
      lastContactedAt: v("cf-lastContactedAt") || undefined, notes: v("cf-notes"),
    };
    if (contact) await api.put(`/api/contacts/${contact.id}`, payload);
    else await api.post("/api/contacts", payload);
    load();
  });
}

mainEl = renderAppShell("contacts");
render();
loadFilters().then(render);
load();
