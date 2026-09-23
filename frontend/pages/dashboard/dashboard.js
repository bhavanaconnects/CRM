// Ported from src/app/(app)/dashboard/page.tsx
const currency = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

function statusTone(status) {
  switch (status) {
    case "QUALIFIED":
    case "CONVERTED": return "success";
    case "UNQUALIFIED": return "danger";
    case "CONTACTED": return "action";
    default: return "neutral";
  }
}

function relatedTo(activity) {
  if (activity.lead) return `${activity.lead.firstName} ${activity.lead.lastName}`;
  if (activity.contact) return `${activity.contact.firstName} ${activity.contact.lastName}`;
  if (activity.company) return activity.company.name;
  if (activity.deal) return activity.deal.title;
  return "General";
}

function emptyState(title, description) {
  return `<div class="flex flex-col items-center justify-center gap-2 rounded-card border border-dashed border-border bg-page/50 px-6 py-10 text-center">
    <p class="text-sm font-semibold text-navy">${escapeHtml(title)}</p>
    <p class="max-w-sm text-sm text-muted">${escapeHtml(description)}</p>
  </div>`;
}

function card(titleHtml, bodyHtml, extraClass = "") {
  return `<div class="rounded-card border border-border bg-surface ${extraClass}">
    <div class="px-5 py-4 border-b border-border"><h3 class="text-sm font-semibold text-navy">${titleHtml}</h3></div>
    <div class="p-5">${bodyHtml}</div>
  </div>`;
}

