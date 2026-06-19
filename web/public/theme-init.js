// Apply the persisted (or OS-preferred) theme before paint to avoid a flash.
// Kept as a same-origin external script (not inline) so it satisfies the
// server's strict Content-Security-Policy (script-src 'self') in production.
(function () {
  try {
    var stored = window.localStorage.getItem('webiq-theme');
    var dark = stored ? stored === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.classList.toggle('dark', dark);
  } catch {
    // Ignore — storage or matchMedia may be unavailable (private mode, etc.).
  }
})();
