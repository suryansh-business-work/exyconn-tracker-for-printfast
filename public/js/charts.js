(function () {
  'use strict';

  // Wait for DOM and ensure Chart.js is loaded
  if (typeof Chart === 'undefined') {
    console.warn('Chart.js not loaded, skipping chart initialization');
    return;
  }

  document.addEventListener('DOMContentLoaded', function () {
    // Get tracker data from the table rows (already parsed by table.js)
    const tbody = document.getElementById('tracker-tbody');
    if (!tbody) return;

    // Extract all request records from table
    const rows = Array.from(tbody.querySelectorAll('tr')).map(tr => {
      const cells = tr.querySelectorAll('td');
      const tsElement = cells[1]?.querySelector('.ts');
      const timestamp = tsElement?.getAttribute('data-ts') || cells[1]?.textContent?.trim() || '';
      const ip = cells[2]?.textContent?.trim() || '';
      
      return { timestamp, ip };
    });

    if (rows.length === 0) return;

    // Process data: group by day
    const dailyData = {};
    
    rows.forEach(row => {
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

    // Sort dates and prepare chart data
    const sortedDates = Object.keys(dailyData).sort();
    
    const labels = sortedDates.map(dateStr => {
      // Format as "Nov 13" or "MM/DD"
      const [year, month, day] = dateStr.split('-');
      const date = new Date(year, month - 1, day);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });
    
    const hitsData = sortedDates.map(dateKey => dailyData[dateKey].hits);
    const uniqueClientsData = sortedDates.map(dateKey => dailyData[dateKey].uniqueIPs.size);

    // Chart 1: Daily Hits
    const dailyHitsCanvas = document.getElementById('daily-hits-chart');
    if (dailyHitsCanvas) {
      new Chart(dailyHitsCanvas, {
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

    // Chart 2: Daily Unique Clients
    const dailyUniqueCanvas = document.getElementById('daily-unique-chart');
    if (dailyUniqueCanvas) {
      new Chart(dailyUniqueCanvas, {
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
  });
})();
