/**
 * Loads each migrated page in a real DOM (jsdom), against the live FastAPI
 * backend, and reports any JS runtime errors plus what actually rendered.
 */
const { JSDOM, VirtualConsole } = require("jsdom");
const { CookieJar } = require("tough-cookie");

const FRONTEND = "http://localhost:8080";
const API = "http://localhost:8000";

const PAGES = [
  ["login", "/pages/login/index.html", null],
  ["dashboard", "/pages/dashboard/index.html", null],
  ["leads", "/pages/leads/index.html", null],
  ["contacts", "/pages/contacts/index.html", null],
  ["companies", "/pages/companies/index.html", null],
  ["deals", "/pages/deals/index.html", null],
  ["calendar", "/pages/calendar/index.html", null],
  ["my-work", "/pages/my-work/index.html", null],
  ["tasks", "/pages/tasks/index.html", null],
  ["activities", "/pages/activities/index.html", null],
  ["lead detail", "/pages/leads/detail.html", "lead"],
  ["contact detail", "/pages/contacts/detail.html", "contact"],
  ["company detail", "/pages/companies/detail.html", "company"],
  ["deal detail", "/pages/deals/detail.html", "deal"],
];

let sessionCookie = null;
const results = [];

async function login() {
  const res = await fetch(`${API}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@example.com", password: "DemoPass123!" }),
  });
  const setCookie = res.headers.getSetCookie?.() || [];
  sessionCookie = setCookie.map((c) => c.split(";")[0]).join("; ");
  if (!sessionCookie) throw new Error("no session cookie from login");
}

async function pickIds() {
  const get = async (path) => {
    const r = await fetch(API + path, { headers: { Cookie: sessionCookie } });
    return (await r.json()).data;
  };
  const leads = await get("/api/leads?pageSize=1");
  const contacts = await get("/api/contacts?pageSize=1");
  const companies = await get("/api/companies?pageSize=1");
  const deals = await get("/api/deals?pageSize=1");
  return {
    lead: leads.items[0]?.id,
    contact: contacts.items[0]?.id,
    company: companies.items[0]?.id,
    deal: deals.items[0]?.id,
  };
}

async function loadPage(name, path, idKind, ids) {
  const errors = [];
  const vc = new VirtualConsole();
  vc.on("jsdomError", (e) => errors.push(`${e.type || "jsdomError"}: ${e.message}`));
  vc.on("error", (...args) => errors.push("console.error: " + args.join(" ")));

  let url = FRONTEND + path;
  if (idKind) {
    if (!ids[idKind]) return { name, skipped: `no ${idKind} in DB` };
    url += `?id=${ids[idKind]}`;
  }

  const dom = await JSDOM.fromURL(url, {
    runScripts: "dangerously",
    resources: "usable",
    pretendToBeVisual: true,
    virtualConsole: vc,
  });

  // Inject the session cookie + a fetch that forwards it (jsdom has no
  // cross-origin cookie jar shared with our login call).
  const win = dom.window;
  win.API_BASE_URL = API;
  const realFetch = win.fetch ? win.fetch.bind(win) : null;
  win.fetch = async (input, init = {}) => {
    const headers = Object.assign({}, init.headers || {}, { Cookie: sessionCookie });
    const r = await fetch(String(input), { ...init, headers });
    return {
      ok: r.ok, status: r.status,
      json: () => r.json(), text: () => r.text(),
      headers: r.headers,
    };
  };

  await new Promise((r) => setTimeout(r, 2500));

  const main = win.document.getElementById("app-main");
  const bodyText = (main ? main.textContent : win.document.body.textContent) || "";
  const snippet = bodyText.replace(/\s+/g, " ").trim().slice(0, 120);

  dom.window.close();
  return { name, errors, snippet, hasShell: !!main };
}

(async () => {
  await login();
  const ids = await pickIds();
  console.log("Using ids:", ids, "\n");

  for (const [name, path, idKind] of PAGES) {
    try {
      const r = await loadPage(name, path, idKind, ids);
      results.push(r);
      if (r.skipped) { console.log(`SKIP  ${name}  (${r.skipped})`); continue; }
      // jsdom cannot perform real navigation. On the login page, an
      // authenticated visitor is *supposed* to be redirected to the
      // dashboard (reproducing the original middleware.ts), so this
      // specific error is the expected-pass signal, not a failure.
      const bad = r.errors.filter((e) =>
        !/Could not load img|Error: Not implemented|css/i.test(e) &&
        !(name === "login" && /navigation to another Document/i.test(e)));
      if (name === "login") {
        const redirected = r.errors.some((e) => /navigation to another Document/i.test(e));
        console.log(`${redirected ? "PASS" : "FAIL"}  login: authenticated visitor redirected away from /login`);
      }
      if (bad.length) {
        console.log(`FAIL  ${name}`);
        bad.slice(0, 5).forEach((e) => console.log(`        >> ${String(e).slice(0, 300)}`));
      } else {
        console.log(`PASS  ${name}  :: ${r.snippet}`);
      }
    } catch (e) {
      console.log(`ERROR ${name}: ${e.message}`);
      results.push({ name, errors: [e.message] });
    }
  }
})();
