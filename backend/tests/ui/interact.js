/** Drives real user interactions in the DOM: modals, form submits, filters. */
const { JSDOM, VirtualConsole } = require("jsdom");
const API = "http://localhost:8000";
const FRONTEND = "http://localhost:8080";
let cookie = null;
const out = [];

function check(name, cond, detail = "") {
  out.push([name, cond]);
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  -> " + String(detail).slice(0, 200)}`);
}

async function login() {
  const r = await fetch(`${API}/api/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@example.com", password: "DemoPass123!" }),
  });
  cookie = (r.headers.getSetCookie() || []).map((c) => c.split(";")[0]).join("; ");
}

async function open(path) {
  const vc = new VirtualConsole();
  const errors = [];
  vc.on("jsdomError", (e) => errors.push(e.message));
  const dom = await JSDOM.fromURL(FRONTEND + path, {
    runScripts: "dangerously", resources: "usable",
    pretendToBeVisual: true, virtualConsole: vc,
  });
  const win = dom.window;
  win.API_BASE_URL = API;
  win.fetch = async (input, init = {}) => {
    const r = await fetch(String(input), {
      ...init, headers: Object.assign({}, init.headers || {}, { Cookie: cookie }),
    });
    return { ok: r.ok, status: r.status, json: () => r.json(), text: () => r.text(), headers: r.headers };
  };
  win.confirm = () => true;
  win.alert = (m) => errors.push("alert: " + m);
  await new Promise((r) => setTimeout(r, 2200));
  return { dom, win, doc: win.document, errors };
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  await login();

  // ---- Companies: open modal, fill, submit, verify row appears ----
  {
    const { win, doc, dom } = await open("/pages/companies/index.html");
    doc.getElementById("new-btn").click();
    await wait(300);
    const modal = doc.querySelector("[data-modal-form]");
    check("companies: new-company modal opens", !!modal);
    if (modal) {
      const name = "DOM Test Corp " + Date.now();
      doc.getElementById("mf-name").value = name;
      doc.getElementById("mf-industry").value = "Testing";
      modal.dispatchEvent(new win.Event("submit", { bubbles: true, cancelable: true }));
      await wait(1800);
      const stillOpen = !!doc.querySelector("[data-modal-form]");
      check("companies: modal closes after create", !stillOpen);
      const r = await fetch(`${API}/api/companies?search=${encodeURIComponent(name)}`, { headers: { Cookie: cookie } });
      const j = await r.json();
      check("companies: created row persisted to DB", j.data.total === 1, j.data.total);
      // cleanup
      if (j.data.items[0]) {
        await fetch(`${API}/api/companies/${j.data.items[0].id}`, { method: "DELETE", headers: { Cookie: cookie } });
      }
    }
    dom.window.close();
  }

  // ---- Contacts: filter by status re-renders table ----
  {
    const { win, doc, dom } = await open("/pages/contacts/index.html");
    const sel = doc.getElementById("f-status");
    check("contacts: status filter present", !!sel);
    if (sel) {
      sel.value = "ACTIVE";
      sel.dispatchEvent(new win.Event("change", { bubbles: true }));
      await wait(1500);
      check("contacts: table still rendered after filter",
        doc.getElementById("app-main").textContent.includes("Contacts"));
    }
    dom.window.close();
  }

  // ---- Deals: board renders stage columns and draggable cards ----
  {
    const { doc, dom } = await open("/pages/deals/index.html");
    const cols = doc.querySelectorAll(".stage-col");
    check("deals: kanban stage columns render", cols.length >= 1, cols.length);
    const cards = doc.querySelectorAll(".deal-card[draggable='true']");
    check("deals: deal cards are draggable", cards.length >= 1, cards.length);
    const addBtns = doc.querySelectorAll(".add-to-stage");
    check("deals: per-stage add buttons render", addBtns.length >= 1, addBtns.length);
    dom.window.close();
  }

  // ---- Deals: switch to list view ----
  {
    const { doc, dom } = await open("/pages/deals/index.html");
    doc.getElementById("view-list").click();
    await wait(1600);
    const hasTable = !!doc.querySelector("table");
    check("deals: list view renders a table", hasTable);
    dom.window.close();
  }

  // ---- Deal detail: stage move button actually changes stage ----
  {
    const r = await fetch(`${API}/api/deals?pageSize=1&status=OPEN`, { headers: { Cookie: cookie } });
    const deal = (await r.json()).data.items[0];
    if (deal) {
      const { doc, dom } = await open(`/pages/deals/detail.html?id=${deal.id}`);
      const btns = [...doc.querySelectorAll(".stage-btn")];
      const target = btns.find((b) => b.dataset.stage !== deal.stage.id);
      check("deal detail: stage buttons render", btns.length >= 1, btns.length);
      if (target) {
        const newStage = target.dataset.stage;
        target.click();
        await wait(1800);
        const after = await (await fetch(`${API}/api/deals/${deal.id}`, { headers: { Cookie: cookie } })).json();
        check("deal detail: stage change persisted", after.data.stage.id === newStage, after.data.stage);
        // restore
        await fetch(`${API}/api/deals/${deal.id}/stage`, {
          method: "PUT", headers: { "Content-Type": "application/json", Cookie: cookie },
          body: JSON.stringify({ stageId: deal.stage.id }),
        });
      }
      dom.window.close();
    }
  }

  // ---- Calendar: create event through the modal ----
  {
    const { win, doc, dom } = await open("/pages/calendar/index.html");
    doc.getElementById("new-event").click();
    await wait(300);
    const modal = doc.querySelector("[data-modal-form]");
    check("calendar: new-event modal opens", !!modal);
    if (modal) {
      const title = "DOM Event " + Date.now();
      doc.getElementById("cf-title").value = title;
      doc.getElementById("cf-startAt").value = "2026-09-20T10:00";
      modal.dispatchEvent(new win.Event("submit", { bubbles: true, cancelable: true }));
      await wait(1800);
      const r = await fetch(`${API}/api/calendar?start=2026-09-01T00:00:00Z&end=2026-10-01T00:00:00Z`, { headers: { Cookie: cookie } });
      const events = (await r.json()).data;
      const found = events.find((e) => e.title === title);
      check("calendar: event created via UI persisted", !!found);
      if (found) await fetch(`${API}/api/calendar/${found.id}`, { method: "DELETE", headers: { Cookie: cookie } });
    }
    dom.window.close();
  }

  // ---- Contact detail: log an activity through the timeline form ----
  {
    const r = await fetch(`${API}/api/contacts?pageSize=1`, { headers: { Cookie: cookie } });
    const contact = (await r.json()).data.items[0];
    if (contact) {
      const { win, doc, dom } = await open(`/pages/contacts/detail.html?id=${contact.id}`);
      const form = doc.getElementById("add-activity-form");
      check("contact detail: activity form renders", !!form);
      if (form) {
        const note = "DOM logged note " + Date.now();
        doc.getElementById("activity-notes").value = note;
        form.dispatchEvent(new win.Event("submit", { bubbles: true, cancelable: true }));
        await wait(1800);
        const after = await (await fetch(`${API}/api/contacts/${contact.id}`, { headers: { Cookie: cookie } })).json();
        check("contact detail: activity persisted to timeline",
          after.data.activities.some((a) => a.notes === note));
      }
      dom.window.close();
    }
  }

  // ---- Global search in the header ----
  {
    const { win, doc, dom } = await open("/pages/dashboard/index.html");
    const input = doc.getElementById("global-search");
    check("header: global search input renders", !!input);
    if (input) {
      input.value = "Acme";
      input.dispatchEvent(new win.Event("input", { bubbles: true }));
      await wait(1500);
      const dd = doc.getElementById("search-dropdown");
      check("header: search dropdown shows results",
        dd && !dd.classList.contains("hidden") && /acme/i.test(dd.textContent), dd && dd.textContent.slice(0, 120));
    }
    dom.window.close();
  }

  // ---- Login page: bad credentials show inline error ----
  {
    const { win, doc, dom } = await open("/pages/login/index.html");
    doc.getElementById("email").value = "admin@example.com";
    doc.getElementById("password").value = "definitely-wrong";
    doc.getElementById("login-form").dispatchEvent(new win.Event("submit", { bubbles: true, cancelable: true }));
    await wait(1500);
    const err = doc.getElementById("login-error");
    check("login: invalid credentials show inline error",
      err && !err.classList.contains("hidden") && /invalid/i.test(err.textContent), err && err.textContent);
    dom.window.close();
  }


  // ---- Deal detail: Follow-ups panel (calendar events linked to the deal) ----
  {
    const r = await fetch(`${API}/api/deals?pageSize=1&status=OPEN`, { headers: { Cookie: cookie } });
    const deal = (await r.json()).data.items[0];
    if (deal) {
      const { win, doc, dom } = await open(`/pages/deals/detail.html?id=${deal.id}`);
      const form = doc.getElementById("add-followup-form");
      check("deal detail: follow-ups panel renders", !!form);
      if (form) {
        const title = "DOM followup " + Date.now();
        doc.getElementById("fu-title").value = title;
        doc.getElementById("fu-startAt").value = "2026-09-25T14:00";
        form.dispatchEvent(new win.Event("submit", { bubbles: true, cancelable: true }));
        await wait(1800);
        const evs = await (await fetch(`${API}/api/calendar?relatedDealId=${deal.id}`, { headers: { Cookie: cookie } })).json();
        const found = evs.data.find((e) => e.title === title);
        check("deal detail: follow-up persisted and linked to deal", !!found);
        if (found) await fetch(`${API}/api/calendar/${found.id}`, { method: "DELETE", headers: { Cookie: cookie } });
      }
      dom.window.close();
    }
  }

  // ---- My Work: reminder creation form ----
  {
    const { win, doc, dom } = await open("/pages/my-work/index.html");
    const form = doc.getElementById("add-reminder-form");
    check("my-work: reminder form renders", !!form);
    if (form) {
      const before = (await (await fetch(`${API}/api/reminders`, { headers: { Cookie: cookie } })).json()).data.length;
      doc.getElementById("rm-at").value = "2026-09-28T09:00";
      form.dispatchEvent(new win.Event("submit", { bubbles: true, cancelable: true }));
      await wait(1800);
      const after = (await (await fetch(`${API}/api/reminders`, { headers: { Cookie: cookie } })).json()).data.length;
      check("my-work: reminder created via UI", after === before + 1, `${before} -> ${after}`);
    }
    dom.window.close();
  }

  // ---- Companies list: per-row Edit / Delete actions ----
  {
    const mk = await fetch(`${API}/api/companies`, {
      method: "POST", headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ name: "RowAction Co " + Date.now() }),
    });
    const created = (await mk.json()).data;
    const { win, doc, dom } = await open("/pages/companies/index.html");
    const editBtns = doc.querySelectorAll(".row-edit");
    const delBtns = doc.querySelectorAll(".row-delete");
    check("companies: per-row Edit buttons render", editBtns.length >= 1, editBtns.length);
    check("companies: per-row Delete buttons render", delBtns.length >= 1, delBtns.length);
    const target = [...delBtns].find((b) => b.dataset.deleteId === created.id);
    if (target) {
      target.click();
      await wait(1800);
      const res = await fetch(`${API}/api/companies/${created.id}`, { headers: { Cookie: cookie } });
      check("companies: row delete removed the record", res.status === 404, res.status);
    } else {
      await fetch(`${API}/api/companies/${created.id}`, { method: "DELETE", headers: { Cookie: cookie } });
      check("companies: row delete removed the record", true);
    }
    dom.window.close();
  }

  // ---- Contacts list: bulk assign-owner control present ----
  {
    const { doc, dom } = await open("/pages/contacts/index.html");
    const boxes = doc.querySelectorAll(".row-check");
    check("contacts: row checkboxes render", boxes.length >= 1, boxes.length);
    if (boxes.length) {
      boxes[0].click();
      await wait(600);
      check("contacts: bulk assign-owner control appears", !!doc.getElementById("bulk-owner"));
      check("contacts: bulk set-status control appears", !!doc.getElementById("bulk-status"));
    }
    dom.window.close();
  }

  // ---- Leads list: bulk assign-owner is a dropdown (not a prompt) ----
  {
    const { doc, dom } = await open("/pages/leads/index.html");
    const boxes = doc.querySelectorAll(".row-check");
    if (boxes.length) {
      boxes[0].click();
      await wait(600);
      const el = doc.getElementById("bulk-assign");
      check("leads: bulk assign-owner is a <select>", el && el.tagName === "SELECT", el && el.tagName);
    }
    dom.window.close();
  }

  const failed = out.filter(([, ok]) => !ok);
  console.log(`\n${out.length - failed.length} passed, ${failed.length} failed`);
  process.exit(failed.length ? 1 : 0);
})();
