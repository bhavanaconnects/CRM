// Ported from src/lib/format.ts
const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency", currency: "INR", maximumFractionDigits: 0,
});

function formatCurrency(value) {
  if (value === null || value === undefined) return "—";
  const num = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(num)) return "—";
  return currencyFormatter.format(num);
}

function formatEnum(value) {
  if (!value) return "—";
  return value.toLowerCase().split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function formatDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function initials(name) {
  if (!name) return "?";
  return name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join("");
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

const LEAD_STATUSES = ["NEW", "CONTACTED", "QUALIFIED", "NURTURING", "CONVERTED", "UNQUALIFIED", "LOST"];
const LEAD_SOURCES = ["WEBSITE", "REFERRAL", "LINKEDIN", "GOOGLE", "ADVERTISEMENT", "COLD_CALL", "EMAIL", "EVENT", "EXISTING_CUSTOMER", "OTHER"];
const LEAD_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"];
const TASK_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"];
const ACTIVITY_TYPES = ["CALL", "MEETING", "EMAIL", "WHATSAPP", "NOTE", "FOLLOW_UP"];

function leadStatusTone(status) {
  switch (status) {
    case "CONVERTED": return "success";
    case "QUALIFIED":
    case "NURTURING": return "action";
    case "UNQUALIFIED":
    case "LOST": return "danger";
    case "CONTACTED": return "warning";
    default: return "neutral";
  }
}

function leadPriorityTone(priority) {
  switch (priority) {
    case "URGENT": return "danger";
    case "HIGH": return "warning";
    case "MEDIUM": return "action";
    default: return "neutral";
  }
}

const TONE_CLASSES = {
  neutral: "bg-page text-muted border-border",
  success: "bg-success/10 text-success border-success/20",
  danger: "bg-danger/10 text-danger border-danger/20",
  warning: "bg-warning/10 text-warning border-warning/20",
  action: "bg-action/10 text-action border-action/20",
};

function badgeHtml(text, tone = "neutral") {
  return `<span class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${TONE_CLASSES[tone]}">${escapeHtml(text)}</span>`;
}

// --- Additional enum sets & tones (ported from src/types/*.ts) ---
const CONTACT_STATUSES = ["ACTIVE", "INACTIVE", "DO_NOT_CONTACT"];
const DEAL_STATUSES = ["OPEN", "WON", "LOST"];
const TASK_STATUSES = ["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"];
const CALENDAR_EVENT_TYPES = ["CALL", "MEETING", "DEMO", "FOLLOW_UP", "TASK", "OTHER"];
const CALENDAR_EVENT_STATUSES = ["DRAFT", "SCHEDULED", "CONFIRMED", "CANCELLED", "COMPLETED"];

function contactStatusTone(status) {
  switch (status) {
    case "ACTIVE": return "success";
    case "DO_NOT_CONTACT": return "danger";
    case "INACTIVE": return "neutral";
    default: return "neutral";
  }
}

function dealStatusTone(status) {
  switch (status) {
    case "WON": return "success";
    case "LOST": return "danger";
    default: return "action";
  }
}

function taskStatusTone(status) {
  switch (status) {
    case "COMPLETED": return "success";
    case "CANCELLED": return "danger";
    case "IN_PROGRESS": return "action";
    default: return "neutral";
  }
}

// --- Tasks module helpers ---
// The DB stores the Prisma enum value PENDING; the CRM calls it "To Do".
const TASK_STATUS_LABELS = {
  PENDING: "To Do",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};
const TASK_VIEWS = [
  { key: "all", label: "All" },
  { key: "today", label: "Today" },
  { key: "upcoming", label: "Upcoming" },
  { key: "overdue", label: "Overdue" },
  { key: "completed", label: "Completed" },
];

function taskStatusLabel(status) {
  return TASK_STATUS_LABELS[status] || formatEnum(status);
}

function taskPriorityTone(priority) {
  return leadPriorityTone(priority);
}

function isTaskOpen(task) {
  return task && task.status !== "COMPLETED" && task.status !== "CANCELLED";
}

function isTaskOverdue(task) {
  if (!task || !task.dueDate || !isTaskOpen(task)) return false;
  // Day granularity, same rule the API uses: overdue once the due day passed.
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  return new Date(task.dueDate) < startOfToday;
}

/** "Overdue · 12 Sep 2026" / "Due today" / "Due 20 Sep 2026" / "No due date" */
function taskDueLabel(task) {
  if (!task || !task.dueDate) return "No due date";
  const due = new Date(task.dueDate);
  if (Number.isNaN(due.getTime())) return "No due date";
  const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  if (isTaskOverdue(task)) return `Overdue · ${formatDate(task.dueDate)}`;
  if (due >= todayStart && due <= todayEnd) return "Due today";
  return `Due ${formatDate(task.dueDate)}`;
}

/** The single CRM record a task hangs off, if any. */
function taskRelatedRecord(task) {
  if (!task) return null;
  if (task.lead) {
    return {
      kind: "Lead",
      label: `${task.lead.firstName ?? ""} ${task.lead.lastName ?? ""}`.trim(),
      href: `../leads/detail.html?id=${task.lead.id}`,
    };
  }
  if (task.contact) {
    return {
      kind: "Contact",
      label: `${task.contact.firstName ?? ""} ${task.contact.lastName ?? ""}`.trim(),
      href: `../contacts/detail.html?id=${task.contact.id}`,
    };
  }
  if (task.deal) {
    return { kind: "Deal", label: task.deal.title, href: `../deals/detail.html?id=${task.deal.id}` };
  }
  if (task.company) {
    return { kind: "Company", label: task.company.name, href: `../companies/detail.html?id=${task.company.id}` };
  }
  return null;
}

// --- Activities module helpers ---
const ACTIVITY_STATUSES = ["PLANNED", "COMPLETED", "CANCELLED"];
// Types the Activities form offers. CALL/EMAIL/MEETING/NOTE are the module's
// core types; WHATSAPP and FOLLOW_UP already exist in the database enum and
// in existing rows, so they stay selectable and filterable.
const ACTIVITY_DURATION_TYPES = ["CALL", "MEETING"];

function activityStatusTone(status) {
  switch (status) {
    case "COMPLETED": return "success";
    case "CANCELLED": return "danger";
    case "PLANNED": return "action";
    default: return "neutral";
  }
}

function activityTypeIcon(type) {
  switch (type) {
    case "CALL": return "📞";
    case "EMAIL": return "✉️";
    case "MEETING": return "📅";
    case "NOTE": return "📝";
    case "WHATSAPP": return "💬";
    case "FOLLOW_UP": return "🔁";
    default: return "•";
  }
}

function activitySubject(activity) {
  if (!activity) return "—";
  return activity.subject || formatEnum(activity.type);
}

function activityHasDuration(type) {
  return ACTIVITY_DURATION_TYPES.includes(type);
}

function formatDuration(minutes) {
  if (minutes === null || minutes === undefined || minutes === "") return "—";
  const mins = Number(minutes);
  if (Number.isNaN(mins) || mins <= 0) return "—";
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}

/** The single CRM record an activity hangs off, if any. */
function activityRelatedRecord(activity) {
  if (!activity) return null;
  if (activity.lead) {
    return {
      kind: "Lead",
      label: `${activity.lead.firstName ?? ""} ${activity.lead.lastName ?? ""}`.trim(),
      href: `../leads/detail.html?id=${activity.lead.id}`,
    };
  }
  if (activity.contact) {
    return {
      kind: "Contact",
      label: `${activity.contact.firstName ?? ""} ${activity.contact.lastName ?? ""}`.trim(),
      href: `../contacts/detail.html?id=${activity.contact.id}`,
    };
  }
  if (activity.deal) {
    return { kind: "Deal", label: activity.deal.title, href: `../deals/detail.html?id=${activity.deal.id}` };
  }
  if (activity.company) {
    return { kind: "Company", label: activity.company.name, href: `../companies/detail.html?id=${activity.company.id}` };
  }
  return null;
}

/**
 * One <li> of the shared activity timeline. Used by the Activities page and
 * by the Lead / Contact / Company / Deal detail pages so every timeline in
 * the CRM looks and behaves the same.
 */
function activityTimelineItem(a, { showRelated = false, actionsHtml = "" } = {}) {
  const related = showRelated ? activityRelatedRecord(a) : null;
  const duration = activityHasDuration(a.type) && a.durationMinutes
    ? ` · ${formatDuration(a.durationMinutes)}` : "";
  return `
    <li class="relative">
      <span class="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full ${a.status === "PLANNED" ? "bg-warning" : "bg-action"}"></span>
      <div class="flex flex-wrap items-center gap-2">
        ${badgeHtml(`${activityTypeIcon(a.type)} ${formatEnum(a.type)}`, "action")}
        ${a.status ? badgeHtml(formatEnum(a.status), activityStatusTone(a.status)) : ""}
        <span class="text-xs text-muted">${formatDateTime(a.occurredAt)}${duration}</span>
      </div>
      <a href="../activities/detail.html?id=${a.id}" class="mt-1 block font-medium text-navy hover:underline">${escapeHtml(activitySubject(a))}</a>
      <p class="mt-0.5 whitespace-pre-wrap text-sm text-muted">${escapeHtml(a.notes ?? "")}</p>
      ${related ? `<a href="${related.href}" class="mt-1 inline-block text-xs text-action hover:underline">${related.kind}: ${escapeHtml(related.label || "—")}</a>` : ""}
      ${actionsHtml ? `<div class="mt-2 flex gap-2">${actionsHtml}</div>` : ""}
    </li>`;
}

// --- Work module helpers ---
const WORK_TYPES = ["CALL", "EMAIL", "MEETING", "TASK", "NOTE", "OTHER"];
const WORK_PRIORITIES = TASK_PRIORITIES; // identical scale, reused as-is
const WORK_STATUSES = ["OPEN", "IN_PROGRESS", "COMPLETED", "CANCELLED"];

function workStatusTone(status) {
  switch (status) {
    case "COMPLETED": return "success";
    case "CANCELLED": return "danger";
    case "IN_PROGRESS": return "action";
    default: return "neutral";
  }
}

function workPriorityTone(priority) {
  return leadPriorityTone(priority);
}

function workTypeIcon(type) {
  switch (type) {
    case "CALL": return "📞";
    case "EMAIL": return "✉️";
    case "MEETING": return "📅";
    case "TASK": return "✅";
    case "NOTE": return "📝";
    default: return "•";
  }
}

function isWorkOpen(work) {
  return work && work.status !== "COMPLETED" && work.status !== "CANCELLED";
}

function isWorkOverdue(work) {
  if (!work || !work.dueDate || !isWorkOpen(work)) return false;
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  return new Date(work.dueDate) < startOfToday;
}

/** The single CRM record a work item hangs off, if any. Same shape as the
 * lead/contact/company/deal refs on Tasks and Activities, so this reuses
 * the exact same lookup logic as taskRelatedRecord(). */
function workRelatedRecord(work) {
  return taskRelatedRecord(work);
}

function calendarEventTone(type) {
  switch (type) {
    case "MEETING": return "action";
    case "CALL": return "success";
    case "DEMO": return "warning";
    case "FOLLOW_UP": return "warning";
    default: return "neutral";
  }
}
