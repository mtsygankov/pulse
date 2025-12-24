async function renderBPChart(containerId = 'bp-chart') {
  const res = await fetch('/json', { cache: 'no-store' });
  const entries = await res.json();

  const rows = (Array.isArray(entries) ? entries : [])
    .map(e => {
      const t = new Date(e.t);
      return {
        t,
        x: t.getTime(),
        sys: Number(e.sys),
        dia: Number(e.dia),
        pulse: Number(e.pulse)
      };
    })
    .filter(r =>
      Number.isFinite(r.x) &&
      Number.isFinite(r.sys) &&
      Number.isFinite(r.dia) &&
      Number.isFinite(r.pulse)
    )
    .sort((a, b) => a.x - b.x);

  if (!rows.length) throw new Error('No valid records returned from /json');

  // Morning/evening coloring similar to your python highlight intent
  const colorFor = (r) => {
    const h = r.t.getHours();
    if (h < 8) return '#ffd52b';
    if (h >= 18) return '#989dfc';
    return '#b0b0b0';
  };

  // Shared y range like python (sys/dia/pulse together)
  const overallMin = Math.floor(Math.min(...rows.map(r => Math.min(r.sys, r.dia, r.pulse))) - 10);
  const overallMax = Math.ceil(Math.max(...rows.map(r => Math.max(r.sys, r.dia, r.pulse))) + 10);

  // Data:
  // For bar series with a custom renderItem we’ll draw a vertical rect from dia->sys.
  const bpData = rows.map(r => ({
    value: [r.x, r.dia, r.sys],
    itemStyle: { color: colorFor(r), opacity: 0.7 }
  }));

  const pulseData = rows.map(r => [r.x, r.pulse]);

  const el = document.getElementById(containerId);
  if (!el) throw new Error(`Container #${containerId} not found`);

  const chart = echarts.init(el, null, { renderer: 'canvas' });

  const option = {
    animation: false,
    grid: { left: 50, right: 20, top: 20, bottom: 55 },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'line' },
      formatter: (params) => {
        // params is array (bar + line)
        const time = params?.[0]?.axisValue;
        const d = new Date(time);
        const header = `${d.toLocaleString()}`;
        let bp = '';
        let pulse = '';
        for (const p of params) {
          if (p.seriesName === 'Blood Pressure') {
            const dia = p.data.value[1];
            const sys = p.data.value[2];
            bp = `BP: ${sys}/${dia} mmHg`;
          } else if (p.seriesName === 'Pulse') {
            pulse = `Pulse: ${p.data[1]} bpm`;
          }
        }
        return [header, bp, pulse].filter(Boolean).join('<br/>');
      }
    },

    // Pan/zoom + selection window (built-in)
    dataZoom: [
      { type: 'inside', xAxisIndex: 0, filterMode: 'none' },  // wheel + drag pan
      { type: 'slider', xAxisIndex: 0, height: 22, bottom: 18, filterMode: 'none' } // visible window slider
    ],

    xAxis: {
      type: 'time',
      axisLabel: {
        formatter: (val) => {
          const d = new Date(val);
          const month = d.toLocaleString(undefined, { month: 'short' });
          const day = String(d.getDate()).padStart(2, '0');
          const hh = String(d.getHours()).padStart(2, '0');
          const mm = String(d.getMinutes()).padStart(2, '0');
          return `${month} ${day}\n${hh}:${mm}`;
        },
        fontSize: 10
      },
      splitLine: { show: true, lineStyle: { color: 'rgba(0,0,0,0.12)' } }
    },

    yAxis: {
      type: 'value',
      min: overallMin,
      max: overallMax,
      axisLabel: { color: 'green' },
      splitLine: { show: true, lineStyle: { type: 'dashed', color: 'rgba(0,0,0,0.18)' } }
    },

    series: [
      // Custom floating bars (dia->sys)
      {
        name: 'Blood Pressure',
        type: 'custom',
        renderItem: (params, api) => {
          const x = api.value(0);
          const dia = api.value(1);
          const sys = api.value(2);

          const xCoord = api.coord([x, dia])[0];
          const yDia = api.coord([x, dia])[1];
          const ySys = api.coord([x, sys])[1];

          // bar width in px similar to matplotlib "5px feel"
          const barWidth = 6;

          const rectShape = echarts.graphic.clipRectByRect(
            {
              x: xCoord - barWidth / 2,
              y: ySys,
              width: barWidth,
              height: yDia - ySys
            },
            {
              x: params.coordSys.x,
              y: params.coordSys.y,
              width: params.coordSys.width,
              height: params.coordSys.height
            }
          );

          return rectShape && {
            type: 'rect',
            shape: rectShape,
            style: api.style()
          };
        },
        data: bpData,
        encode: { x: 0, y: [1, 2] },

        // SYS label on top of bar
        label: {
          show: true,
          position: 'top',
          color: 'green',
          fontSize: 10,
          fontWeight: 'bold',
          formatter: (p) => p.data.value[2] // sys
        }
      },

      // DIA label under bar (second custom series drawing just text)
      {
        name: 'DIA Labels',
        type: 'custom',
        silent: true,
        renderItem: (params, api) => {
          const x = api.value(0);
          const dia = api.value(1);

          const pt = api.coord([x, dia]);
          return {
            type: 'text',
            x: pt[0],
            y: pt[1] + 10,
            style: {
              text: String(dia),
              fill: 'green',
              font: 'bold 10px sans-serif',
              align: 'center',
              verticalAlign: 'top'
            }
          };
        },
        data: rows.map(r => [r.x, r.dia]),
        encode: { x: 0, y: 1 }
      },

      // Pulse line + badge labels
      {
        name: 'Pulse',
        type: 'line',
        data: pulseData,
        showSymbol: true,
        symbolSize: 0,
        lineStyle: { color: 'rgba(255,0,0,0.4)', width: 2 },
        label: {
          show: true,
          formatter: (p) => String(p.data[1]),
          color: 'red',
          fontWeight: 'bold',
          fontSize: 10,
          backgroundColor: 'rgba(255,255,255,0.88)',
          borderColor: 'red',
          borderWidth: 0,
          borderRadius: 999,
          padding: [2, 6],
          position: 'inside'
        }
      }
    ]
  };

  chart.setOption(option, true);

  // Resize handling (important in htmx layouts)
  const ro = new ResizeObserver(() => chart.resize());
  ro.observe(el);

  return chart;
}