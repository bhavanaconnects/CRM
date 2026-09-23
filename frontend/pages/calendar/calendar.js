// Ported from src/app/(app)/calendar/page.tsx + src/lib/calendar.ts
// (dateKey / startOfWeek / addDays / getCalendarDays are ported verbatim.)

function dateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function startOfWeek(date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return start;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  next.setDate(next.getDate() + days);
  return next;
}

function getCalendarDays(date, view) {
  if (view === "day") return [new Date(date.getFullYear(), date.getMonth(), date.getDate())];
  if (view === "week") {
    const first = startOfWeek(date);
    return Array.from({ length: 7 }, (_, i) => addDays(first, i));
  }
  const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
  const firstVisible = addDays(monthStart, -((monthStart.getDay() + 6) % 7));
  return Array.from({ length: 42 }, (_, i) => addDays(firstVisible, i));
}

const state = {
  view: "month", cursor: new Date(), events: [], loading: true, error: false,
  owners: [], deals: [],
};

let mainEl;

function rangeFor(days) {
  const start = new Date(days[0]);
  start.setHours(0, 0, 0, 0);
  const end = new Date(days[days.length - 1]);
  end.setHours(23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString() };
}

async function load() {
  state.loading = true; state.error = false;
  render();
  try {
    const days = getCalendarDays(state.cursor, state.view);
    const { start, end } = rangeFor(days);
    state.events = await api.get(`/api/calendar?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`);
  } catch {
    state.error = true;
  } finally {
    state.loading = false;
    render();
  }
}

async function loadRefs() {
  try { state.owners = await api.get("/api/users"); } catch {}
  try { state.deals = (await api.get("/api/deals?pageSize=100")).items; } catch {}
}

function eventsByDay() {
  const map = new Map();
  state.events.forEach((e) => {
    const key = dateKey(new Date(e.startAt));
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(e);
  });
  return map;
}

function periodLabel() {
  const opts = { month: "long", year: "numeric" };
  if (state.view === "day") {
    return state.cursor.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
  }
  if (state.view === "week") {
    const first = startOfWeek(state.cursor);
    const last = addDays(first, 6);
    return `${first.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} – ${last.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`;
  }
  return state.cursor.toLocaleDateString("en-IN", opts);
}

function shift(delta) {
  const c = new Date(state.cursor);
  if (state.view === "day") c.setDate(c.getDate() + delta);
  else if (state.view === "week") c.setDate(c.getDate() + delta * 7);
  else c.setMonth(c.getMonth() + delta);
  state.cursor = c;
  load();
}

