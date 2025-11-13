(function () {
  'use strict';

  // Wait for DOM and ensure Chart.js is loaded
  if (typeof Chart === 'undefined') {
    console.warn('Chart.js not loaded, skipping chart initialization');
    return;
  }

  let dailyHitsChart = null;
  let dailyUniqueChart = null;
  let allRows = [];
  let currentFilter = 'all';

  function getDateRange(filter) {
    const now = new Date();
    console.log('Current UTC time:', now.toISOString());
    console.log('Current local time:', now.toString());
    
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

  function filterRowsByDate(rows, filter) {
    if (filter === 'all') return rows;
    
    const range = getDateRange(filter);
    if (!range) return rows;
    
    console.log('Date range for', filter, ':', range.start.toISOString(), 'to', range.end.toISOString());
    
    const filtered = rows.filter(row => {
      if (!row.timestamp) return false;
      try {
        const date = new Date(row.timestamp);
        const isInRange = date >= range.start && date < range.end;
        if (isInRange) {
          console.log('Including:', row.timestamp);
        }
        return isInRange;
      } catch (e) {
        return false;
      }
    });
    
    console.log('Filtered', rows.length, 'rows to', filtered.length, 'rows for filter:', filter);
    return filtered;
  }

  function updateFilterCounts() {
    const filters = ['all', 'today', 'yesterday', 'last7days', 'thismonth', 'lastmonth'];
    
    filters.forEach(filter => {
      const filteredRows = filter === 'all' ? allRows : filterRowsByDate(allRows, filter);
      
      // Show the number of records (hits), not the sum of count field
      const totalHits = filteredRows.length;
      
      const countBadge = document.querySelector(`[data-count="${filter}"]`);
      if (countBadge) {
        countBadge.textContent = totalHits;
      }
    });
  }

  function updateCharts(filter) {
    const filteredRows = filterRowsByDate(allRows, filter);
    
    if (filteredRows.length === 0) {
      // No data for this filter - show empty state but don't destroy charts
      console.log('No data for filter:', filter);
      // Keep charts with empty data
      if (dailyHitsChart) {
        dailyHitsChart.data.labels = [];
        dailyHitsChart.data.datasets[0].data = [];
        dailyHitsChart.update();
      }
      if (dailyUniqueChart) {
        dailyUniqueChart.data.labels = [];
        dailyUniqueChart.data.datasets[0].data = [];
        dailyUniqueChart.update();
      }
      
      // Still notify table to update
      if (window.updateTableFilter) {
        window.updateTableFilter(filter);
      }
      return;
    }

    // Process data: group by day
    const dailyData = {};
    
    filteredRows.forEach(row => {
      if (!row.timestamp) return;
      
      try {
        const date = new Date(row.timestamp);
        if (isNaN(date.getTime())) return;
        
        // Get date string in YYYY-MM-DD format (local time)
        const dateKey = date.getFullYear() + '-' + 
                        String(date.getMonth() + 1).padStart(2, '0') + '-' + 
                        String(date.getDate()).padStart(2, '0');
        
        if (!dailyData[dateKey]) {
          dailyData[dateKey] = {
            hits: 0,
            uniqueIPs: new Set()
          };
        }
        
        dailyData[dateKey].hits++;
        if (row.ip) {
          dailyData[dateKey].uniqueIPs.add(row.ip);
        }
      } catch (e) {
        console.warn('Invalid timestamp:', row.timestamp, e);
      }
    });

    // Determine date range - show at least 10 days
    const today = new Date();
    const thirtyDaysAgo = new Date(today.getTime() - 10 * 24 * 60 * 60 * 1000);
    
    // Find the earliest date in data
    const sortedDates = Object.keys(dailyData).sort();
    let startDate;
    
    if (sortedDates.length > 0) {
      const earliestDataDate = new Date(sortedDates[0]);
      startDate = earliestDataDate < thirtyDaysAgo ? earliestDataDate : thirtyDaysAgo;
    } else {
      startDate = thirtyDaysAgo;
    }
    
    // Generate all dates from start to today
    const allDates = [];
    const currentDate = new Date(startDate);
    currentDate.setHours(0, 0, 0, 0);
    const endDate = new Date(today);
    endDate.setHours(0, 0, 0, 0);
    
    while (currentDate <= endDate) {
      const dateKey = currentDate.getFullYear() + '-' + 
                      String(currentDate.getMonth() + 1).padStart(2, '0') + '-' + 
                      String(currentDate.getDate()).padStart(2, '0');
      allDates.push(dateKey);
      
      // Initialize with 0 if no data for this date
      if (!dailyData[dateKey]) {
        dailyData[dateKey] = {
          hits: 0,
          uniqueIPs: new Set()
        };
      }
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    const labels = allDates.map(dateStr => {
      // Format as "Nov 13" or "MM/DD"
      const [year, month, day] = dateStr.split('-');
      const date = new Date(year, month - 1, day);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });
    
    const hitsData = allDates.map(dateKey => dailyData[dateKey].hits);
    const uniqueClientsData = allDates.map(dateKey => dailyData[dateKey].uniqueIPs.size);

    // Update or create Chart 1: Daily Hits
    const dailyHitsCanvas = document.getElementById('daily-hits-chart');
    if (dailyHitsCanvas) {
      if (dailyHitsChart) {
        dailyHitsChart.data.labels = labels;
        dailyHitsChart.data.datasets[0].data = hitsData;
        dailyHitsChart.update();
      } else {
        dailyHitsChart = new Chart(dailyHitsCanvas, {
          type: 'line',
          data: {
            labels: labels,
            datasets: [{
              label: 'Hits per Day',
              data: hitsData,
              borderColor: 'rgb(37, 99, 235)',
              backgroundColor: 'rgba(37, 99, 235, 0.1)',
              borderWidth: 2,
              fill: true,
              tension: 0.3,
              pointRadius: 4,
              pointHoverRadius: 6,
              pointBackgroundColor: 'rgb(37, 99, 235)',
              pointBorderColor: '#fff',
              pointBorderWidth: 2
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                display: true,
                position: 'top',
                labels: {
                  usePointStyle: true,
                  padding: 15,
                  font: { size: 12 }
                }
              },
              tooltip: {
                mode: 'index',
                intersect: false,
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                titleFont: { size: 13 },
                bodyFont: { size: 12 },
                padding: 10,
                cornerRadius: 4
              }
            },
            scales: {
              y: {
                beginAtZero: true,
                ticks: {
                  precision: 0,
                  font: { size: 11 }
                },
                grid: {
                  color: 'rgba(0, 0, 0, 0.05)'
                }
              },
              x: {
                ticks: {
                  font: { size: 11 },
                  maxRotation: 45,
                  minRotation: 0
                },
                grid: {
                  display: false
                }
              }
            },
            interaction: {
              mode: 'nearest',
              axis: 'x',
              intersect: false
            }
          }
        });
      }
    }

    // Update or create Chart 2: Daily Unique Clients
    const dailyUniqueCanvas = document.getElementById('daily-unique-chart');
    if (dailyUniqueCanvas) {
      if (dailyUniqueChart) {
        dailyUniqueChart.data.labels = labels;
        dailyUniqueChart.data.datasets[0].data = uniqueClientsData;
        dailyUniqueChart.update();
      } else {
        dailyUniqueChart = new Chart(dailyUniqueCanvas, {
          type: 'bar',
          data: {
            labels: labels,
            datasets: [{
              label: 'Unique Clients per Day',
              data: uniqueClientsData,
              backgroundColor: 'rgba(16, 185, 129, 0.7)',
              borderColor: 'rgb(16, 185, 129)',
              borderWidth: 1,
              borderRadius: 4,
              hoverBackgroundColor: 'rgba(16, 185, 129, 0.9)'
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                display: true,
                position: 'top',
                labels: {
                  usePointStyle: true,
                  padding: 15,
                  font: { size: 12 }
                }
              },
              tooltip: {
                mode: 'index',
                intersect: false,
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                titleFont: { size: 13 },
                bodyFont: { size: 12 },
                padding: 10,
                cornerRadius: 4
              }
            },
            scales: {
              y: {
                beginAtZero: true,
                ticks: {
                  precision: 0,
                  font: { size: 11 }
                },
                grid: {
                  color: 'rgba(0, 0, 0, 0.05)'
                }
              },
              x: {
                ticks: {
                  font: { size: 11 },
                  maxRotation: 45,
                  minRotation: 0
                },
                grid: {
                  display: false
                }
              }
            }
          }
        });
      }
    }

    // Notify table.js to update
    if (window.updateTableFilter) {
      window.updateTableFilter(filter);
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    console.log('Charts.js: DOM loaded');
    
    // Get tracker data from the table rows
    const tbody = document.getElementById('tracker-tbody');
    if (!tbody) {
      console.error('Charts.js: tbody not found');
      return;
    }

    // Extract all request records from table
    allRows = Array.from(tbody.querySelectorAll('tr')).map(tr => {
      const cells = tr.querySelectorAll('td');
      const tsElement = cells[1]?.querySelector('.ts');
      const timestamp = tsElement?.getAttribute('data-ts') || cells[1]?.textContent?.trim() || '';
      const ip = cells[2]?.textContent?.trim() || '';
      const count = parseInt(cells[5]?.textContent?.trim()) || 1;
      
      return { timestamp, ip, count };
    });

    console.log('Charts.js: Loaded', allRows.length, 'rows');
    if (allRows.length > 0) {
      console.log('Charts.js: First row timestamp:', allRows[0].timestamp);
      console.log('Charts.js: Last row timestamp:', allRows[allRows.length - 1].timestamp);
    }

    if (allRows.length === 0) return;

    // Initial render with a slight delay to ensure table.js is ready
    setTimeout(() => {
      updateCharts('all');
      updateFilterCounts();

      // Setup filter buttons
      const filterBtns = document.querySelectorAll('.date-filter-btn');
      console.log('Charts.js: Found', filterBtns.length, 'filter buttons');
      
      if (filterBtns.length === 0) {
        console.warn('Date filter buttons not found');
        return;
      }
      
      filterBtns.forEach(btn => {
        btn.addEventListener('click', function(e) {
          try {
            // Update active state
            filterBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            // Get filter value and update charts
            const filter = this.getAttribute('data-filter');
            console.log('Filter clicked:', filter);
            currentFilter = filter;
            updateCharts(filter);
          } catch (err) {
            console.error('Error in filter click handler:', err);
          }
        });
      });
    }, 100);

    // Expose function for table.js to call
    window.getChartDateFilter = function() {
      return currentFilter;
    };
  });
})();
