// Shared "log / edit activity" modal, used by the Activities page, the
// activity detail page and the Lead / Contact / Company / Deal detail pages,
// so an activity created from anywhere in the CRM captures the same fields.
//
// Depends on shared/api.js, format.js and ui.js (already loaded on every page).

/**
 * @param {object} opts
 * @param {object|null} opts.activity        existing activity to edit, or null
 * @param {object}      [opts.lockedRelation] {kind, id, label} — pre-set and
 *                      non-editable relation when opened from a CRM record
 * @param {string}      opts.rootId          element the modal renders into
 * @param {Array}       [opts.users|leads|contacts|companies|deals] preloaded lists
 * @param {Function}    opts.onSaved         (saved, wasEdit) => void
 */
function buildActivityModal(opts) {
  const activity = opts.activity || null;
  const locked = opts.lockedRelation || null;
  const wasEdit = Boolean(activity);

  const lists = {
    users: opts.users || [],
    leads: opts.leads || [],
    contacts: opts.contacts || [],
    companies: opts.companies || [],
    deals: opts.deals || [],
  };

  const form = activity ? {
    type: activity.type || "CALL",
    subject: activity.subject || "",
    notes: activity.notes || "",
    status: activity.status || "COMPLETED",
    durationMinutes: activity.durationMinutes ?? "",
    userId: activity.user?.id || "",
    leadId: activity.lead?.id || "",
    contactId: activity.contact?.id || "",
    companyId: activity.company?.id || "",
    dealId: activity.deal?.id || "",
    date: activity.occurredAt ? toLocalDate(activity.occurredAt) : todayLocalDate(),
    time: activity.occurredAt ? toLocalTime(activity.occurredAt) : "09:00",
  } : {
    type: "CALL", subject: "", notes: "", status: "COMPLETED", durationMinutes: "",
    userId: "", leadId: "", contactId: "", companyId: "", dealId: "",
    date: todayLocalDate(), time: nowLocalTime(),
  };

  if (locked && !wasEdit) form[`${locked.kind}Id`] = locked.id;

  const personLabel = (p) => `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim();
  const optionsFor = (items, current, label) => items
    .map((i) => `<option value="${i.id}" ${i.id === current ? "selected" : ""}>${escapeHtml(label(i))}</option>`)
    .join("");

  const relationsHtml = locked
    ? `<div class="rounded-md border border-border bg-page/40 p-3">
         <p class="text-xs font-semibold uppercase tracking-wide text-muted">Related CRM record</p>
         <p class="mt-1 text-sm text-navy">${escapeHtml(locked.kindLabel || locked.kind)}: ${escapeHtml(locked.label || "—")}</p>
       </div>`
    : `<div class="space-y-3 rounded-md border border-border bg-page/40 p-3">
         <p class="text-xs font-semibold uppercase tracking-wide text-muted">Related CRM records</p>
         <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
           ${uiField("Lead", `<select id="af-leadId" class="${UI_INPUT_CLASS}"><option value="">None</option>${optionsFor(lists.leads, form.leadId, personLabel)}</select>`)}
           ${uiField("Contact", `<select id="af-contactId" class="${UI_INPUT_CLASS}"><option value="">None</option>${optionsFor(lists.contacts, form.contactId, personLabel)}</select>`)}
           ${uiField("Company", `<select id="af-companyId" class="${UI_INPUT_CLASS}"><option value="">None</option>${optionsFor(lists.companies, form.companyId, (c) => c.name)}</select>`)}
           ${uiField("Deal", `<select id="af-dealId" class="${UI_INPUT_CLASS}"><option value="">None</option>${optionsFor(lists.deals, form.dealId, (d) => d.title)}</select>`)}
         </div>
       </div>`;

  const body = `
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
      ${uiField("Activity type <span class='text-danger'>*</span>", `<select id="af-type" class="${UI_INPUT_CLASS}">${uiOptions(ACTIVITY_TYPES, form.type)}</select>`)}
      ${uiField("Status <span class='text-danger'>*</span>", `<select id="af-status" class="${UI_INPUT_CLASS}">${uiOptions(ACTIVITY_STATUSES, form.status)}</select>`)}
    </div>
    ${uiField("Subject <span class='text-danger'>*</span>",
      `<input id="af-subject" required maxlength="200" value="${escapeHtml(form.subject)}" class="${UI_INPUT_CLASS}" placeholder="e.g. Intro call about pricing" />`)}
    ${uiField("Description / notes <span class='text-danger'>*</span>",
      `<textarea id="af-notes" required rows="3" maxlength="4000" class="${UI_INPUT_CLASS}" placeholder="What happened, or what's planned">${escapeHtml(form.notes)}</textarea>`)}
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
      ${uiField("Date <span class='text-danger'>*</span>", `<input id="af-date" type="date" required value="${form.date}" class="${UI_INPUT_CLASS}" />`)}
      ${uiField("Time <span class='text-danger'>*</span>", `<input id="af-time" type="time" required value="${form.time}" class="${UI_INPUT_CLASS}" />`)}
      <div id="af-duration-wrap" class="${activityHasDuration(form.type) ? "" : "hidden"}">
        ${uiField("Duration (minutes)", `<input id="af-duration" type="number" min="0" value="${escapeHtml(String(form.durationMinutes ?? ""))}" class="${UI_INPUT_CLASS}" />`)}
      </div>
    </div>
    ${uiField("Assigned user", `<select id="af-userId" class="${UI_INPUT_CLASS}">
      <option value="">Me</option>${optionsFor(lists.users, form.userId, (u) => u.name)}
    </select>`)}
    ${relationsHtml}`;

  const submitLabel = wasEdit ? "Save changes" : "Log activity";
  const modal = uiModal(opts.rootId, wasEdit ? "Edit activity" : "Log activity", body, submitLabel);

  // Duration only applies to calls and meetings.
  const typeEl = modal.root.querySelector("#af-type");
  typeEl.addEventListener("change", () => {
    modal.root.querySelector("#af-duration-wrap")
      .classList.toggle("hidden", !activityHasDuration(typeEl.value));
  });

  uiSubmit(modal, submitLabel, async () => {
    const val = (id) => {
      const el = modal.root.querySelector(`#${id}`);
      return el ? el.value : "";
    };
    const subject = val("af-subject").trim();
    const notes = val("af-notes").trim();
    const date = val("af-date");
    const time = val("af-time");

    if (!subject) throw new Error("Subject is required.");
    if (!notes) throw new Error("Description is required.");
    if (!date) throw new Error("Date is required.");
    if (!time) throw new Error("Time is required.");

    const type = val("af-type");
    const duration = activityHasDuration(type) && val("af-duration")
      ? Number(val("af-duration")) : null;
    if (duration !== null && (Number.isNaN(duration) || duration < 0)) {
      throw new Error("Duration must be a positive number of minutes.");
    }

    const payload = {
      type,
      subject,
      notes,
      status: val("af-status"),
      durationMinutes: duration,
      // Sent as a local naive timestamp, which is how the API stores it.
      occurredAt: `${date}T${time}:00`,
      userId: val("af-userId") || null,
      leadId: locked ? (locked.kind === "lead" ? locked.id : null) : (val("af-leadId") || null),
      contactId: locked ? (locked.kind === "contact" ? locked.id : null) : (val("af-contactId") || null),
      companyId: locked ? (locked.kind === "company" ? locked.id : null) : (val("af-companyId") || null),
      dealId: locked ? (locked.kind === "deal" ? locked.id : null) : (val("af-dealId") || null),
    };

    const saved = wasEdit
      ? await api.put(`/api/activities/${activity.id}`, payload)
      : await api.post("/api/activities", payload);

    if (opts.onSaved) await opts.onSaved(saved, wasEdit);
  });

  // When the caller had no preloaded lists, fetch them and refill the selects
  // without disturbing anything the user has already typed.
  if (opts.fetchOptions) {
    fillMissingOptions(modal, lists, form, locked);
  }

  return modal;
}