function eventChip(e) {
  const time = e.allDay ? "All day" : new Date(e.startAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  return `<button data-event-id="${e.id}" class="event-chip block w-full truncate rounded px-1.5 py-1 text-left text-[11px] ${
    e.status === "CANCELLED" ? "bg-page text-muted line-through" : "bg-action/10 text-action"
  }" title="${escapeHtml(e.title)}">${escapeHtml(time)} ${escapeHtml(e.title)}</button>`;
}

function renderGrid() {
  if (state.loading) return uiLoading("Loading calendar…");
  if (state.error) return uiError();

  const days = getCalendarDays(state.cursor, state.view);
  const byDay = eventsByDay();
  const todayKey = dateKey(new Date());
  const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  if (state.view === "day") {
    const key = dateKey(days[0]);
    const list = byDay.get(key) || [];
    return `<div class="p-5">
      ${list.length === 0
        ? uiEmpty("Nothing scheduled", "No events on this day yet.")
        : `<ul class="space-y-2">${list.map((e) => `
            <li>
              <button data-event-id="${e.id}" class="event-chip w-full rounded-md border border-border px-3 py-2 text-left hover:bg-page">
                <div class="flex items-center justify-between">
                  <span class="text-sm font-medium text-navy">${escapeHtml(e.title)}</span>
                  ${badgeHtml(formatEnum(e.eventType), calendarEventTone(e.eventType))}
                </div>
                <p class="text-xs text-muted">${e.allDay ? "All day" : `${formatDateTime(e.startAt)}${e.endAt ? " – " + new Date(e.endAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : ""}`}${
                  e.location ? " · " + escapeHtml(e.location) : ""}</p>
              </button>
            </li>`).join("")}</ul>`}
    </div>`;
  }

  const cols = state.view === "week" ? 7 : 7;
  return `<div class="p-2">
    <div class="grid grid-cols-7 gap-px border-b border-border pb-1">
      ${weekdays.map((w) => `<div class="px-2 py-1 text-center text-[11px] font-semibold uppercase tracking-wide text-muted">${w}</div>`).join("")}
    </div>
    <div class="grid grid-cols-${cols} gap-px bg-border">
      ${days.map((day) => {
        const key = dateKey(day);
        const list = byDay.get(key) || [];
        const otherMonth = state.view === "month" && day.getMonth() !== state.cursor.getMonth();
        return `<div data-day="${key}" class="day-cell min-h-[96px] bg-white p-1.5 ${otherMonth ? "opacity-40" : ""}">
          <div class="mb-1 flex items-center justify-between">
            <span class="text-xs font-medium ${key === todayKey ? "flex h-5 w-5 items-center justify-center rounded-full bg-action text-white" : "text-navy"}">${day.getDate()}</span>
            <button data-add-day="${key}" class="add-day text-xs text-muted hover:text-action" aria-label="Add event">+</button>
          </div>
          <div class="space-y-0.5">${list.map(eventChip).join("")}</div>
        </div>`;
      }).join("")}
    </div>
  </div>`;
}

function render() {
  mainEl.innerHTML = `
    <div class="space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h1 class="text-lg font-semibold text-navy">Calendar</h1>
        <div class="flex items-center gap-2">
          <div class="flex rounded-md border border-border bg-white p-0.5">
            ${["month", "week", "day"].map((v) => `
              <button data-view="${v}" class="view-btn rounded px-3 py-1.5 text-sm capitalize ${
                state.view === v ? "bg-action text-white" : "text-navy"}">${v}</button>`).join("")}
          </div>
          <button id="new-event" class="rounded-md bg-action px-4 py-2 text-sm font-medium text-white hover:bg-action/90">New event</button>
        </div>
      </div>

      <div class="flex items-center justify-between rounded-card border border-border bg-surface px-4 py-3">
        <button id="prev" class="rounded-md border border-border bg-white px-3 py-1.5 text-sm text-navy hover:bg-page">←</button>
        <div class="flex items-center gap-2">
          <span class="text-sm font-semibold text-navy">${escapeHtml(periodLabel())}</span>
          <button id="today" class="rounded-md border border-border bg-white px-3 py-1 text-xs text-navy hover:bg-page">Today</button>
        </div>
        <button id="next" class="rounded-md border border-border bg-white px-3 py-1.5 text-sm text-navy hover:bg-page">→</button>
      </div>

      <div class="rounded-card border border-border bg-surface">${renderGrid()}</div>
    </div>
    <div id="modal-root"></div>`;

  mainEl.querySelectorAll(".view-btn").forEach((b) =>
    b.addEventListener("click", () => { state.view = b.dataset.view; load(); }));
  document.getElementById("prev").addEventListener("click", () => shift(-1));
  document.getElementById("next").addEventListener("click", () => shift(1));
  document.getElementById("today").addEventListener("click", () => { state.cursor = new Date(); load(); });
  document.getElementById("new-event").addEventListener("click", () => openEventModal(null, dateKey(state.cursor)));
  document.getElementById("retry-btn")?.addEventListener("click", load);
  mainEl.querySelectorAll(".add-day").forEach((b) =>
    b.addEventListener("click", (e) => { e.stopPropagation(); openEventModal(null, b.dataset.addDay); }));
  mainEl.querySelectorAll(".event-chip").forEach((b) =>
    b.addEventListener("click", () => {
      const ev = state.events.find((x) => x.id === b.dataset.eventId);
      if (ev) openEventModal(ev);
    }));
}

function openEventModal(event, presetDay) {
  const e = event || {};
  const startLocal = e.startAt
    ? new Date(e.startAt).toISOString().slice(0, 16)
    : `${presetDay || dateKey(new Date())}T09:00`;
  const endLocal = e.endAt ? new Date(e.endAt).toISOString().slice(0, 16) : "";

  const body = `
    ${uiField("Title", `<input required id="cf-title" value="${escapeHtml(e.title || "")}" class="${UI_INPUT_CLASS}" />`)}
    <div class="grid grid-cols-2 gap-3">
      ${uiField("Starts", `<input required type="datetime-local" id="cf-startAt" value="${startLocal}" class="${UI_INPUT_CLASS}" />`)}
      ${uiField("Ends", `<input type="datetime-local" id="cf-endAt" value="${endLocal}" class="${UI_INPUT_CLASS}" />`)}
    </div>
    <label class="flex items-center gap-2 text-sm text-navy">
      <input type="checkbox" id="cf-allDay" ${e.allDay ? "checked" : ""} class="h-4 w-4 rounded border-border" /> All day
    </label>
    <div class="grid grid-cols-3 gap-3">
      ${uiField("Type", `<select id="cf-eventType" class="${UI_INPUT_CLASS}">${uiOptions(CALENDAR_EVENT_TYPES, e.eventType || "MEETING")}</select>`)}
      ${uiField("Status", `<select id="cf-status" class="${UI_INPUT_CLASS}">${uiOptions(CALENDAR_EVENT_STATUSES, e.status || "SCHEDULED")}</select>`)}
      ${uiField("Reminder (min)", `<input type="number" min="0" max="10080" id="cf-reminderMinutes" value="${e.reminderMinutes ?? ""}" class="${UI_INPUT_CLASS}" />`)}
    </div>
    ${uiField("Location", `<input id="cf-location" value="${escapeHtml(e.location || "")}" class="${UI_INPUT_CLASS}" />`)}
    <div class="grid grid-cols-2 gap-3">
      ${uiField("Assigned to", `<select id="cf-assignedUserId" class="${UI_INPUT_CLASS}"><option value="">Unassigned</option>${
        state.owners.map((o) => `<option value="${o.id}" ${o.id === e.assignee?.id ? "selected" : ""}>${escapeHtml(o.name)}</option>`).join("")}</select>`)}
      ${uiField("Related deal", `<select id="cf-relatedDealId" class="${UI_INPUT_CLASS}"><option value="">None</option>${
        state.deals.map((d) => `<option value="${d.id}" ${d.id === e.relatedDealId ? "selected" : ""}>${escapeHtml(d.title)}</option>`).join("")}</select>`)}
    </div>
    ${uiField("Description", `<textarea id="cf-description" rows="3" class="${UI_INPUT_CLASS}">${escapeHtml(e.description || "")}</textarea>`)}
    ${event ? `<button type="button" id="cf-delete" class="text-sm text-danger hover:underline">Delete this event</button>` : ""}`;

  const label = event ? "Save changes" : "Create event";
  const modal = uiModal("modal-root", event ? "Edit event" : "New event", body, label);

  document.getElementById("cf-delete")?.addEventListener("click", async () => {
    if (!confirm(`Delete "${event.title}"? This cannot be undone.`)) return;
    await api.del(`/api/calendar/${event.id}`);
    modal.close();
    load();
  });

  uiSubmit(modal, label, async () => {
    const v = (id) => document.getElementById(id).value;
    const payload = {
      title: v("cf-title"),
      startAt: new Date(v("cf-startAt")).toISOString(),
      endAt: v("cf-endAt") ? new Date(v("cf-endAt")).toISOString() : undefined,
      allDay: document.getElementById("cf-allDay").checked,
      eventType: v("cf-eventType"), status: v("cf-status"),
      reminderMinutes: v("cf-reminderMinutes") ? Number(v("cf-reminderMinutes")) : undefined,
      location: v("cf-location"),
      assignedUserId: v("cf-assignedUserId") || undefined,
      relatedDealId: v("cf-relatedDealId") || undefined,
      description: v("cf-description"),
    };
    if (event) await api.put(`/api/calendar/${event.id}`, payload);
    else await api.post("/api/calendar", payload);
    load();
  });
}

mainEl = renderAppShell("calendar");
render();
loadRefs().then(render);
load();
