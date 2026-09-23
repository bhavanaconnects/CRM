// Activity detail — one activity plus the CRM record it relates to.
const activityId = new URLSearchParams(window.location.search).get("id");

const state = { activity: null, loading: true, error: false, errorMessage: "", toast: null };
let mainEl;

async function load() {
  state.loading = true;
  state.error = false;
  render();
  try {
    state.activity = await api.get(`/api/activities/${activityId}`);
  } catch (err) {
    state.error = true;
    state.errorMessage = err.message || "This activity couldn't be loaded.";
  } finally {
    state.loading = false;
    render();
  }
}

function showToast(message) {
  state.toast = message;
  render();
  setTimeout(() => {
    if (state.toast !== message) return;
    state.toast = null;
    render();
  }, 2600);
}

function detailRow(label, valueHtml) {
  return `<div class="flex items-start justify-between gap-4 border-b border-border py-2.5 last:border-0">
    <span class="text-xs font-medium uppercase tracking-wide text-muted">${label}</span>
    <span class="text-right text-sm text-navy">${valueHtml}</span>
  </div>`;
}

function relatedCard(a) {
  const related = activityRelatedRecord(a);
  if (!related) {
    return `<p class="text-sm text-muted">This activity isn't linked to a lead, contact, company or deal.</p>`;
  }
  return `<a href="${related.href}" class="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm hover:bg-page">
    <span>
      <span class="block font-medium text-navy">${escapeHtml(related.label || "—")}</span>
      <span class="block text-xs text-muted">${related.kind}</span>
    </span>
    <span class="text-xs text-action">Open →</span>
  </a>`;
}

function render() {
  if (state.loading) { mainEl.innerHTML = uiLoading("Loading activity…"); return; }
  if (state.error) {
    mainEl.innerHTML = `<div class="space-y-4">
      <a href="index.html" class="text-sm text-action hover:underline">← Back to activities</a>
      ${uiError("retry-btn", state.errorMessage)}
    </div>`;
    document.getElementById("retry-btn").addEventListener("click", load);
    return;
  }

  const a = state.activity;

  mainEl.innerHTML = `
    <div class="space-y-4">
      <a href="index.html" class="text-sm text-action hover:underline">← Back to activities</a>

      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 class="text-lg font-semibold text-navy">${escapeHtml(activitySubject(a))}</h1>
          <p class="mt-1 text-sm text-muted">${activityTypeIcon(a.type)} ${formatEnum(a.type)} · ${formatDateTime(a.occurredAt)}</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button id="edit-activity" class="rounded-md border border-border bg-white px-4 py-2 text-sm text-navy hover:bg-page">Edit</button>
          <button id="delete-activity" class="rounded-md border border-danger/30 bg-white px-4 py-2 text-sm text-danger hover:bg-danger/5">Delete</button>
        </div>
      </div>

      <div class="grid gap-6 lg:grid-cols-3">
        <div class="space-y-6 lg:col-span-2">
          ${uiCard("Details", `
            ${detailRow("Type", badgeHtml(formatEnum(a.type), "action"))}
            ${detailRow("Status", badgeHtml(formatEnum(a.status), activityStatusTone(a.status)))}
            ${detailRow("Date &amp; time", formatDateTime(a.occurredAt))}
            ${activityHasDuration(a.type) ? detailRow("Duration", formatDuration(a.durationMinutes)) : ""}
            ${detailRow("Assigned user", escapeHtml(a.user?.name || "Unassigned"))}
            ${detailRow("Logged", formatDateTime(a.createdAt))}
            ${detailRow("Last updated", formatDateTime(a.updatedAt))}
          `)}
          ${uiCard("Description", a.notes
            ? `<p class="whitespace-pre-wrap text-sm text-navy">${escapeHtml(a.notes)}</p>`
            : `<p class="text-sm text-muted">No description was recorded.</p>`)}
        </div>
        <div class="space-y-6">${uiCard("Related CRM record", relatedCard(a))}</div>
      </div>
    </div>
    ${state.toast ? `<div class="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-md bg-navy px-4 py-2 text-sm text-white shadow-lg">${escapeHtml(state.toast)}</div>` : ""}
    <div id="activity-modal-root"></div>
    <div id="activity-confirm-root"></div>`;

  document.getElementById("edit-activity").addEventListener("click", () => {
    buildActivityModal({
      activity: a,
      rootId: "activity-modal-root",
      fetchOptions: true,
      onSaved: async (saved) => {
        state.activity = saved;
        showToast("Activity updated.");
      },
    });
  });

  document.getElementById("delete-activity").addEventListener("click", () => confirmDelete(a));
}

function confirmDelete(activity) {
  const root = document.getElementById("activity-confirm-root");
  root.innerHTML = `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 px-4">
      <div role="dialog" aria-modal="true" class="w-full max-w-sm rounded-card border border-border bg-white shadow-lg">
        <div class="border-b border-border px-5 py-4"><h2 class="text-sm font-semibold text-navy">Delete activity</h2></div>
        <div class="space-y-2 px-5 py-4">
          <p class="text-sm text-navy">Delete &ldquo;${escapeHtml(activitySubject(activity))}&rdquo;?</p>
          <p class="text-sm text-muted">This can't be undone.</p>
          <p id="confirm-error" class="hidden rounded-md border border-danger/20 bg-danger/5 px-3 py-2 text-sm text-danger"></p>
        </div>
        <div class="flex justify-end gap-2 border-t border-border px-5 py-4">
          <button type="button" id="confirm-cancel" class="rounded-md border border-border bg-white px-4 py-2 text-sm text-navy hover:bg-page">Cancel</button>
          <button type="button" id="confirm-delete" class="rounded-md bg-danger px-4 py-2 text-sm font-medium text-white hover:bg-danger/90">Delete activity</button>
        </div>
      </div>
    </div>`;

  document.getElementById("confirm-cancel").addEventListener("click", () => { root.innerHTML = ""; });
  document.getElementById("confirm-delete").addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    const err = document.getElementById("confirm-error");
    err.classList.add("hidden");
    btn.disabled = true;
    btn.textContent = "Deleting…";
    try {
      await api.del(`/api/activities/${activity.id}`);
      window.location.href = "index.html";
    } catch (ex) {
      err.textContent = ex.message || "Couldn't delete the activity.";
      err.classList.remove("hidden");
      btn.disabled = false;
      btn.textContent = "Delete activity";
    }
  });
}

mainEl = renderAppShell("activities");
if (!activityId) {
  state.loading = false;
  state.error = true;
  state.errorMessage = "No activity was specified.";
  render();
} else {
  render();
  load();
}
