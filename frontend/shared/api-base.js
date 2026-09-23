// Both Vite and nginx proxy /api to FastAPI, so the browser can use a
// same-origin API and the crm_session cookie works reliably on localhost.
(function () {
  if (!window.API_BASE_URL) window.API_BASE_URL = "";
})();
