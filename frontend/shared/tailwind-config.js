// Design tokens ported 1:1 from tailwind.config.ts.
//
// Guarded because this runs immediately after the Tailwind CDN <script>:
// if that request is blocked (offline, corporate proxy, CSP), `tailwind`
// is undefined and an unguarded assignment would throw, killing every
// other script on the page. Styling degrades; the app still works.
(function () {
  var config = {
    theme: {
      extend: {
        colors: {
          navy: "#0B1E3D",
          action: "#2F5CFF",
          page: "#F7F9FC",
          surface: "#FFFFFF",
          border: "#E4E9F2",
          muted: "#5B6B82",
          success: "#1C9C6B",
          danger: "#D64545",
          warning: "#C98A1A",
        },
        fontFamily: {
          sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        },
        borderRadius: { card: "10px" },
      },
    },
  };

  if (typeof tailwind !== "undefined") {
    tailwind.config = config;
  } else {
    console.warn("Tailwind CDN did not load; falling back to unstyled layout.");
  }
})();
