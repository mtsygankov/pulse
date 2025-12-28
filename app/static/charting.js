async function renderBPChart(containerId = 'bp-chart', options = {}) {
  const { showPulse = true, meOnly = false, nightShadows = false } = options;
  const res = await fetch('/json', { cache: 'no-store' });
  const entries = await res.json();

  // Parse ISO timestamp as *local clock time*, ignoring any timezone offset.
  // This makes charts independent of:
  // - the browser's timezone
  // - the stored offset (+08:00 vs +03:00)
  function parseLocalClockIsoToMs(isoString) {
    const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/.exec(String(isoString));
    if (!m) return NaN;
    const year = Number(m[1]);
    const month0 = Number(m[2]) - 1;
    const day = Number(m[3]);
    const hour = Number(m[4]);
    const minute = Number(m[5]);
    const second = Number(m[6] ?? '0');
    return Date.UTC(year, month0, day, hour, minute, second, 0);
  }

  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  // Format an x-axis ms value back to local-clock date/time (UTC getters avoid browser TZ).
  function formatMsAsLocalClock(ms) {
    const d = new Date(ms);
    const Y = d.getUTCFullYear();
    const M = pad2(d.getUTCMonth() + 1);
    const D = pad2(d.getUTCDate());
    const h = pad2(d.getUTCHours());
    const m = pad2(d.getUTCMinutes());
    return `${Y}-${M}-${D} ${h}:${m}`;
  }

  const rows = (Array.isArray(entries) ? entries : [])
    .map(e => {
      const iso = String(e.t ?? '');
      return {
        iso,
        x: parseLocalClockIsoToMs(iso),
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

  // Helper: extract local hour from ISO timestamp string (e.g., "2025-11-16T22:34:40+08:00")
  function extractLocalHour(isoString) {
    const match = /T(\d{2}):/.exec(isoString);
    return match ? Number(match[1]) : 0;
  }

  // Helper: get noon (12:00) of the date containing ms, offset by dayOffset days
  function getNoonMs(ms, dayOffset = 0) {
    const d = new Date(ms);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + dayOffset, 12, 0, 0, 0);
  }

  // Compute highlighted timestamps (first morning 07:00-11:59 and first evening >=21:00 per local date)
  function computeHighlightedTimestamps(rows) {
    const grouped = new Map();
    for (const r of rows) {
      // Extract date and hour from ISO string (local-clock components)
      const isoDate = r.iso.slice(0, 10); // YYYY-MM-DD
      const hour = extractLocalHour(r.iso);
      if (!grouped.has(isoDate)) grouped.set(isoDate, []);
      grouped.get(isoDate).push({ row: r, hour });
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

  // Compute night shading ranges (18:00-24:00 and 00:00-06:00 next day) using local timestamps
  function computeNightShadows(rows) {
    const dates = new Set();
    for (const r of rows) {
      dates.add(r.iso.slice(0, 10)); // YYYY-MM-DD
    }

    const ranges = [];
    for (const dateKey of Array.from(dates).sort()) {
      // Construct local-clock ranges on the same timeline as x-values (ignore offsets)
      const dayStartMs = parseLocalClockIsoToMs(`${dateKey}T00:00:00`);
      if (!Number.isFinite(dayStartMs)) continue;
      const eveStart = dayStartMs + 18 * 3600 * 1000; // 18:00 local
      const eveEnd = dayStartMs + 24 * 3600 * 1000;   // next day 00:00 local
      ranges.push([eveStart, eveEnd]);
      const morStart = dayStartMs + 24 * 3600 * 1000; // next day 00:00 local
      const morEnd = morStart + 6 * 3600 * 1000;      // next day 06:00 local
      ranges.push([morStart, morEnd]);
    }
    return ranges;
  }

  // Optionally filter to the server's morning/evening selected measurements (client-side)
  let filteredRows = rows;
  if (meOnly) {
    const filtered = rows.filter(r => morningSet.has(r.iso) || eveningSet.has(r.iso));
    filteredRows = filtered.length ? filtered : rows;
  }

  // Compute x-axis noon-aligned boundaries:
  // min = noon of (earliest date - 1 day), max = noon of (latest date + 1 day)
  const dataMinX = filteredRows[0].x;
  const dataMaxX = filteredRows[filteredRows.length - 1].x;
  const axisMin = getNoonMs(dataMinX, -1);
  const axisMax = getNoonMs(dataMaxX, +1);

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
    iso: r.iso,
    itemStyle: { color: colorFor(r), opacity: 0.7 }
  }));

  const nightShadowRanges = nightShadows ? computeNightShadows(rows) : [];

  const pulseData = filteredRows.map(r => ({
    value: [r.x, r.pulse],
    iso: r.iso
  }));

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
  // Constrain slider to noon-aligned boundaries.
  const dataZoomInside = { type: 'inside', xAxisIndex: 0, filterMode: 'none', minValueSpan: 24 * 3600 * 1000 };
  const dataZoomSlider = { type: 'slider', xAxisIndex: 0, height: 32, bottom: 28, filterMode: 'none', minValueSpan: 24 * 3600 * 1000 };
  if (preservedDZ) {
    if (preservedDZ.startValue !== undefined) {
      // Clamp preserved values to current axis bounds
      const clampedStart = Math.max(axisMin, Math.min(axisMax, preservedDZ.startValue));
      const clampedEnd = Math.max(axisMin, Math.min(axisMax, preservedDZ.endValue));
      dataZoomInside.startValue = clampedStart;
      dataZoomInside.endValue = clampedEnd;
      dataZoomSlider.startValue = clampedStart;
      dataZoomSlider.endValue = clampedEnd;
    } else if (preservedDZ.start !== undefined) {
      dataZoomInside.start = preservedDZ.start;
      dataZoomInside.end = preservedDZ.end;
      dataZoomSlider.start = preservedDZ.start;
      dataZoomSlider.end = preservedDZ.end;
    }
  } else {
    // Default initial zoom: show last 30 days of available data, aligned to noon boundaries
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
    // Start at noon of (30 days before latest date - 1 day) or axisMin, whichever is later
    const thirtyDaysAgoNoon = getNoonMs(dataMaxX - THIRTY_DAYS_MS, -1);
    const startValue = Math.max(axisMin, thirtyDaysAgoNoon);
    const endValue = axisMax;
    dataZoomInside.startValue = startValue;
    dataZoomInside.endValue = endValue;
    dataZoomSlider.startValue = startValue;
    dataZoomSlider.endValue = endValue;
  }

  const option = {
    animation: false,
    grid: { left: 50, right: 20, top: 20, bottom: 55 },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'line' },
      formatter: (params) => {
        // params is array (bar + line)
        const first = params?.[0];
        const iso = first?.data?.iso;
        const header = iso ? String(iso).replace('T', ' ').slice(0, 16) : formatMsAsLocalClock(first?.axisValue);
        let bp = '';
        let pulse = '';
        for (const p of params) {
          if (p.seriesName === 'Blood Pressure') {
            const dia = p.data.value[1];
            const sys = p.data.value[2];
            bp = `BP: ${sys} / ${dia} mmHg`;
          } else if (p.seriesName === 'Pulse') {
            const pv = Array.isArray(p.data) ? p.data[1] : p.data?.value?.[1];
            pulse = `Pulse: ${pv} bpm`;
          }
        }
        return [header, bp, pulse].filter(Boolean).join('<br/>');
      }
    },

    // Pan/zoom + selection window (built-in)
    dataZoom: [dataZoomInside, dataZoomSlider],

    xAxis: {
      type: 'time',
      min: axisMin,
      max: axisMax,
      minInterval: 24 * 3600 * 1000, // Hint ECharts to place ticks at daily intervals (noon-aligned due to bounds)
      axisLabel: {
        // Show date labels using simple formatting
        formatter: (val) => {
          const d = new Date(val);
          const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          const month = MONTHS[d.getUTCMonth()];
          const day = String(d.getUTCDate()).padStart(2, '0');
          return `${month} ${day}`;
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
            formatter: (p) => String(p.data?.value?.[1]),
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