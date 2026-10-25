// Runs before first paint so the chosen look never flashes. Settings keep the real value;
// this cached copy only avoids a flicker while they load.
try {
  const theme = localStorage.getItem('theme');
  if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme;
} catch {}
