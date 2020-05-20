import Highcharts from 'https://cdnjs.cloudflare.com/ajax/libs/highcharts/8.1.0/es-modules/masters/highcharts.src.min.js';

const chart = Highcharts.chart('connected', {
    chart: { type: 'line' },
    title: { text: undefined },
    legend: { enabled: false },
    credits: { enabled: false },
    time: { useUTC: false },
    series: [{
        name: 'Connected users',
        turboThreshold: 1
    }],
    xAxis: {
        type: 'datetime',
        min: new Date().getTime() - 1000 * 60 * 60 * 24 * 7,
        max: new Date().getTime(),
        title: { enabled: false }
    },
    yAxis: {
        title: { text: 'Connected users' }
    }
});
chart.showLoading();

async function initChart() {
    const response = await fetch('api.py?action=connected');
    const data = await response.json();
    for (const el of data) {
        el[0] = new Date(el[0]).getTime();
    }
    chart.series[0].setData(data);
    chart.hideLoading();
}
initChart();
