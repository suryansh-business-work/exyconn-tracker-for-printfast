(function () {
  const tzSelector = document.getElementById('tz-selector');
  const tzDisplay = document.getElementById('tz-display');

  function browserTZ() {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch (e) { return 'UTC'; }
  }

  function getSelectedTZ() {
    if (!tzSelector) return 'UTC';
    const v = tzSelector.value;
    return v === 'auto' ? browserTZ() : v;
  }

  // main formatting routine — exported so table.js can re-trigger
  function formatTimestamps() {
    const tz = getSelectedTZ();
    // human friendly short format
    const formatter = (ts) => {
      try {
        const d = new Date(ts);
        if (isNaN(d)) return ts;
        return new Intl.DateTimeFormat(undefined, {
          timeZone: tz,
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        }).format(d);
      } catch (e) {
        return ts;
      }
    };

    document.querySelectorAll('.ts').forEach(el => {
      const raw = el.getAttribute('data-ts') || el.textContent || '';
      const human = formatter(raw);
      el.textContent = human;
      el.title = raw + ' (' + tz + ')';
    });

    if (tzDisplay) {
      tzDisplay.textContent = (tzSelector && tzSelector.value === 'auto') ? `Detected: ${tz}` : tz;
    }
  }

  // expose for other scripts to call after table re-render
  window.__formatTimestamps = formatTimestamps;

  // on selector change, reformat immediately
  if (tzSelector) {
    // initialize selector to 'auto' visually if not set
    if (!tzSelector.value) tzSelector.value = 'auto';
    tzSelector.addEventListener('change', () => {
      formatTimestamps();
    });
  }

  // format on initial load
  document.addEventListener('DOMContentLoaded', () => {
    formatTimestamps();
  });
})();
