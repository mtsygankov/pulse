async function renderBPChart(containerId = 'bp-chart', options = {}) {
  const { showPulse = true, meOnly = false, nightShadows = false } = options;
  const res = await fetch('/json', { cache: 'no-store' });
  const entries = await res.json();

  const rows = (Array.isArray(entries) ? entries : [])
    .map(e => {
      const t = new Date(e.t);
      return {
        t,
        iso: e.t,
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

  // Helper: get hour in target timezone (Asia/Shanghai) robustly
  function hourInTZ(date, tz = 'Asia/Shanghai') {
    try {
      const fmt = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: '2-digit', hour12: false });
      return Number(fmt.format(date));
    } catch (e) {
      // Fallback: fixed +8 shift from UTC (Asia/Shanghai has no DST)
      return (date.getUTCHours() + 8) % 24;
    }
  }

  // Compute highlighted timestamps (first morning 07:00-11:59 and first evening >=21:00 per local date)
  function computeHighlightedTimestamps(rows, tz = 'Asia/Shanghai') {
    const grouped = new Map();
    for (const r of rows) {
      // get local date components in TZ
      try {
        const parts = new Intl.DateTimeFormat('en-CA', {
          timeZone: tz,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          hour12: false
        }).formatToParts(r.t);
        const obj = Object.fromEntries(parts.map(p => [p.type, p.value]));
        const dateKey = `${obj.year}-${obj.month}-${obj.day}`;
        const hour = Number(obj.hour);
        if (!grouped.has(dateKey)) grouped.set(dateKey, []);
        grouped.get(dateKey).push({ row: r, hour });
      } catch (e) {
        // fallback: compute using UTC +8
        const d = new Date(r.t.getTime() + 8 * 3600 * 1000);
        const dateKey = d.toISOString().slice(0, 10);
        const hour = d.getUTCHours();
        if (!grouped.has(dateKey)) grouped.set(dateKey, []);
        grouped.get(dateKey).push({ row: r, hour });
      }
    }

    const morning = new Set();
    const evening = new Set();
    // rows are already time-sorted; ensure entries per day are processed in order
    for (const [date, arr] of grouped.entries()) {
      // sort by original timestamp to pick first occurrences
      arr.sort((a, b) => a.row.x - b.row.x);
      for (const item of arr) {
        if (item.hour >= 7 && item.hour < 12) {
          morning.add(item.row.iso);
          break;
        }
      }
      for (const item of arr) {
        if (item.hour >= 21) {
          evening.add(item.row.iso);
          break;
        }
      }
    }
    return { morning, evening };
  }

  // Data:
  // For bar series with a custom renderItem we’ll draw a vertical rect from dia->sys.
  // Compute highlighted timestamps to match python server logic
  const { morning: morningSet, evening: eveningSet } = computeHighlightedTimestamps(rows);

  // Compute night shading ranges (18:00-24:00 and 00:00-06:00 next day) in Asia/Shanghai
  function computeNightShadows(rows, tz = 'Asia/Shanghai') {
    const dates = new Set();
    for (const r of rows) {
      try {
        const parts = new Intl.DateTimeFormat('en-CA', {
          timeZone: tz,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        }).formatToParts(r.t);
        const obj = Object.fromEntries(parts.map(p => [p.type, p.value]));
        const dateKey = `${obj.year}-${obj.month}-${obj.day}`;
        dates.add(dateKey);
      } catch (e) {
        const d = new Date(r.t.getTime() + 8 * 3600 * 1000);
        const dateKey = d.toISOString().slice(0, 10);
        dates.add(dateKey);
      }
    }

    const ranges = [];
    for (const dateKey of Array.from(dates).sort()) {
      try {
        const eveStart = new Date(dateKey + 'T18:00:00+08:00').getTime();
        const eveEnd = new Date(dateKey + 'T23:59:59+08:00').getTime() + 1; // inclusive end
        ranges.push([eveStart, eveEnd]);
        // morning next day: compute next date via Date object
        const nextDay = new Date(dateKey + 'T00:00:00+08:00');
        const nextDayYMD = new Date(nextDay.getTime() + 24 * 3600 * 1000);
        const yyyy = nextDayYMD.getUTCFullYear();
        const mm = String(nextDayYMD.getUTCMonth() + 1).padStart(2, '0');
        const dd = String(nextDayYMD.getUTCDate()).padStart(2, '0');
        const nextKey = `${yyyy}-${mm}-${dd}`;
        const morStart = new Date(nextKey + 'T00:00:00+08:00').getTime();
        const morEnd = new Date(nextKey + 'T06:00:00+08:00').getTime();
        ranges.push([morStart, morEnd]);
      } catch (e) {
        // ignore malformed dateKey
      }
    }
    return ranges;
  }

  // Optionally filter to the server's morning/evening selected measurements (client-side)
  let filteredRows = rows;
  if (meOnly) {
    const filtered = rows.filter(r => morningSet.has(r.iso) || eveningSet.has(r.iso));
    filteredRows = filtered.length ? filtered : rows;
  }

  // Shared y range like python (sys/dia/pulse together) — compute from filtered rows
  const allVals = filteredRows.flatMap(r => [r.sys, r.dia, r.pulse]);
  const overallMin = Math.floor(Math.min(...allVals) - 10);
  const overallMax = Math.ceil(Math.max(...allVals) + 10);

  // Morning/evening coloring similar to python highlight intent
  const colorFor = (r) => {
    if (morningSet.has(r.iso)) return '#ffd52b';
    if (eveningSet.has(r.iso)) return '#989dfc';
    return '#b0b0b0';
  };

  const bpData = filteredRows.map(r => ({
    value: [r.x, r.dia, r.sys],
    itemStyle: { color: colorFor(r), opacity: 0.7 }
  }));

  const nightShadowRanges = nightShadows ? computeNightShadows(rows) : [];

  const pulseData = filteredRows.map(r => [r.x, r.pulse]);

  const el = document.getElementById(containerId);
  if (!el) throw new Error(`Container #${containerId} not found`);

  // If a chart instance already exists, read its dataZoom state to preserve the
  // user's current pan/zoom window when re-rendering due to setting changes.
  const existing = echarts.getInstanceByDom(el);
  let preservedDZ = null;
  if (existing) {
    try {
      const existingDZ = existing.getOption().dataZoom || [];
      if (existingDZ.length) {
        const d0 = existingDZ[0];
        if (d0.startValue !== undefined && d0.endValue !== undefined) {
          preservedDZ = { startValue: d0.startValue, endValue: d0.endValue };
        } else if (d0.start !== undefined && d0.end !== undefined) {
          preservedDZ = { start: d0.start, end: d0.end };
        }
      }
    } catch (e) {
      // ignore
    }
  }

  const chart = existing || echarts.init(el, null, { renderer: 'canvas' });

  // Build dataZoom entries, applying preserved window if available.
  const dataZoomInside = { type: 'inside', xAxisIndex: 0, filterMode: 'none' };
  const dataZoomSlider = { type: 'slider', xAxisIndex: 0, height: 32, bottom: 28, filterMode: 'none' };
  if (preservedDZ) {
    if (preservedDZ.startValue !== undefined) {
      dataZoomInside.startValue = preservedDZ.startValue;
      dataZoomInside.endValue = preservedDZ.endValue;
      dataZoomSlider.startValue = preservedDZ.startValue;
      dataZoomSlider.endValue = preservedDZ.endValue;
    } else if (preservedDZ.start !== undefined) {
      dataZoomInside.start = preservedDZ.start;
      dataZoomInside.end = preservedDZ.end;
      dataZoomSlider.start = preservedDZ.start;
      dataZoomSlider.end = preservedDZ.end;
    }
  } else {
    // Default initial zoom: show last 30 days of available data (user can zoom out)
    try {
      const minX = filteredRows[0].x;
      const maxX = filteredRows[filteredRows.length - 1].x;
      const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
      const startValue = Math.max(minX, maxX - THIRTY_DAYS_MS);
      dataZoomInside.startValue = startValue;
      dataZoomInside.endValue = maxX;
      dataZoomSlider.startValue = startValue;
      dataZoomSlider.endValue = maxX;
    } catch (e) {
      // If something goes wrong (unexpected data), fall back to full range (do nothing)
    }
  }

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
    dataZoom: [dataZoomInside, dataZoomSlider],

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

    // build series dynamically so we can disable pulse rendering
    series: (function() {
      const s = [];

      // Custom floating bars (dia->sys)
      s.push({
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
          const barWidth = 5;

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

        // draw night shading as markArea (if provided)
        markArea: nightShadowRanges && nightShadowRanges.length ? {
          silent: true,
          itemStyle: { color: 'lightgrey', opacity: 0.3 },
          data: nightShadowRanges.map(r => [{ xAxis: r[0] }, { xAxis: r[1] }])
        } : undefined,

        // SYS label on top of bar
        label: {
          show: true,
          position: 'top',
          color: 'green',
          fontSize: 10,
          fontWeight: 'bold',
          formatter: (p) => p.data.value[2] // sys
        }
      });

      // DIA label under bar (second custom series drawing just text)
      s.push({
        name: 'DIA Labels',
        type: 'custom',
        silent: true,
        renderItem: (params, api) => {
          const x = api.value(0);
          const dia = api.value(1);

          const pt = api.coord([x, dia]);
          // clip to plotting area with horizontal margin to avoid axis overlap
          const coord = params.coordSys;
          const xPx = pt[0], yPx = pt[1];
          const H_MARGIN = 6; // px margin from left/right plot edges
          if (
            xPx < coord.x + H_MARGIN ||
            xPx > coord.x + coord.width - H_MARGIN ||
            yPx < coord.y ||
            yPx > coord.y + coord.height
          ) {
            return null;
          }

          return {
            type: 'text',
            x: xPx,
            y: yPx + 10,
            style: {
              text: String(dia),
              fill: 'green',
              font: 'bold 10px sans-serif',
              align: 'center',
              verticalAlign: 'top'
            }
          };
        },
        data: filteredRows.map(r => [r.x, r.dia]),
        encode: { x: 0, y: 1 }
      });

      // Pulse line + badge labels (conditionally added)
      if (showPulse) {
        s.push({
          name: 'Pulse',
          type: 'line',
          data: pulseData,
          showSymbol: true,
          symbolSize: 0,
          lineStyle: { color: 'rgba(255,0,0,0.4)', width: 4 },
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
        });
      }

      return s;
    })()
  };

  chart.setOption(option, true);

  // Resize handling (important in htmx layouts)
  const ro = new ResizeObserver(() => chart.resize());
  ro.observe(el);

  return chart;
}