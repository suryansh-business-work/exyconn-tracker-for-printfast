(function () {
  const SIZE_KEY = 'ct_page_size';
  const PAGE_KEY = 'ct_page';
  const ALLOWED_SIZES = [5,10,20,50];

  function getSize() {
    const n = parseInt(localStorage.getItem(SIZE_KEY), 10);
    return (Number.isInteger(n) && n > 0) ? n : 10;
  }
  function saveSize(n) { localStorage.setItem(SIZE_KEY, String(n)); }
  function getPage() {
    const p = parseInt(localStorage.getItem(PAGE_KEY), 10);
    return (Number.isInteger(p) && p > 0) ? p : 1;
  }
  function savePage(n) { localStorage.setItem(PAGE_KEY, String(n)); }

  let tbody, wrapper, rows = [], pageSize = 10, currentPage = 1;

  function refreshRows() {
    if (!tbody) return;
    rows = Array.from(tbody.querySelectorAll('tr'));
  }

  function totalPages() {
    return Math.max(1, Math.ceil(rows.length / pageSize));
  }

  function updateControlsDisabled() {
    const prev = document.getElementById('prev-page');
    const next = document.getElementById('next-page');
    if (prev) prev.disabled = currentPage <= 1;
    if (next) next.disabled = currentPage >= totalPages();
  }

  function updatePageInfo() {
    const info = document.getElementById('page-info');
    if (info) info.textContent = `Page ${currentPage} / ${totalPages()}`;
  }

  function renderPage(page) {
    refreshRows();
    const tp = totalPages();
    currentPage = Math.max(1, Math.min(tp, page || 1));
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    rows.forEach((r, idx) => {
      r.style.display = (idx >= start && idx < end) ? '' : 'none';
    });
    updatePageInfo();
    updateControlsDisabled();
    savePage(currentPage);
    if (wrapper) wrapper.scrollTop = 0;
    if (window.ct_updateAll) window.ct_updateAll(); // reformat visible timestamps
  }

  function initControls() {
    const psEl = document.getElementById('page-size');
    const prev = document.getElementById('prev-page');
    const next = document.getElementById('next-page');

    if (psEl) {
      // ensure the select has the allowed options and set the current value
      const existing = Array.from(psEl.options).map(o => Number(o.value));
      ALLOWED_SIZES.forEach(s => {
        if (!existing.includes(s)) {
          const opt = document.createElement('option');
          opt.value = String(s);
          opt.text = String(s);
          psEl.appendChild(opt);
        }
      });
      psEl.value = String(pageSize);
      psEl.addEventListener('change', () => {
        const newSize = parseInt(psEl.value, 10) || 10;
        pageSize = newSize;
        saveSize(pageSize);
        renderPage(1);
      });
    }

    if (prev) prev.addEventListener('click', () => { renderPage(currentPage - 1); });
    if (next) next.addEventListener('click', () => { renderPage(currentPage + 1); });
  }

  document.addEventListener('DOMContentLoaded', () => {
    tbody = document.querySelector('#tracker-table tbody');
    wrapper = document.getElementById('table-wrapper');
    if (!tbody) return;
    pageSize = getSize();
    currentPage = getPage();
    refreshRows();
    // clamp pageSize to allowed values (fallback to nearest)
    if (!ALLOWED_SIZES.includes(pageSize)) {
      // pick the closest allowed or default
      const fallback = ALLOWED_SIZES.reduce((acc, v) => Math.abs(v - pageSize) < Math.abs(acc - pageSize) ? v : acc, ALLOWED_SIZES[1]);
      pageSize = fallback;
      saveSize(pageSize);
    }
    initControls();
    if (currentPage > totalPages()) currentPage = totalPages();
    renderPage(currentPage);
  });

  document.addEventListener('DOMContentLoaded', () => {
    const tbody = document.getElementById('tracker-tbody');
    if (!tbody) return;

    // read rows from DOM into objects (preserve original data-ts)
    const allRowsData = Array.from(tbody.querySelectorAll('tr')).map(tr => {
      const cells = tr.querySelectorAll('td');
      const locationCell = cells[4];
      return {
        id: cells[0]?.textContent?.trim() || '',
        timestampIso: cells[1]?.querySelector('.ts')?.getAttribute('data-ts') || cells[1]?.textContent?.trim() || '',
        ip: cells[2]?.textContent?.trim() || '',
        referrer: cells[3]?.textContent?.trim() || '',
        city: locationCell?.querySelector('.loc-city')?.textContent?.trim() || '',
        timezone: locationCell?.querySelector('.loc-tz')?.textContent?.trim() || '',
        count: cells[5]?.textContent?.trim() || '',
        rawHtml: tr.innerHTML,
        element: tr
      };
    });

    // controls
    const searchInput = document.getElementById('search-input');
    const clearSearch = document.getElementById('clear-search');
    const pageSizeSelect = document.getElementById('page-size');
    const prevBtn = document.getElementById('prev-page');
    const nextBtn = document.getElementById('next-page');
    const pageInfo = document.getElementById('page-info');

    let pageSize = parseInt(pageSizeSelect.value, 10) || 10;
    let currentPage = 1;
    let currentFilter = '';
    let currentDateFilter = 'all';

    function getDateRange(filter) {
      const now = new Date();
      // Use UTC dates for comparison since timestamps are in UTC
      const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      
      switch(filter) {
        case 'today':
          const todayEnd = new Date(today.getTime() + 24 * 60 * 60 * 1000);
          return {
            start: today,
            end: todayEnd
          };
        case 'yesterday':
          const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
          return {
            start: yesterday,
            end: today
          };
        case 'last7days':
          const last7 = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
          const sevenDaysEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000);
          return {
            start: last7,
            end: sevenDaysEnd
          };
        case 'thismonth':
          const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
          const monthEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000);
          return {
            start: monthStart,
            end: monthEnd
          };
        case 'lastmonth':
          const lastMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
          const lastMonthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
          return {
            start: lastMonthStart,
            end: lastMonthEnd
          };
        default: // 'all'
          return null;
      }
    }

    function filterByDate(rows, filter) {
      if (filter === 'all') return rows;
      
      const range = getDateRange(filter);
      if (!range) return rows;
      
      return rows.filter(r => {
        if (!r.timestampIso) return false;
        try {
          const date = new Date(r.timestampIso);
          return date >= range.start && date < range.end;
        } catch (e) {
          return false;
        }
      });
    }

    function filteredRows() {
      let rows = allRowsData;
      
      // Apply date filter first
      rows = filterByDate(rows, currentDateFilter);
      
      // Then apply text search
      if (!currentFilter) return rows;
      const q = currentFilter.toLowerCase();
      return rows.filter(r =>
        r.id.toLowerCase().includes(q) ||
        r.ip.toLowerCase().includes(q) ||
        r.timestampIso.toLowerCase().includes(q) ||
        r.count.toLowerCase().includes(q) ||
        (r.city || '').toLowerCase().includes(q) ||
        (r.timezone || '').toLowerCase().includes(q) ||
        (r.referrer || '').toLowerCase().includes(q)
      );
    }

    function render() {
      const data = filteredRows();
      const total = data.length;
      const pages = Math.max(1, Math.ceil(total / pageSize));
      if (currentPage > pages) currentPage = pages;

      const start = (currentPage - 1) * pageSize;
      const slice = data.slice(start, start + pageSize);

      // build tbody HTML using preserved rawHtml but only the td content to avoid mixing handlers
      tbody.innerHTML = slice.map(r => `<tr>${r.rawHtml}</tr>`).join('');

      pageInfo.textContent = `Page ${currentPage} / ${pages} (${total} rows)`;
      prevBtn.disabled = currentPage <= 1;
      nextBtn.disabled = currentPage >= pages;

      // After re-render, notify timezone formatter (if present) to reformat timestamps
      if (window.__formatTimestamps) {
        window.__formatTimestamps();
      }
    }

    // event listeners
    pageSizeSelect.addEventListener('change', () => {
      pageSize = parseInt(pageSizeSelect.value, 10) || 10;
      currentPage = 1;
      render();
    });

    prevBtn.addEventListener('click', () => {
      if (currentPage > 1) {
        currentPage -= 1;
        render();
        prevBtn.focus();
      }
    });
    nextBtn.addEventListener('click', () => {
      currentPage += 1;
      render();
      nextBtn.focus();
    });

    if (searchInput) {
      let debounce;
      searchInput.addEventListener('input', (e) => {
        clearTimeout(debounce);
        debounce = setTimeout(() => {
          currentFilter = (e.target.value || '').trim();
          currentPage = 1;
          render();
        }, 180);
      });
    }

    if (clearSearch) {
      clearSearch.addEventListener('click', () => {
        if (searchInput) searchInput.value = '';
        currentFilter = '';
        currentPage = 1;
        render();
        if (searchInput) searchInput.focus();
      });
    }

    // keyboard shortcuts: n = next, p = prev, / = focus search
    document.addEventListener('keydown', (e) => {
      if (e.target && ['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)) return;
      if (e.key === 'n') { nextBtn.click(); }
      if (e.key === 'p') { prevBtn.click(); }
      if (e.key === '/') { e.preventDefault(); searchInput?.focus(); }
    });

    // Expose function for charts.js to update table filter
    window.updateTableFilter = function(dateFilter) {
      try {
        console.log('Table filter updated to:', dateFilter);
        currentDateFilter = dateFilter;
        currentPage = 1;
        render();
      } catch (e) {
        console.error('Error updating table filter:', e);
      }
    };

    // initial render
    render();
  });
})();
