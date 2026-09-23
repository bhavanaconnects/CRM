// Shared render helpers ported from src/components/ui/*.tsx so every page
// keeps identical loading / empty / error / pagination / modal chrome.

function uiLoading(label = "Loading…") {
  return `<div class="flex items-center justify-center gap-2 py-16 text-sm text-muted">
    <span class="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-action"></span>${escapeHtml(label)}</div>`;
}

function uiEmpty(title, description, actionHtml = "") {
  return `<div class="flex flex-col items-center justify-center gap-2 rounded-card border border-dashed border-border bg-page/50 px-6 py-16 text-center">
    <p class="text-sm font-semibold text-navy">${escapeHtml(title)}</p>
    <p class="max-w-sm text-sm text-muted">${escapeHtml(description)}</p>
    ${actionHtml}
  </div>`;
}

function uiError(retryId = "retry-btn", description = "The data couldn't be loaded. Try again.") {
  return `<div class="flex flex-col items-center justify-center gap-2 rounded-card border border-danger/20 bg-danger/5 px-6 py-16 text-center">
    <p class="text-sm font-semibold text-danger">Something went wrong</p>
    <p class="max-w-sm text-sm text-muted">${escapeHtml(description)}</p>
    <button id="${retryId}" class="mt-3 rounded-md border border-border bg-white px-3 py-1.5 text-sm font-medium text-navy hover:bg-page">Retry</button>
  </div>`;
}

function uiCard(title, bodyHtml, extraClass = "") {
  return `<div class="rounded-card border border-border bg-surface ${extraClass}">
    <div class="px-5 py-4 border-b border-border"><h3 class="text-sm font-semibold text-navy">${title}</h3></div>
    <div class="p-5">${bodyHtml}</div>
  </div>`;
}

function uiPagination(page, total, pageSize, prevId = "prev-page", nextId = "next-page") {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return `<div class="flex items-center justify-between px-4 py-3 text-sm text-muted">
    <span>Page ${page} of ${totalPages} &middot; ${total} total</span>
    <div class="flex gap-2">
      <button id="${prevId}" ${page <= 1 ? "disabled" : ""} class="rounded-md border border-border bg-white px-3 py-1.5 text-sm text-navy hover:bg-page disabled:opacity-50">Previous</button>
      <button id="${nextId}" ${page >= totalPages ? "disabled" : ""} class="rounded-md border border-border bg-white px-3 py-1.5 text-sm text-navy hover:bg-page disabled:opacity-50">Next</button>
    </div>
  </div>`;
}

function uiField(label, inputHtml) {
  return `<label class="block space-y-1"><span class="text-xs font-medium text-muted">${label}</span>${inputHtml}</label>`;
}

function uiOptions(values, current, formatter = formatEnum) {
  return values.map((v) => `<option value="${v}" ${v === current ? "selected" : ""}>${formatter(v)}</option>`).join("");
}

function uiModal(rootId, title, bodyHtml, submitLabel, maxWidth = "max-w-lg") {
  const root = document.getElementById(rootId);
  root.innerHTML = `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 px-4">
      <div role="dialog" aria-modal="true" class="w-full ${maxWidth} max-h-[90vh] overflow-y-auto rounded-card border border-border bg-white shadow-lg">
        <div class="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 class="text-sm font-semibold text-navy">${escapeHtml(title)}</h2>
          <button data-modal-close class="text-muted hover:text-navy" aria-label="Close">✕</button>
        </div>
        <form data-modal-form class="space-y-4 p-5">
          <p data-modal-error class="hidden rounded-md border border-danger/20 bg-danger/5 px-3 py-2 text-sm text-danger"></p>
          ${bodyHtml}
          <div class="flex justify-end gap-2 pt-2">
            <button type="button" data-modal-cancel class="rounded-md border border-border bg-white px-4 py-2 text-sm text-navy hover:bg-page">Cancel</button>
            <button type="submit" data-modal-submit class="rounded-md bg-action px-4 py-2 text-sm font-medium text-white hover:bg-action/90">${escapeHtml(submitLabel)}</button>
          </div>
        </form>
      </div>
    </div>`;

  const close = () => { root.innerHTML = ""; };
  root.querySelector("[data-modal-close]").addEventListener("click", close);
  root.querySelector("[data-modal-cancel]").addEventListener("click", close);
  return { root, close, form: root.querySelector("[data-modal-form]") };
}

/** Wires a modal form submit with loading state + server-side error display. */
function uiSubmit(modal, submitLabel, handler) {
  modal.form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = modal.root.querySelector("[data-modal-submit]");
    const err = modal.root.querySelector("[data-modal-error]");
    err.classList.add("hidden");
    btn.disabled = true;
    btn.textContent = "Saving…";
    try {
      await handler();
      modal.close();
    } catch (ex) {
      err.textContent = ex.message || "Something went wrong. Please try again.";
      err.classList.remove("hidden");
      btn.disabled = false;
      btn.textContent = submitLabel;
    }
  });
}

function uiDebounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

const UI_INPUT_CLASS = "w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-navy placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-action/40 focus:border-action";
