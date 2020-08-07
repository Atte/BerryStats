import Highcharts from 'https://cdnjs.cloudflare.com/ajax/libs/highcharts/8.1.0/es-modules/masters/highcharts.src.min.js';

const chart = Highcharts.chart('connected', {
    chart: {
        type: 'line',
        spacingTop: 20,
    },
    title: { text: undefined },
    legend: { enabled: false },
    credits: { enabled: false },
    time: { useUTC: false },
    series: [{
        name: 'Connected users',
        turboThreshold: 1,
    }],
    xAxis: {
        type: 'datetime',
        min: new Date().getTime() - 1000 * 60 * 60 * 24 * 7, // 7 days
        max: new Date().getTime(),
        tickInterval: 1000 * 60 * 60 * 12, // 12 hours
        allowDecimals: false,
        title: { enabled: false },
    },
    yAxis: {
        min: 0,
        softMax: 100,
        tickInterval: 25,
        allowDecimals: false,
        title: { text: 'Connected users' },
        plotLines: [
            {
                dashStyle: /* Rainbow */ 'Dash',
                zIndex: 3,
                label: {
                    style: { color: '#555' },
                    formatter() { return `Least users: ${this.options.value}`; },
                    y: 12,
                },
            },
            {
                dashStyle: /* Rainbow */ 'Dash',
                zIndex: 3,
                label: {
                    style: { color: '#555' },
                    formatter() { return `Most users: ${this.options.value}`; },
                },
            }
        ],
        events: {
            afterSetExtremes(event) {
                this.options.plotLines[0].value = event.dataMin;
                this.options.plotLines[1].value = event.dataMax;
                this.update();
            }
        }
    }
});
chart.showLoading();

async function initChart() {
    const [data, downtimes] = await Promise.all([
        fetch('api.py?action=connected').then(response => response.json()),
        fetch('api.py?action=downtimes').then(response => response.json()),
    ]);

    for (const el of data) {
        el[0] = new Date(el[0]).getTime();
    }
    chart.series[0].setData(data);

    for (const down of downtimes) {
        chart.xAxis[0].addPlotBand({
            from: new Date(down[0]).getTime(),
            to: new Date(down[1]).getTime(),
            label: {
                style: { color: '#555' },
                text: 'data missing',
                y: -6,
            }
        });
    }

    chart.hideLoading();
}
initChart();