async function fillMissingOptions(modal, lists, form, locked) {
  const pull = (path) => api.get(path).then((r) => r.items ?? r).catch(() => []);
  const personLabel = (p) => `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim();

  const refill = (selector, items, label, current, noneLabel) => {
    const el = modal.root.querySelector(selector);
    if (!el || items.length === 0) return;
    el.innerHTML = `<option value="">${noneLabel}</option>` + items
      .map((i) => `<option value="${i.id}" ${i.id === current ? "selected" : ""}>${escapeHtml(label(i))}</option>`)
      .join("");
  };

  if (lists.users.length === 0) {
    refill("#af-userId", await pull("/api/users"), (u) => u.name, form.userId, "Me");
  }
  if (locked) return;

  const [leads, contacts, companies, deals] = await Promise.all([
    lists.leads.length ? lists.leads : pull("/api/leads?page=1&pageSize=100"),
    lists.contacts.length ? lists.contacts : pull("/api/contacts?page=1&pageSize=100"),
    lists.companies.length ? lists.companies : pull("/api/companies?page=1&pageSize=100&sortBy=name&sortDir=asc"),
    lists.deals.length ? lists.deals : pull("/api/deals?page=1&pageSize=100"),
  ]);
  refill("#af-leadId", leads, personLabel, form.leadId, "None");
  refill("#af-contactId", contacts, personLabel, form.contactId, "None");
  refill("#af-companyId", companies, (c) => c.name, form.companyId, "None");
  refill("#af-dealId", deals, (d) => d.title, form.dealId, "None");
}

// --- local date/time helpers (the API stores naive local timestamps) ---

function pad2(n) { return String(n).padStart(2, "0"); }

function todayLocalDate() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function nowLocalTime() {
  const d = new Date();
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function toLocalDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return todayLocalDate();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function toLocalTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "09:00";
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
