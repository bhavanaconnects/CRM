// Ported from src/app/login/page.tsx
//
// Also reproduces the middleware.ts behaviour: an already-authenticated
// visitor hitting the login page is redirected to the dashboard.
api.get("/api/auth/me")
  .then(() => { window.location.replace("../dashboard/index.html"); })
  .catch(() => { /* not logged in — stay on the login form */ });
document.getElementById("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById("login-error");
  const submitBtn = document.getElementById("login-submit");
  errorEl.classList.add("hidden");
  submitBtn.disabled = true;
  submitBtn.textContent = "Logging in…";

  try {
    await api.post("/api/auth/login", {
      email: document.getElementById("email").value,
      password: document.getElementById("password").value,
    });
    window.location.href = "../dashboard/index.html";
  } catch (err) {
    errorEl.textContent = err.message || "Login failed";
    errorEl.classList.remove("hidden");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Log in";
  }
});
