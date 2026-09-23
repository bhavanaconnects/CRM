// Ported from src/components/layout/{AppShell,Sidebar,Header,MobileNav}.tsx
const NAV_ITEMS = [
  { href: "dashboard", key: "dashboard", label: "Dashboard" },
  { href: "leads", key: "leads", label: "Leads" },
  { href: "contacts", key: "contacts", label: "Contacts" },
  { href: "companies", key: "companies", label: "Companies" },
  { href: "deals", key: "deals", label: "Deals" },
  { href: "tasks", key: "tasks", label: "Tasks" },
  { href: "activities", key: "activities", label: "Activities" },
  { href: "work", key: "work", label: "Work" },
  { href: "calendar", key: "calendar", label: "Calendar" },
  { href: "my-work", key: "my-work", label: "My Work" },
];

// All pages live at /pages/<module>/index.html, so links are relative to the
// current page's folder.
function pageHref(key, file = "index.html") {
  return `../${key}/${file}`;
}

let __navState = { notifications: [], unreadCount: 0 };

function renderAppShell(activeKey) {
  const root = document.getElementById("app-root");
  root.insertAdjacentHTML("afterbegin", `
    <div class="flex min-h-screen bg-page">
      <aside id="app-sidebar" class="hidden shrink-0 flex-col border-r border-border bg-navy text-white md:flex w-60 transition-all duration-200">
        <div class="flex h-14 items-center gap-2 px-4">
          <span class="flex h-7 w-7 items-center justify-center rounded-md bg-action text-sm font-bold">C</span>
          <span class="sidebar-label text-sm font-semibold tracking-tight">CRM</span>
        </div>
        <nav class="flex-1 space-y-0.5 px-2 py-2">
          ${NAV_ITEMS.map((item) => `
            <a href="${pageHref(item.href)}" class="flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
              item.key === activeKey ? "bg-white/10 text-white font-medium" : "text-white/70 hover:bg-white/5 hover:text-white"
            }">
              <span class="h-1.5 w-1.5 shrink-0 rounded-full ${item.key === activeKey ? "bg-action" : "bg-white/30"}"></span>
              <span class="sidebar-label">${item.label}</span>
            </a>`).join("")}
        </nav>
        <div class="border-t border-white/10 px-2 py-2">
          <button id="sidebar-toggle" class="mt-1 w-full rounded-md px-3 py-2 text-left text-xs text-white/50 hover:bg-white/5 hover:text-white">Collapse</button>
        </div>
      </aside>

      <div class="flex min-w-0 flex-1 flex-col">
        <header class="relative flex h-14 items-center gap-4 border-b border-border bg-white px-4">
          <button id="mobile-nav-btn" class="rounded-md border border-border px-2 py-1.5 text-sm text-navy md:hidden" aria-label="Open navigation">☰</button>

          <div class="relative max-w-sm flex-1">
            <input id="global-search" type="search" placeholder="Search leads, contacts, deals…" aria-label="Search"
              class="w-full rounded-md border border-border bg-page px-3 py-2 text-sm text-navy placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-action/40 focus:border-action" />
            <div id="search-dropdown" class="hidden absolute left-0 right-0 top-full z-30 mt-2 rounded-md border border-border bg-white p-2 shadow-lg"></div>
          </div>

          <div class="ml-auto flex items-center gap-3">
            <span id="app-org-name" class="hidden text-sm text-muted sm:inline"></span>

            <div class="relative">
              <button id="notif-btn" class="relative rounded-md px-2 py-1.5 text-sm hover:bg-page" aria-label="Notifications">
                🔔<span id="notif-badge" class="hidden absolute -right-1 -top-1 rounded-full bg-danger px-1.5 text-[10px] font-semibold text-white"></span>
              </button>
              <div id="notif-dropdown" class="hidden absolute right-0 z-20 mt-2 w-80 rounded-md border border-border bg-white p-2 shadow-lg"></div>
            </div>

            <div class="relative">
              <button id="app-user-menu-btn" class="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-page" aria-haspopup="menu">
                <span id="app-user-initials" class="flex h-7 w-7 items-center justify-center rounded-full bg-navy text-xs font-semibold text-white">…</span>
                <span id="app-user-name" class="hidden text-navy sm:inline">Loading…</span>
              </button>
              <div id="app-user-menu" role="menu" class="hidden absolute right-0 z-10 mt-2 w-48 rounded-md border border-border bg-white py-1 shadow-lg">
                <div id="app-user-email" class="border-b border-border px-3 py-2 text-xs text-muted"></div>
                <button id="app-logout-btn" role="menuitem" class="block w-full px-3 py-2 text-left text-sm text-navy hover:bg-page">Log out</button>
              </div>
            </div>
          </div>
        </header>

        <div id="mobile-nav" class="hidden border-b border-border bg-navy px-2 py-2 md:hidden">
          ${NAV_ITEMS.map((item) => `
            <a href="${pageHref(item.href)}" class="block rounded-md px-3 py-2 text-sm ${
              item.key === activeKey ? "bg-white/10 text-white font-medium" : "text-white/70 hover:bg-white/5"
            }">${item.label}</a>`).join("")}
        </div>

        <main id="app-main" class="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-8"></main>
      </div>
    </div>
  `);

  // --- Current user ---
  api.get("/api/auth/me").then((user) => {
    document.getElementById("app-user-name").textContent = user.name;
    document.getElementById("app-user-name").classList.remove("hidden");
    document.getElementById("app-user-initials").textContent = initials(user.name);
    document.getElementById("app-user-email").textContent = user.email;
    document.getElementById("app-org-name").textContent = user.organizationName || "";
  }).catch(() => {
    window.location.href = pageHref("login");
  });

  // --- Notifications ---
  loadNotifications();

  // --- Menus ---
  document.getElementById("app-user-menu-btn").addEventListener("click", () => {
    document.getElementById("app-user-menu").classList.toggle("hidden");
  });
  document.getElementById("app-logout-btn").addEventListener("click", async () => {
    await api.post("/api/auth/logout");
    window.location.href = pageHref("login");
  });
  document.getElementById("notif-btn").addEventListener("click", () => {
    document.getElementById("notif-dropdown").classList.toggle("hidden");
    renderNotifications();
  });
  document.getElementById("mobile-nav-btn").addEventListener("click", () => {
    document.getElementById("mobile-nav").classList.toggle("hidden");
  });
  document.getElementById("sidebar-toggle").addEventListener("click", () => {
    const aside = document.getElementById("app-sidebar");
    const collapsed = aside.classList.toggle("w-16");
    aside.classList.toggle("w-60", !collapsed);
    document.querySelectorAll(".sidebar-label").forEach((el) => el.classList.toggle("hidden", collapsed));
  });

  // --- Global search (Ctrl/Cmd+K, 300ms debounce — same as the source) ---
  const searchInput = document.getElementById("global-search");
  window.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      searchInput.focus();
    }
  });
  searchInput.addEventListener("focus", () => showSearchDropdown());
  searchInput.addEventListener("blur", () => setTimeout(() => {
    document.getElementById("search-dropdown").classList.add("hidden");
  }, 150));
  searchInput.addEventListener("input", debounceShared(runGlobalSearch, 300));

  return document.getElementById("app-main");
}

function debounceShared(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

function showSearchDropdown(html) {
  const el = document.getElementById("search-dropdown");
  el.classList.remove("hidden");
  if (html !== undefined) el.innerHTML = html;
  else if (!el.innerHTML) {
    el.innerHTML = `<div class="px-2 py-2 text-sm text-muted">Type to search leads, contacts, companies, deals, tasks, and activities.</div>`;
  }
}

async function runGlobalSearch() {
  const q = document.getElementById("global-search").value.trim();
  if (!q) {
    showSearchDropdown(`<div class="px-2 py-2 text-sm text-muted">Type to search leads, contacts, companies, deals, tasks, and activities.</div>`);
    return;
  }
  showSearchDropdown(`<div class="px-2 py-2 text-sm text-muted">Searching…</div>`);
  try {
    const results = await api.get(`/api/search?q=${encodeURIComponent(q)}`);
    const groups = Object.entries(results).filter(([, items]) => items.length > 0);
    if (groups.length === 0) {
      showSearchDropdown(`<div class="px-2 py-2 text-sm text-muted">No results found.</div>`);
      return;
    }
    showSearchDropdown(`<div class="space-y-3">${groups.map(([group, items]) => `
      <div>
        <p class="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted">${group.toUpperCase()}</p>
        <div class="space-y-1">
          ${items.map((item) => `
            <a href="${searchHref(group, item)}" class="block rounded-md px-2 py-1.5 text-sm hover:bg-page">
              <div class="font-medium text-navy">${escapeHtml(searchLabel(group, item))}</div>
              <div class="text-xs text-muted">${escapeHtml(searchMeta(group, item))}</div>
            </a>`).join("")}
        </div>
      </div>`).join("")}</div>`);
  } catch {
    showSearchDropdown(`<div class="px-2 py-2 text-sm text-muted">No results found.</div>`);
  }
}

function searchHref(group, item) {
  switch (group) {
    case "leads": return `../leads/detail.html?id=${item.id}`;
    case "contacts": return `../contacts/detail.html?id=${item.id}`;
    case "companies": return `../companies/detail.html?id=${item.id}`;
    case "deals": return `../deals/detail.html?id=${item.id}`;
    case "tasks": return `../tasks/detail.html?id=${item.id}`;
    case "activities": return `../activities/detail.html?id=${item.id}`;
    default: return `../dashboard/index.html`;
  }
}

function searchLabel(group, item) {
  switch (group) {
    case "leads":
    case "contacts": return `${item.firstName ?? ""} ${item.lastName ?? ""}`.trim();
    case "companies": return item.name;
    case "deals":
    case "tasks": return item.title;
    case "activities": return item.subject || item.notes;
    default: return "Result";
  }
}

function searchMeta(group, item) {
  switch (group) {
    case "leads": return item.companyName ?? item.status ?? "Lead";
    case "contacts": return item.company?.name ?? item.jobTitle ?? "Contact";
    case "companies": return item.industry ?? "Company";
    case "deals": return item.company?.name ?? (item.amount ? formatCurrency(item.amount) : "Deal");
    case "tasks": return item.status ? taskStatusLabel(item.status) : "Task";
    case "activities": return item.type ?? "Activity";
    default: return "";
  }
}

async function loadNotifications() {
  try {
    const data = await api.get("/api/notifications");
    __navState.notifications = data.items ?? [];
    __navState.unreadCount = data.unreadCount ?? 0;
    const badge = document.getElementById("notif-badge");
    if (__navState.unreadCount > 0) {
      badge.textContent = __navState.unreadCount;
      badge.classList.remove("hidden");
    } else {
      badge.classList.add("hidden");
    }
  } catch {
    // Notifications are non-critical chrome; never block the page.
  }
}

function renderNotifications() {
  const el = document.getElementById("notif-dropdown");
  if (__navState.notifications.length === 0) {
    el.innerHTML = `<div class="px-2 py-3 text-sm text-muted">No notifications yet.</div>`;
    return;
  }
  el.innerHTML = `
    <div class="mb-2 flex items-center justify-between border-b border-border pb-2">
      <span class="text-sm font-semibold text-navy">Notifications</span>
      <button id="notif-mark-all" class="text-xs text-action">Mark all read</button>
    </div>
    <div class="max-h-72 space-y-2 overflow-y-auto">
      ${__navState.notifications.map((n) => `
        <button type="button" data-notif-id="${n.id}" class="notif-item block w-full rounded-md border px-2 py-2 text-left text-sm ${
          n.read ? "border-border bg-page" : "border-action/40 bg-action/5"
        }">
          <div class="font-medium text-navy">${escapeHtml(n.title)}</div>
          <div class="text-xs text-muted">${escapeHtml(n.message)}</div>
        </button>`).join("")}
    </div>`;

  document.getElementById("notif-mark-all").addEventListener("click", async () => {
    await api.patch("/api/notifications/read-all");
    __navState.notifications = __navState.notifications.map((n) => ({ ...n, read: true }));
    __navState.unreadCount = 0;
    document.getElementById("notif-badge").classList.add("hidden");
    renderNotifications();
  });

  el.querySelectorAll(".notif-item").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.notifId;
      const item = __navState.notifications.find((n) => n.id === id);
      if (!item || item.read) return;
      await api.patch(`/api/notifications/${id}/read`);
      item.read = true;
      __navState.unreadCount = Math.max(__navState.unreadCount - 1, 0);
      const badge = document.getElementById("notif-badge");
      if (__navState.unreadCount > 0) badge.textContent = __navState.unreadCount;
      else badge.classList.add("hidden");
      renderNotifications();
    });
  });
}