async function loadDashboard(main) {
  main.innerHTML = `<div class="flex items-center justify-center gap-2 py-16 text-sm text-muted">
    <span class="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-action"></span>Loading dashboard…</div>`;

  let data;
  try {
    data = await api.get("/api/dashboard");
  } catch (err) {
    main.innerHTML = `<div class="flex flex-col items-center justify-center gap-2 rounded-card border border-danger/20 bg-danger/5 px-6 py-16 text-center">
      <p class="text-sm font-semibold text-danger">Something went wrong</p>
      <p class="max-w-sm text-sm text-muted">${escapeHtml(err.message)}</p>
      <button onclick="loadDashboard(document.getElementById('app-main'))" class="mt-3 rounded-md border border-border bg-white px-3 py-1.5 text-sm font-medium text-navy hover:bg-page">Retry</button>
    </div>`;
    return;
  }

  const kpiCards = [
    { label: "Total Leads", value: data.kpis.totalLeads.toLocaleString("en-IN") },
    { label: "New Leads", value: data.kpis.newLeads.toLocaleString("en-IN") },
    { label: "Open Deals", value: data.kpis.openDeals.toLocaleString("en-IN") },
    { label: "Won Deals", value: data.kpis.wonDeals.toLocaleString("en-IN") },
    { label: "Pipeline Value", value: currency.format(data.kpis.pipelineValue) },
    { label: "Revenue", value: currency.format(data.kpis.revenue) },
  ];

  const kpiHtml = kpiCards.map((k) => `
    <div class="rounded-card border border-border bg-surface">
      <div class="p-5">
        <p class="text-xs font-medium uppercase tracking-wide text-muted">${k.label}</p>
        <p class="mt-2 text-2xl font-semibold tabular-nums text-navy">${k.value}</p>
      </div>
    </div>`).join("");

  const productivityHtml = `<div class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
    ${[
      ["Completed this week", data.productivity.tasksCompletedThisWeek, false],
      ["Pending tasks", data.productivity.tasksPending, false],
      ["Overdue tasks", data.productivity.tasksOverdue, true],
      ["Meetings this week", data.productivity.meetingsThisWeek, false],
      ["Follow-ups due", data.productivity.followUpsDue, false],
      ["Deals closing this month", data.productivity.dealsClosingThisMonth, false],
    ].map(([label, value, danger]) => `
      <div>
        <p class="text-xs font-medium uppercase tracking-wide text-muted">${label}</p>
        <p class="mt-1 text-2xl font-semibold tabular-nums ${danger ? "text-danger" : "text-navy"}">${value}</p>
      </div>`).join("")}
  </div>`;

  const recentLeadsHtml = data.recentLeads.length === 0
    ? emptyState("No leads yet", "New leads will show up here.")
    : `<ul class="divide-y divide-border">${data.recentLeads.map((l) => `
        <li class="flex items-center justify-between py-3 text-sm">
          <div><p class="font-medium text-navy">${escapeHtml(l.firstName)} ${escapeHtml(l.lastName)}</p>
          <p class="text-muted">${escapeHtml(l.companyName || "—")}</p></div>
          ${badgeHtml(formatEnum(l.status), statusTone(l.status))}
        </li>`).join("")}</ul>`;

  const activityRow = (a) => `
        <li class="py-3 text-sm">
          <a href="../activities/detail.html?id=${a.id}" class="block hover:underline">
            <div class="flex items-center justify-between gap-2">
              <span class="font-medium text-navy">${activityTypeIcon(a.type)} ${escapeHtml(activitySubject(a))}</span>
              <span class="shrink-0 text-xs text-muted">${formatDateTime(a.occurredAt)}</span>
            </div>
            <p class="mt-1 line-clamp-1 text-muted">${escapeHtml(a.notes ?? "")}</p>
            <p class="mt-1 text-xs text-muted">${escapeHtml(relatedTo(a))} ${a.user ? `· ${escapeHtml(a.user.name)}` : ""}</p>
          </a>
        </li>`;

  const recentActivitiesHtml = data.recentActivities.length === 0
    ? emptyState("No activity yet", "Calls, emails, meetings and notes will show up here.")
    : `<ul class="divide-y divide-border">${data.recentActivities.map(activityRow).join("")}</ul>`;

  const upcomingActivities = data.upcomingActivities || [];
  const upcomingActivitiesHtml = upcomingActivities.length === 0
    ? emptyState("Nothing scheduled", "Planned calls and meetings will show up here.")
    : `<ul class="divide-y divide-border">${upcomingActivities.map(activityRow).join("")}</ul>`;

  // --- Tasks module statistics ---
  const taskStats = data.taskStats || { dueToday: 0, overdue: 0, open: 0, completed: 0 };
  const taskStatsHtml = `<div class="grid grid-cols-2 gap-4 md:grid-cols-4">
    ${[
      ["Tasks due today", taskStats.dueToday, "today", false],
      ["Overdue tasks", taskStats.overdue, "overdue", taskStats.overdue > 0],
      ["Open tasks", taskStats.open, "all", false],
      ["Completed tasks", taskStats.completed, "completed", false],
    ].map(([label, value, view, danger]) => `
      <a href="../tasks/index.html?view=${view}" class="rounded-md border border-border px-3 py-3 hover:border-action/60">
        <p class="text-xs font-medium uppercase tracking-wide text-muted">${label}</p>
        <p class="mt-1 text-2xl font-semibold tabular-nums ${danger ? "text-danger" : "text-navy"}">${value}</p>
      </a>`).join("")}
  </div>`;

  const todaysTasksHtml = data.todaysTasks.length === 0
    ? emptyState("Nothing due today", "Tasks due today will show up here.")
    : `<ul class="divide-y divide-border">${data.todaysTasks.map((t) => `
        <li class="py-3 text-sm">
          <a href="../tasks/detail.html?id=${t.id}" class="flex items-center justify-between hover:underline">
            <div><p class="font-medium text-navy">${escapeHtml(t.title)}</p>
            <p class="text-muted">${escapeHtml(t.assignee ? t.assignee.name : "Unassigned")}</p></div>
            ${badgeHtml(formatEnum(t.priority), taskPriorityTone(t.priority))}
          </a>
        </li>`).join("")}</ul>`;

  const pipelineHtml = data.pipeline.length === 0
    ? emptyState("No pipeline configured", "Set up a pipeline to see stages here.")
    : `<ul class="space-y-3">${data.pipeline.map((s) => `
        <li class="flex items-center justify-between text-sm">
          <span class="text-navy">${escapeHtml(s.stageName)}</span>
          <span class="text-muted">${s.dealCount} deals · ${currency.format(s.totalValue)}</span>
        </li>`).join("")}</ul>`;

  const leadsBySourceHtml = data.leadsBySource.length === 0
    ? emptyState("No leads yet", "Lead sources will be summarized here.")
    : `<ul class="grid grid-cols-2 gap-3 sm:grid-cols-3">${data.leadsBySource.map((s) => `
        <li class="rounded-md border border-border px-3 py-2 text-sm text-navy">
          <p class="text-muted">${formatEnum(s.source)}</p>
          <p class="text-lg font-semibold tabular-nums">${s.count}</p>
        </li>`).join("")}</ul>`;

  main.innerHTML = `
    <div class="space-y-6">
      <h1 class="text-lg font-semibold text-navy">Dashboard</h1>
      <div class="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">${kpiHtml}</div>
      ${card("Tasks", taskStatsHtml)}
      ${card("Productivity Snapshot", productivityHtml)}
      <div class="grid gap-6 lg:grid-cols-2">
        ${card("Recent Leads", recentLeadsHtml)}
        ${card("Recent Activities", recentActivitiesHtml)}
        ${card("Upcoming Activities", upcomingActivitiesHtml)}
        ${card("Today&rsquo;s Tasks", todaysTasksHtml)}
        ${card("Sales Pipeline", pipelineHtml)}
        ${card("Leads by Source", leadsBySourceHtml, "lg:col-span-2")}
      </div>
    </div>`;
}

const main = renderAppShell("dashboard");
loadDashboard(main);
