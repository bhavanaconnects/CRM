// My Work — the signed-in user's own tasks, reminders and automation rules.
//
// Task buckets come from GET /api/tasks/my-work, which scopes everything to
// the current user server-side (the previous version pulled the whole org's
// task list and bucketed it in the browser).
let mainEl;
const state = {
  summary: null, reminders: [], work: null, upcomingActivities: [],
  loading: true, error: false, errorMessage: "",
};

async function load() {
  state.loading = true; state.error = false;
  render();
  try {
    const [summary, reminders, work, activities] = await Promise.all([
      api.get("/api/automation"),
      api.get("/api/reminders").catch(() => []),
      api.get("/api/tasks/my-work"),
      api.get("/api/activities/upcoming?mine=true&limit=10").catch(() => ({ items: [] })),
    ]);
    state.summary = summary;
    state.reminders = reminders;
    state.work = work;
    state.upcomingActivities = activities.items || [];
  } catch (err) {
    state.error = true;
    state.errorMessage = err.message || "The data couldn't be loaded. Try again.";
  } finally {
    state.loading = false;
    render();
  }
}

function taskList(items, emptyText, { completed = false } = {}) {
  if (!items || items.length === 0) return `<p class="text-sm text-muted">${escapeHtml(emptyText)}</p>`;
  return `<ul class="space-y-2 text-sm">${items.map((t) => {
    const related = taskRelatedRecord(t);
    return `
    <li class="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
      <div class="min-w-0">
        <a href="../tasks/detail.html?id=${t.id}" class="block truncate font-medium ${completed ? "text-muted line-through" : "text-navy"} hover:underline">${escapeHtml(t.title)}</a>
        <p class="truncate text-xs ${isTaskOverdue(t) ? "text-danger" : "text-muted"}">
          ${escapeHtml(completed ? `Completed ${formatDate(t.completedAt)}` : taskDueLabel(t))}${related ? ` · ${escapeHtml(related.kind)}: ${escapeHtml(related.label)}` : ""}
        </p>
      </div>
      <div class="flex shrink-0 items-center gap-2">
        ${badgeHtml(formatEnum(t.priority), taskPriorityTone(t.priority))}
        <button data-task-id="${t.id}" data-completed="${completed ? "true" : "false"}"
          class="toggle-task rounded-md border border-border bg-white px-3 py-1.5 text-sm text-navy hover:bg-page">
          ${completed ? "Reopen" : "Complete"}
        </button>
      </div>
    </li>`;
  }).join("")}</ul>`;
}

