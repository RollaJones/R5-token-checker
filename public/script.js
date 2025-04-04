// public/script.js

document.getElementById('searchForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const queryId = document.getElementById('queryId').value.trim();
  if (!queryId) return;

  try {
    // Request snapshot data from the server
    const response = await fetch(`/search/${queryId}`);
    const data = await response.json();
    const snapshot = data.snapshot;

    // Display snapshot data as formatted JSON
    document.getElementById('snapshotData').textContent = JSON.stringify(snapshot, null, 2);

    // Prepare data for the chart using snapshot metrics
    const chartData = {
      labels: ['Metric 1', 'Metric 2'],
      datasets: [{
        label: 'Snapshot Metrics',
        data: [parseFloat(snapshot.metrics.metric1), parseFloat(snapshot.metrics.metric2)],
        backgroundColor: ['rgba(75, 192, 192, 0.6)', 'rgba(153, 102, 255, 0.6)'],
        borderColor: ['rgba(75, 192, 192, 1)', 'rgba(153, 102, 255, 1)'],
        borderWidth: 1,
      }],
    };

    // If a previous chart exists, destroy it
    if (window.myChartInstance) {
      window.myChartInstance.destroy();
    }

    // Create a new Chart.js bar chart
    const ctx = document.getElementById('myChart').getContext('2d');
    window.myChartInstance = new Chart(ctx, {
      type: 'bar',
      data: chartData,
      options: {
        scales: {
          y: { beginAtZero: true }
        }
      }
    });
  } catch (error) {
    console.error('Error fetching or displaying snapshot data:', error);
    alert('An error occurred while fetching snapshot data.');
  }
});