function render() {
  if (state.loading) { mainEl.innerHTML = uiLoading("Loading your work…"); return; }
  if (state.error) {
    mainEl.innerHTML = uiError("retry-btn", state.errorMessage);
    document.getElementById("retry-btn").addEventListener("click", load);
    return;
  }

  const s = state.summary;
  const w = state.work;
  const stats = w.stats;

  const kpis = [
    ["Due today", stats.dueToday, "today", false],
    ["Overdue", stats.overdue, "overdue", stats.overdue > 0],
    ["Open tasks", stats.open, "all", false],
    ["Completed", stats.completed, "completed", false],
  ];

  const REMINDER_TARGET_TYPES = ["TASK", "MEETING", "FOLLOW_UP", "DEAL_CLOSE_DATE"];
  const REMINDER_OFFSETS = ["MINUTES_5", "MINUTES_15", "MINUTES_30", "HOURS_1", "DAYS_1"];

  const remindersHtml = `
    <form id="add-reminder-form" class="mb-3 space-y-2 border-b border-border pb-3">
      <div class="grid grid-cols-2 gap-2">
        <select id="rm-type" class="${UI_INPUT_CLASS}">${uiOptions(REMINDER_TARGET_TYPES, "FOLLOW_UP")}</select>
        <select id="rm-offset" class="${UI_INPUT_CLASS}">${uiOptions(REMINDER_OFFSETS, "MINUTES_15")}</select>
      </div>
      <input id="rm-at" type="datetime-local" class="${UI_INPUT_CLASS}" />
      <p id="rm-error" class="hidden rounded-md border border-danger/20 bg-danger/5 px-3 py-2 text-sm text-danger"></p>
      <button type="submit" id="rm-submit" class="rounded-md bg-action px-3 py-1.5 text-sm font-medium text-white hover:bg-action/90">Add reminder</button>
    </form>
    ${state.reminders.length === 0
      ? `<p class="text-sm text-muted">No upcoming reminders.</p>`
      : `<ul class="space-y-2 text-sm">${state.reminders.map((r) => `
          <li class="flex items-center justify-between rounded-md border border-border px-3 py-2">
            <div>
              <p class="font-medium text-navy">${formatEnum(r.targetType)} reminder</p>
              <p class="text-xs text-muted">${formatDateTime(r.reminderAt)} · ${formatEnum(r.offset)} before</p>
            </div>
          </li>`).join("")}</ul>`}`;

  const rulesHtml = s.rules.length === 0
    ? `<p class="text-sm text-muted">No automation rules configured.</p>`
    : `<ul class="space-y-2 text-sm">${s.rules.map((r) => `
        <li class="flex items-center justify-between rounded-md border border-border px-3 py-2">
          <div>
            <p class="font-medium text-navy">${escapeHtml(r.name)}</p>
            <p class="text-xs text-muted">${formatEnum(r.type)}</p>
          </div>
          ${badgeHtml(r.enabled ? "Enabled" : "Disabled", r.enabled ? "success" : "neutral")}
        </li>`).join("")}</ul>`;

  mainEl.innerHTML = `
    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <h1 class="text-lg font-semibold text-navy">My Work</h1>
        <a href="../tasks/index.html" class="rounded-md border border-border bg-white px-4 py-2 text-sm text-navy hover:bg-page">All tasks</a>
      </div>

      <div class="grid grid-cols-2 gap-4 md:grid-cols-4">
        ${kpis.map(([label, value, view, danger]) => `
          <a href="../tasks/index.html?view=${view}" class="rounded-card border border-border bg-surface p-5 hover:border-action/60">
            <p class="text-xs font-medium uppercase tracking-wide text-muted">${label}</p>
            <p class="mt-2 text-2xl font-semibold tabular-nums ${danger ? "text-danger" : "text-navy"}">${value}</p>
          </a>`).join("")}
      </div>

      <div class="grid gap-6 lg:grid-cols-2">
        ${uiCard("Today's tasks", taskList(w.today, "Nothing due today."))}
        ${uiCard("Upcoming tasks", taskList(w.upcoming, "Nothing scheduled ahead."))}
        ${uiCard("Overdue tasks", taskList(w.overdue, "Nothing overdue — nice."))}
        ${uiCard("Recently completed", taskList(w.recentlyCompleted, "No tasks completed in the last 14 days.", { completed: true }))}
        ${uiCard("No due date", taskList(w.noDueDate, "Every open task assigned to you has a due date."))}
        ${uiCard("Upcoming meetings & follow-ups", `
          <div class="grid grid-cols-2 gap-4">
            <div>
              <p class="text-xs font-medium uppercase tracking-wide text-muted">Upcoming meetings</p>
              <p class="mt-1 text-2xl font-semibold tabular-nums text-navy">${s.upcomingMeetings}</p>
            </div>
            <div>
              <p class="text-xs font-medium uppercase tracking-wide text-muted">Follow-ups due (7d)</p>
              <p class="mt-1 text-2xl font-semibold tabular-nums text-navy">${s.pendingFollowUps}</p>
            </div>
          </div>`)}
        ${uiCard("My upcoming activities", state.upcomingActivities.length === 0
          ? `<p class="text-sm text-muted">No planned calls, meetings or follow-ups assigned to you.</p>`
          : `<ol class="relative space-y-4 border-l border-border pl-4">${
              state.upcomingActivities.map((a) => activityTimelineItem(a, { showRelated: true })).join("")
            }</ol>`)}
        ${uiCard("Reminders", remindersHtml)}
        ${uiCard("Automation rules", rulesHtml)}
      </div>
    </div>`;

  document.getElementById("add-reminder-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const at = document.getElementById("rm-at").value;
    const err = document.getElementById("rm-error");
    const btn = document.getElementById("rm-submit");
    err.classList.add("hidden");
    if (!at) {
      err.textContent = "Pick a reminder time first.";
      err.classList.remove("hidden");
      return;
    }
    btn.disabled = true;
    btn.textContent = "Adding…";
    try {
      await api.post("/api/reminders", {
        reminderAt: new Date(at).toISOString(),
        targetType: document.getElementById("rm-type").value,
        offset: document.getElementById("rm-offset").value,
      });
      load();
    } catch (ex) {
      err.textContent = ex.message || "Unable to create reminder.";
      err.classList.remove("hidden");
      btn.disabled = false;
      btn.textContent = "Add reminder";
    }
  });

  mainEl.querySelectorAll(".toggle-task").forEach((btn) =>
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      btn.textContent = "Saving…";
      try {
        await api.patch(`/api/tasks/${btn.dataset.taskId}/complete`, {
          completed: btn.dataset.completed !== "true",
        });
        load();
      } catch {
        btn.disabled = false;
        btn.textContent = btn.dataset.completed === "true" ? "Reopen" : "Complete";
      }
    }));
}

mainEl = renderAppShell("my-work");
load();
