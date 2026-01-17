# Pulse - Blood Pressure Tracking Application
## Product Requirements Document (PRD)

**Version:** 2.1  
**Last Updated:** January 3, 2026  
**Architecture:** Static Frontend + Supabase Backend

---

## Table of Contents
1. [Overview](#overview)
2. [Part 1: Backend Infrastructure](#part-1-backend-infrastructure)
   - [1. Database Schema](#1-database-schema)
   - [2. Row-Level Security (RLS)](#2-row-level-security-rls)
   - [3. User Authentication](#3-user-authentication)
   - [4. Edge Functions](#4-edge-functions)
   - [5. CORS & Security](#5-cors--security)
3. [Part 2: Frontend & UI Features](#part-2-frontend--ui-features)
   - [1. Settings & Profile](#1-settings--profile)
   - [2. Measurement Entry (Bulk Text)](#2-measurement-entry-bulk-text)
   - [3. Interactive Charting](#3-interactive-charting)
   - [4. Daily Summary Table](#4-daily-summary-table)
   - [5. Edit Interface](#5-edit-interface)
   - [6. Data Portability (JSON Export)](#6-data-portability-json-export)
4. [Validation Rules](#validation-rules)
5. [UI/UX Specifications](#uiux-specifications)
6. [Migration Strategy](#migration-strategy)

---

## Overview

### Purpose
Pulse is a web-based application for tracking and visualizing blood pressure (BP) measurements over time. It enables users to:
- Record systolic (SYS), diastolic (DIA), and pulse readings via bulk text input.
- Store measurements in their local timezone (user-selected).
- Visualize BP trends with interactive charts and night shadows.
- Group measurements into Morning/Evening slots with specific window logic.
- Edit historical data with ID-based persistence.
- Export data as JSON.

### Key Design Principles

1. **User-Centric Timezone Handling**
   - All data stored in the user's selected local timezone.
   - Timezone setting used ONLY when entering new measurements.
   - Timestamps stored as `TEXT` with offset (e.g., "+08:00") to preserve local clock time.
   - Plotting uses stored local times directly without conversion.

2. **Simplicity & Portability**
   - Static frontend (HTML/CSS/JavaScript) hosted on Netlify.
   - No server-side rendering; progressive enhancement with HTMX.
   - Data portability via JSON export.

3. **Data Integrity**
   - Dual-layer validation: Client-side for UX, Edge Function for database integrity.
   - Median aggregation for multiple readings to reduce outlier influence.
   - Automatic backups via Supabase point-in-time recovery.

---

## Part 1: Backend Infrastructure

### 1. Database Schema

**Table: `profiles`**
Stores user-specific settings and preferences.
```sql
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  timezone TEXT DEFAULT 'Asia/Shanghai' CHECK (timezone IN ('Asia/Shanghai', 'Europe/Moscow')),
  show_pulse BOOLEAN DEFAULT true,
  filter_me_only BOOLEAN DEFAULT false,
  night_shadows BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Table: `measurements`**
Stores blood pressure data. Timestamps are stored as `TEXT` to preserve local clock time.
```sql
CREATE TABLE measurements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  
  -- Timezone metadata (for tracking, not calculations)
  local_tz TEXT NOT NULL,  -- e.g., "Asia/Shanghai", "Europe/Moscow"
  
  -- Local timestamp as TEXT (NOT timestamptz)
  -- Example: "2025-11-16T22:34:40+08:00"
  t TEXT NOT NULL,
  
  -- Measurements
  sys INTEGER NOT NULL CHECK (sys >= 70 AND sys <= 250),
  dia INTEGER NOT NULL CHECK (dia >= 40 AND dia <= 150 AND dia < sys),
  pulse INTEGER NOT NULL CHECK (pulse >= 30 AND pulse <= 220),
  
  -- Original input (for reference)
  raw TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_measurements_user_id ON measurements(user_id);
CREATE INDEX idx_measurements_t ON measurements(t);
CREATE INDEX idx_measurements_user_t ON measurements(user_id, t);
```

### 2. Row-Level Security (RLS)

**Enable RLS:**
```sql
ALTER TABLE measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
```

**Policies:**
- **Profiles**: `auth.uid() = id` for `SELECT` and `UPDATE`.
- **Measurements**: `auth.uid() = user_id` for `SELECT`, `INSERT`, `UPDATE`, and `DELETE`.

### 3. User Authentication

**Provider:** Supabase Auth (Email/Password).

**Auto-Profile Trigger:**
```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, timezone)
  VALUES (NEW.id, 'Asia/Shanghai');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

### 4. Edge Functions

#### 4.1 `add-measurement`
- **Input**: `{ local_tz: string, line: string }`
- **Logic**:
  1. Parse `line` (triples of SYS DIA PULSE).
  2. Validate each triple against ranges.
  3. Compute medians for SYS, DIA, and PULSE.
  4. Generate local timestamp `t` using `local_tz`.
  5. Insert into `measurements` table.

#### 4.2 `save-edits`
- **Input**: `{ entries: Array<{ id: UUID, t: string, local_tz: string, sys: number, dia: number, pulse: number, raw: string }> }`
- **Logic**:
  1. Validate each entry.
  2. Perform ID-based `upsert` or `update` on the `measurements` table.
  3. Ensure `user_id` matches the authenticated user.

### 5. CORS & Security

**Headers for Edge Functions:**
```typescript
export const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://your-app-name.netlify.app',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};
```
- Handle `OPTIONS` preflight requests by returning `200 OK` with these headers.

---

## Part 2: Frontend & UI Features

### 1. Settings & Profile

**Storage:** `localStorage` (for UI) + Supabase `profiles` (for persistence).

**Behavior:**
- Load from Supabase on login; sync `localStorage` to Supabase on change.
- Settings include: `filter_me_only`, `night_shadows`, `showPulse`, `local_tz`.

### 2. Measurement Entry (Bulk Text)

**User Story:** As a user, I want to quickly enter multiple readings by typing them in a single line.

**Format:** Space-separated triples (e.g., `120 80 60 125 85 62`).

**Validation:**
- **Client-side**: Check if count is multiple of 3; basic range checks.
- **Server-side**: Final parsing and median aggregation in `add-measurement` Edge Function.

### 3. Interactive Charting

**Implementation:** ECharts 5.x.

**Key Features:**
- **Local Timeline**: Plot measurements using the clock time in `t`, ignoring offsets.
- **Night Shadows**: Grey overlays for 18:00–06:00 local time.
- **Morning/Evening Highlighting**:
  - **Morning**: First measurement in 07:00–15:00 window (Yellow).
  - **Evening**: Last measurement in 19:00–03:00 (next day) window (Purple).

### 4. Daily Summary Table

**Grouping Logic:**
- **Morning Slot**: First measurement in **07:00–15:00** window.
- **Evening Slot**: Last measurement in **19:00–03:00 (next day)** window.
- **Date Attribution**: Measurements taken between **00:00 and 03:00** are attributed to the **previous calendar day**.

### 5. Edit Interface

**User Story:** As a user, I want to correct my recent measurements.

**Features:**
- Edit the **last 10 entries**.
- ID-based persistence via `save-edits` Edge Function.
- Live chart preview of changes.

### 6. Data Portability (JSON Export)

**User Story:** As a user, I want to download all my data for backup.

**Implementation:** Client-side fetch of all measurements + Blob download as `pulse-data-YYYY-MM-DD.json`.

---

## Validation Rules

### Input Ranges

| Field | Minimum | Maximum | Notes |
|-------|---------|---------|-------|
| SYS | 70 | 250 | mmHg |
| DIA | 40 | 150 | mmHg, must be < SYS |
| PULSE | 30 | 220 | bpm |

### Cross-Field Validation
- `DIA < SYS` (diastolic must be less than systolic).

### Timestamp Validation
- Must match ISO 8601 format with timezone offset.
- Regex: `/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/`

### Bulk Input Validation
- Must be whitespace-separated integers.
- Count must be multiple of 3.
- Each triple validated individually before aggregation.
- Aggregated values re-validated after median computation.

---

## UI/UX Specifications

### Design System
- **Framework**: Tailwind CSS (CDN).
- **Color Palette**:
  - Primary: Blue (#3B82F6)
  - Success: Green (#10B981)
  - Morning: Yellow (#FFD52B)
  - Evening: Purple (#989DFC)
  - Error: Red (#EF4444)
- **Typography**: System sans-serif; Monospace for data values.

### Layout

#### Main Page (Dashboard)
The main page is a single-page dashboard designed for quick data entry and review. It follows a vertical stack layout:
1. **Header**: App title, user profile/logout, and a hamburger menu for Settings.
2. **Settings Panel (Collapsible)**: Toggled via the hamburger menu. Contains timezone selection and chart display toggles.
3. **Measurement Entry Form**: A prominent bulk text input field at the top for quick entry.
4. **Interactive Chart**: The central visualization component, taking up significant vertical space.
5. **Daily Summary Table**: A grouped view of morning and evening measurements for the current month.
6. **Footer**: Links to the Edit Page and JSON Export.

#### Edit Page
A dedicated view for data correction:
1. **Back Button**: Returns to the Main Page.
2. **Chart Preview**: A smaller, non-interactive version of the chart showing the last 30 days.
3. **Editable Table**: A list of the last 10 measurements with inline editing for all fields (SYS, DIA, Pulse, Timestamp, TZ, Raw).
4. **Action Buttons**: "Add Entry" and "Save Changes".

**Responsive Design**: Mobile-first, single column on small screens. Max width of 1024px on desktop.

### Interactive States
- **Loading**: Disable buttons during HTMX/Supabase requests.
- **Error**: Toast notifications or inline alerts for validation failures.

---

## Migration Strategy

### Phase 1: Database Setup
1. Create Supabase project.
2. Run SQL scripts for `profiles` and `measurements`.
3. Enable RLS and create policies.
4. Set up the `handle_new_user` trigger.

### Phase 2: Auth & Settings
1. Implement Login/Signup pages.
2. Connect `localStorage` settings to Supabase `profiles`.

### Phase 3: Core Features
1. Implement Bulk Entry form with client-side validation.
2. Deploy `add-measurement` Edge Function.
3. Build ECharts visualization with local timeline logic.
4. Implement Daily Summary Table with window-based grouping.

### Phase 4: Data Management
1. Build Edit Page with ID-based updates.
2. Deploy `save-edits` Edge Function.
3. Implement JSON Export.

### Phase 5: Data Import (Administrative)
1. Existing NDJSON data will be imported into the `measurements` table via a separate script, mapping records to the appropriate `user_id`.

---

## Appendix: Key Design Decisions

### Why TEXT for Timestamps?
PostgreSQL's `TIMESTAMPTZ` normalizes to UTC. To preserve the user's "local clock time" (e.g., 08:00 AM in Shanghai vs 08:00 AM in Moscow) without complex conversions, we store the ISO string as `TEXT`.

### Why Local Timeline Plotting?
Users track their health relative to their daily routine (e.g., "before breakfast"). Plotting on a local timeline ensures that measurements taken at the same "clock time" align visually, even if the user has traveled across timezones.

### Why Median for Aggregation?
Medical best practice suggests taking multiple readings and using the median to reduce the impact of outliers or "white coat syndrome."

### Why 00:00–03:00 Attribution?
Measurements taken shortly after midnight are often clinically part of the "previous day's evening" routine. Attributing them to the previous day ensures the Daily Summary Table reflects the user's actual sleep/wake cycle.

---

## Conclusion
Pulse v2.0 transitions to a modern, scalable architecture while doubling down on data integrity and user-centric time tracking. The combination of a static frontend and Supabase provides a low-maintenance, high-performance solution for personal health monitoring.

// 2. Get current UTC time
const nowUTC = new Date();

// 3. Format as local time in user's timezone (using date-fns-tz)
import { formatInTimeZone } from 'date-fns-tz';
const localTimestamp = formatInTimeZone(
  nowUTC, 
  userTimezone, 
  "yyyy-MM-dd'T'HH:mm:ssxxx"
);
// Result: "2025-11-16T22:34:40+08:00" (for Shanghai)
// Result: "2025-11-16T17:34:40+03:00" (for Moscow, same UTC moment)

// 4. Store this exact string without modification
```

**Key Points:**
- **NOT** using `new Date().toISOString()` (browser TZ dependent)
- **NOT** converting to UTC for storage
- **NOT** using browser's `Intl.DateTimeFormat` timezone
- The `+08:00` offset is metadata only, not used for calculations
- The `local_tz` field stores timezone name for tracking/metadata

**Why This Matters:**
A user traveling from Shanghai to Moscow can:
1. Change timezone setting from Shanghai to Moscow
2. New measurements will be in Moscow local time
3. Old measurements remain in Shanghai local time
4. Chart plots both on their respective local timelines
5. User sees their personal "measurement timeline" not UTC timeline

#### 2.3 Median Aggregation for Multiple Measurements

**Use Case:** User takes 3 BP readings in succession (common medical practice)

**Algorithm:**
```javascript
function computeMedian(values) {
  const sorted = values.slice().sort((a, b) => a - b);
  const n = sorted.length;
  
  if (n % 2 === 0) {
    // Even count: average of middle two
    return Math.round((sorted[n/2 - 1] + sorted[n/2]) / 2);
  } else {
    // Odd count: middle value
    return sorted[Math.floor(n/2)];
  }
}

// Example:
// Input: "120 80 56 125 85 60 118 78 58"
// Parsed: sys=[120,125,118], dia=[80,85,78], pulse=[56,60,58]
// Sorted: sys=[118,120,125], dia=[78,80,85], pulse=[56,58,60]
// Median: sys=120, dia=80, pulse=58
```

**Validation Order:**
1. Validate each individual triple BEFORE aggregation
2. If any triple fails validation, reject entire input
3. Compute medians
4. Validate aggregated values
5. Store aggregated values with raw input preserved

#### 2.4 Form Submission Flow

**Client-Side (HTMX):**
```html
<form hx-post="/api/add-measurement" 
      hx-target="#page" 
      hx-swap="outerHTML">
  <input type="hidden" name="local_tz" id="local_tz_input" />
  <input name="line" type="text" />
  <button type="submit">Save</button>
</form>
```

**JavaScript Pre-Submit:**
```javascript
// Before form submission
document.querySelector('form').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  // 1. Get values
  const line = e.target.line.value.trim();
  const userTz = localStorage.getItem('local_tz') || 'Asia/Shanghai';
  
  // 2. Generate timestamp
  const timestamp = formatInTimeZone(new Date(), userTz, "yyyy-MM-dd'T'HH:mm:ssxxx");
  
  // 3. Parse and validate
  const parts = line.split(/\s+/);
  if (parts.length % 3 !== 0) {
    alert('Input must contain sets of 3 values (SYS DIA PULSE)');
    return;
  }
  
  // 4. Build entry
  const entry = {
    local_tz: userTz,
    t: timestamp,
    line: line
  };
  
  // 5. Call Supabase Edge Function or direct insert
  const { data, error } = await supabase.functions.invoke('add-measurement', {
    body: entry
  });
  
  if (error) {
    alert(error.message);
  } else {
    // Refresh page or update UI
    location.reload();
  }
});
```

**Edge Function (Validation):**
```typescript
// Supabase Edge Function: add-measurement
Deno.serve(async (req) => {
  const { local_tz, t, line } = await req.json();
  
  // Parse input
  const parts = line.trim().split(/\s+/);
  if (parts.length % 3 !== 0) {
    return new Response('Invalid input format', { status: 400 });
  }
  
  const numSets = parts.length / 3;
  const sysList = [], diaList = [], pulseList = [];
  
  for (let i = 0; i < numSets; i++) {
    const sys = parseInt(parts[i * 3]);
    const dia = parseInt(parts[i * 3 + 1]);
    const pulse = parseInt(parts[i * 3 + 2]);
    
    // Validate each
    if (sys < 70 || sys > 250) return new Response('SYS out of range', { status: 400 });
    if (dia < 40 || dia > 150) return new Response('DIA out of range', { status: 400 });
    if (pulse < 30 || pulse > 220) return new Response('Pulse out of range', { status: 400 });
    if (dia >= sys) return new Response('DIA must be less than SYS', { status: 400 });
    
    sysList.push(sys);
    diaList.push(dia);
    pulseList.push(pulse);
  }
  
  // Compute medians
  const sysVal = computeMedian(sysList);
  const diaVal = computeMedian(diaList);
  const pulseVal = computeMedian(pulseList);
  
  // Final validation
  if (diaVal >= sysVal) return new Response('Aggregated DIA >= SYS', { status: 400 });
  
  // Insert into Supabase
  const supabase = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_KEY'));
  const user = await supabase.auth.getUser(req.headers.get('Authorization'));
  
  const { error } = await supabase.from('measurements').insert({
    user_id: user.data.user.id,
    local_tz: local_tz,
    t: t,
    sys: sysVal,
    dia: diaVal,
    pulse: pulseVal,
    raw: line
  });
  
  if (error) return new Response(error.message, { status: 500 });
  
  return new Response('Saved', { status: 200 });
});
```

---

### 3. Chart Plotting

#### 3.1 renderBPChart() Function

**Purpose:** Client-side interactive BP/pulse chart using ECharts

**Location:** `/static/charting.js`

**Signature:**
```javascript
async function renderBPChart(containerId = 'bp-chart', options = {})
```

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `containerId` | string | `'bp-chart'` | DOM element ID for chart container |
| `options.showPulse` | boolean | `true` | Display pulse line and labels |
| `options.meOnly` | boolean | `false` | Filter to morning/evening only |
| `options.nightShadows` | boolean | `false` | Show 18:00-06:00 shading |
| `options.initialZoomDays` | number | `30` | Default zoom window (null = preserve existing zoom) |

**Return Value:** ECharts instance (or existing instance if already rendered)

#### 3.2 Data Fetching

**Source:** Supabase query (replaces `/json` endpoint)

```javascript
// In renderBPChart():
const { data: entries, error } = await supabase
  .from('measurements')
  .select('*')
  .eq('user_id', user.id)
  .order('t', { ascending: true });

if (error) throw new Error(error.message);
```

**Expected Data Format:**
```javascript
[
  {
    "id": "uuid-1",
    "user_id": "uuid-user",
    "local_tz": "Asia/Shanghai",
    "t": "2025-11-16T22:34:40+08:00",
    "sys": 120,
    "dia": 80,
    "pulse": 58,
    "raw": "120 80 56 125 85 60"
  },
  // ... more entries
]
```

#### 3.3 Timestamp Parsing (Critical)

**Philosophy:** Parse as local clock time, ignore timezone offset

**Function:**
```javascript
function parseLocalClockIsoToMs(isoString) {
  // Extract YYYY-MM-DD HH:MM:SS from ISO string (ignore offset)
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/.exec(String(isoString));
  if (!m) return NaN;
  
  const year = Number(m[1]);
  const month0 = Number(m[2]) - 1;  // 0-indexed
  const day = Number(m[3]);
  const hour = Number(m[4]);
  const minute = Number(m[5]);
  const second = Number(m[6] ?? '0');
  
  // Use Date.UTC to avoid browser timezone interference
  return Date.UTC(year, month0, day, hour, minute, second, 0);
}

// Example:
// Input: "2025-11-16T22:34:40+08:00" (Shanghai)
// Output: 1731788080000 (ms since epoch for 2025-11-16 22:34:40 UTC)
// Input: "2025-11-16T17:34:40+03:00" (Moscow, same moment)
// Output: 1731770080000 (different ms, because local clock shows different time)

// Key: We treat the local time as if it were UTC for plotting purposes
//      This creates a "user timeline" independent of actual UTC
```

**Why This Works:**
- Measurements at "22:34 Shanghai time" always plot at x-position for 22:34
- Measurements at "17:34 Moscow time" plot at x-position for 17:34
- User sees their personal measurement timeline
- No timezone conversions pollute the data

#### 3.4 Morning/Evening Highlighting

**Definition:**
- **Morning:** First measurement between 07:00-11:59 (local hour) per day
- **Evening:** First measurement at/after 21:00 (local hour) per day

**Algorithm:**
```javascript
function computeHighlightedTimestamps(rows) {
  const grouped = new Map();  // Map<dateString, Array<{row, hour}>>
  
  for (const r of rows) {
    const isoDate = r.iso.slice(0, 10);  // "2025-11-16"
    const hour = extractLocalHour(r.iso);  // Extract hour from "T22:34:40"
    
    if (!grouped.has(isoDate)) grouped.set(isoDate, []);
    grouped.get(isoDate).push({ row: r, hour });
  }
  
  const morning = new Set();
  const evening = new Set();
  
  for (const [date, arr] of grouped.entries()) {
    arr.sort((a, b) => a.row.x - b.row.x);  // Time-order within day
    
    // First morning measurement
    for (const item of arr) {
      if (item.hour >= 7 && item.hour < 12) {
        morning.add(item.row.iso);
        break;
      }
    }
    
    // First evening measurement
    for (const item of arr) {
      if (item.hour >= 21) {
        evening.add(item.row.iso);
        break;
      }
    }
  }
  
  return { morning, evening };
}

function extractLocalHour(isoString) {
  const match = /T(\d{2}):/.exec(isoString);
  return match ? Number(match[1]) : 0;
}
```

**Color Mapping:**
```javascript
function colorFor(row) {
  if (morningSet.has(row.iso)) return '#ffd52b';  // Yellow
  if (eveningSet.has(row.iso)) return '#989dfc';  // Light purple
  return '#b0b0b0';  // Gray (other measurements)
}
```

#### 3.5 Night Shadows

**Purpose:** Visual indicator for night hours (18:00-06:00 local time)

**Ranges per Day:**
- Evening: 18:00-24:00 same day
- Morning: 00:00-06:00 next day

**Computation:**
```javascript
function computeNightShadows(rows) {
  const dates = new Set();
  for (const r of rows) {
    dates.add(r.iso.slice(0, 10));  // Unique dates
  }
  
  const ranges = [];
  for (const dateKey of Array.from(dates).sort()) {
    const dayStartMs = parseLocalClockIsoToMs(`${dateKey}T00:00:00`);
    
    // 18:00-24:00
    const eveStart = dayStartMs + 18 * 3600 * 1000;
    const eveEnd = dayStartMs + 24 * 3600 * 1000;
    ranges.push([eveStart, eveEnd]);
    
    // 00:00-06:00 next day
    const morStart = dayStartMs + 24 * 3600 * 1000;
    const morEnd = morStart + 6 * 3600 * 1000;
    ranges.push([morStart, morEnd]);
  }
  
  return ranges;
}
```

**ECharts Integration:**
```javascript
series: [{
  name: 'Blood Pressure',
  type: 'custom',
  markArea: nightShadows ? {
    silent: true,
    itemStyle: { color: 'lightgrey', opacity: 0.3 },
    data: nightShadowRanges.map(r => [
      { xAxis: r[0] },
      { xAxis: r[1] }
    ])
  } : undefined,
  // ... rest of series config
}]
```

#### 3.6 Chart Configuration

**Grid Layout:**
```javascript
grid: { 
  left: 50,    // Y-axis labels
  right: 20,   // Padding
  top: 20,     // Top padding
  bottom: 55   // X-axis + zoom slider
}
```

**X-Axis (Time):**
```javascript
xAxis: {
  type: 'time',
  min: axisMin,    // Noon of (earliest date - 1 day)
  max: axisMax,    // Noon of (latest date + 1 day)
  minInterval: 24 * 3600 * 1000,  // Daily ticks
  axisLabel: {
    formatter: (val) => {
      const d = new Date(val);
      const month = MONTHS[d.getUTCMonth()];
      const day = String(d.getUTCDate()).padStart(2, '0');
      return `${month} ${day}`;  // "Nov 16"
    },
    fontSize: 10
  },
  splitLine: { show: true, lineStyle: { color: 'rgba(0,0,0,0.12)' } }
}
```

**Y-Axis (mmHg / bpm):**
```javascript
yAxis: {
  type: 'value',
  min: overallMin,  // min(sys, dia, pulse) - 10
  max: overallMax,  // max(sys, dia, pulse) + 10
  axisLabel: { color: 'green' },
  splitLine: { show: true, lineStyle: { type: 'dashed', color: 'rgba(0,0,0,0.18)' } }
}
```

**DataZoom (Pan/Zoom):**
```javascript
dataZoom: [
  {
    type: 'inside',
    xAxisIndex: 0,
    filterMode: 'none',
    minValueSpan: 24 * 3600 * 1000,  // Minimum 1 day visible
    zoomOnMouseWheel: false  // Pan only, use slider for zoom
  },
  {
    type: 'slider',
    xAxisIndex: 0,
    height: 32,
    bottom: 28,
    filterMode: 'none',
    minValueSpan: 24 * 3600 * 1000,
    // Initial zoom: last 30 days
    startValue: getNoonMs(dataMaxX - 30*24*3600*1000, -1),
    endValue: axisMax
  }
]
```

**Zoom Preservation:**
When re-rendering (e.g., settings change), preserve user's current zoom:
```javascript
const existing = echarts.getInstanceByDom(el);
let preservedDZ = null;

if (existing && initialZoomDays === null) {
  const existingDZ = existing.getOption().dataZoom || [];
  if (existingDZ.length) {
    const d0 = existingDZ[0];
    preservedDZ = { 
      startValue: d0.startValue, 
      endValue: d0.endValue 
    };
  }
}

// Apply preserved zoom to new dataZoom config
```

#### 3.7 Series Configuration

**Blood Pressure Bars (Custom Renderer):**
```javascript
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
    
    const barWidth = 5;  // pixels
    
    return {
      type: 'rect',
      shape: {
        x: xCoord - barWidth / 2,
        y: ySys,
        width: barWidth,
        height: yDia - ySys
      },
      style: api.style()  // Uses itemStyle from data
    };
  },
  data: filteredRows.map(r => ({
    value: [r.x, r.dia, r.sys],
    iso: r.iso,
    itemStyle: { color: colorFor(r), opacity: 0.7 }
  })),
  // SYS label on top
  label: {
    show: true,
    position: 'top',
    color: 'green',
    fontSize: 10,
    fontWeight: 'bold',
    formatter: (p) => p.data.value[2]  // sys value
  }
}
```

**DIA Labels (Custom Text Renderer):**
```javascript
{
  name: 'DIA Labels',
  type: 'custom',
  silent: true,
  renderItem: (params, api) => {
    const x = api.value(0);
    const dia = api.value(1);
    const pt = api.coord([x, dia]);
    
    // Clip to plot area with margin
    const coord = params.coordSys;
    const xPx = pt[0], yPx = pt[1];
    const H_MARGIN = 6;
    
    if (xPx < coord.x + H_MARGIN || xPx > coord.x + coord.width - H_MARGIN ||
        yPx < coord.y || yPx > coord.y + coord.height) {
      return null;
    }
    
    return {
      type: 'text',
      x: xPx,
      y: yPx + 10,  // Below bar
      style: {
        text: String(dia),
        fill: 'green',
        font: 'bold 10px sans-serif',
        align: 'center',
        verticalAlign: 'top'
      }
    };
  },
  data: filteredRows.map(r => [r.x, r.dia])
}
```

**Pulse Line (Conditional):**
```javascript
if (showPulse) {
  series.push({
    name: 'Pulse',
    type: 'line',
    data: filteredRows.map(r => ({ value: [r.x, r.pulse], iso: r.iso })),
    showSymbol: true,
    symbolSize: 0,
    lineStyle: { color: 'rgba(255,0,0,0.4)', width: 4 },
    label: {
      show: true,
      formatter: (p) => String(p.data.value[1]),
      color: 'red',
      fontWeight: 'bold',
      fontSize: 10,
      backgroundColor: 'rgba(255,255,255,0.88)',
      borderColor: 'red',
      borderWidth: 0,
      borderRadius: 999,  // Circular badge
      padding: [2, 6],
      position: 'inside'
    }
  });
}
```

#### 3.8 Tooltip

```javascript
tooltip: {
  trigger: 'axis',
  axisPointer: { type: 'line' },
  formatter: (params) => {
    const first = params?.[0];
    const iso = first?.data?.iso;
    const header = iso 
      ? iso.replace('T', ' ').slice(0, 16)  // "2025-11-16 22:34"
      : formatMsAsLocalClock(first?.axisValue);
    
    let bp = '', pulse = '';
    for (const p of params) {
      if (p.seriesName === 'Blood Pressure') {
        const dia = p.data.value[1];
        const sys = p.data.value[2];
        bp = `BP: ${sys} / ${dia} mmHg`;
      } else if (p.seriesName === 'Pulse') {
        const pv = p.data?.value?.[1];
        pulse = `Pulse: ${pv} bpm`;
      }
    }
    return [header, bp, pulse].filter(Boolean).join('<br/>');
  }
}
```

#### 3.9 Resize Handling

```javascript
// After chart creation
const ro = new ResizeObserver(() => chart.resize());
ro.observe(el);
```

#### 3.10 Usage Examples

**Main Page (index.html):**
```javascript
// Load with persisted settings
const showPulse = JSON.parse(localStorage.getItem('showPulse') ?? 'true');
const meOnly = JSON.parse(localStorage.getItem('filter_me_only') ?? 'false');
const nightShadows = JSON.parse(localStorage.getItem('night_shadows') ?? 'false');

renderBPChart('bp-chart', { showPulse, meOnly, nightShadows });
```

**Edit Page (edit.html):**
```javascript
// Always show all data, fixed 30-day zoom
renderBPChart('bp-chart', { 
  showPulse: true, 
  meOnly: false, 
  nightShadows: false, 
  initialZoomDays: 30 
});
```

**Settings Change:**
```javascript
document.querySelector('input[name="show_pulse"]').addEventListener('change', (e) => {
  localStorage.setItem('showPulse', JSON.stringify(e.target.checked));
  
  const showPulse = e.target.checked;
  const meOnly = JSON.parse(localStorage.getItem('filter_me_only') ?? 'false');
  const nightShadows = JSON.parse(localStorage.getItem('night_shadows') ?? 'false');
  
  renderBPChart('bp-chart', { showPulse, meOnly, nightShadows });
});
```

---

### 4. Edit Page

#### 4.1 Purpose
Allow users to modify the last 10 measurements for corrections

#### 4.2 UI Layout

```
┌─────────────────────────────────────────────────┐
│ ← Back                     Edit Blood Pressure  │
├─────────────────────────────────────────────────┤
│                                                  │
│          [Interactive Chart Preview]            │
│                                                  │
├─────────────────────────────────────────────────┤
│ Editing last 10 of 234 total records            │
├─────────────────────────────────────────────────┤
│ Timestamp       │ TZ       │ SYS │ DIA │ Pulse │ Raw │
│ [editable]      │ [edit]   │ [#] │ [#] │  [#]  │ ... │
│ ...             │          │     │     │       │     │
├─────────────────────────────────────────────────┤
│        [Add Entry]    [Save Changes]            │
└─────────────────────────────────────────────────┘
```

#### 4.3 Data Loading

**Query:**
```javascript
const { data: allEntries, error } = await supabase
  .from('measurements')
  .select('*')
  .eq('user_id', user.id)
  .order('t', { ascending: true });

const entries = allEntries.slice(-10);  // Last 10
const totalCount = allEntries.length;
```

#### 4.4 Editable Fields

**Table Columns:**

| Column | Type | Editable | Validation |
|--------|------|----------|------------|
| Timestamp | text | Yes | ISO format with offset |
| Timezone | text | Yes | Must be valid IANA name |
| SYS | number | Yes | 70-250 |
| DIA | number | Yes | 40-150 |
| Pulse | number | Yes | 30-220 |
| Raw | text | Yes | Free text |

**HTML Input Fields:**
```html
<input name="t" type="text" value="2025-11-16T22:34:40+08:00" 
       placeholder="YYYY-MM-DDTHH:MM:SS+HH:MM" required />

<input name="local_tz" type="text" value="Asia/Shanghai" required />

<input name="sys" type="number" min="70" max="250" value="120" required />

<input name="dia" type="number" min="40" max="150" value="80" required />

<input name="pulse" type="number" min="30" max="220" value="58" required />

<input name="raw" type="text" value="120 80 56 125 85 60" required />
```

#### 4.5 Add Entry Feature

**Button:** "Add Entry" button above table

**Action:**
```javascript
function addRow() {
  const tbody = document.querySelector('tbody');
  const newRow = document.createElement('tr');
  
  newRow.innerHTML = `
    <td><input name="t" type="text" placeholder="YYYY-MM-DDTHH:MM:SS+HH:MM" required /></td>
    <td><input name="local_tz" type="text" value="Asia/Shanghai" required /></td>
    <td><input name="sys" type="number" min="70" max="250" required /></td>
    <td><input name="dia" type="number" min="40" max="150" required /></td>
    <td><input name="pulse" type="number" min="30" max="220" required /></td>
    <td><input name="raw" type="text" required /></td>
  `;
  
  tbody.appendChild(newRow);
}
```

**User Flow:**
1. Click "Add Entry"
2. New blank row appears at bottom of table
3. Fill in all fields (timestamp can be copied/modified from existing)
4. Submit form to save

#### 4.6 Save Logic

**Client-Side Validation:**
```javascript
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const formData = new FormData(e.target);
  const entries = [];
  
  // Group fields by index
  const timestamps = formData.getAll('t');
  const timezones = formData.getAll('local_tz');
  const sysValues = formData.getAll('sys');
  const diaValues = formData.getAll('dia');
  const pulseValues = formData.getAll('pulse');
  const rawValues = formData.getAll('raw');
  
  // Validate counts match
  if (new Set([timestamps.length, timezones.length, sysValues.length, 
               diaValues.length, pulseValues.length, rawValues.length]).size > 1) {
    alert('Mismatched field counts');
    return;
  }
  
  // Validate each entry
  for (let i = 0; i < timestamps.length; i++) {
    const sys = parseInt(sysValues[i]);
    const dia = parseInt(diaValues[i]);
    const pulse = parseInt(pulseValues[i]);
    
    // Range checks
    if (sys < 70 || sys > 250) {
      alert(`Entry ${i+1}: SYS out of range`);
      return;
    }
    if (dia < 40 || dia > 150) {
      alert(`Entry ${i+1}: DIA out of range`);
      return;
    }
    if (pulse < 30 || pulse > 220) {
      alert(`Entry ${i+1}: Pulse out of range`);
      return;
    }
    if (dia >= sys) {
      alert(`Entry ${i+1}: DIA must be less than SYS`);
      return;
    }
    
    // Validate timestamp format
    try {
      const dt = new Date(timestamps[i]);
      if (isNaN(dt.getTime())) throw new Error('Invalid date');
    } catch {
      alert(`Entry ${i+1}: Invalid timestamp format`);
      return;
    }
    
    entries.push({
      t: timestamps[i],
      local_tz: timezones[i],
      sys, dia, pulse,
      raw: rawValues[i]
    });
  }
  
  // Call Edge Function to save
  const { error } = await supabase.functions.invoke('save-edits', {
    body: { entries }
  });
  
  if (error) {
    alert(error.message);
  } else {
    alert('Saved successfully');
    location.reload();
  }
});
```

**Edge Function (save-edits):**
```typescript
Deno.serve(async (req) => {
  const { entries } = await req.json();
  const supabase = createClient(/* ... */);
  const user = await supabase.auth.getUser(req.headers.get('Authorization'));
  
  // Get all user's measurements
  const { data: allMeasurements } = await supabase
    .from('measurements')
    .select('*')
    .eq('user_id', user.data.user.id)
    .order('t', { ascending: true });
  
  // Delete last 10
  const toDelete = allMeasurements.slice(-10).map(m => m.id);
  await supabase.from('measurements').delete().in('id', toDelete);
  
  // Insert edited entries
  const toInsert = entries.map(e => ({
    user_id: user.data.user.id,
    ...e
  }));
  
  const { error } = await supabase.from('measurements').insert(toInsert);
  
  if (error) return new Response(error.message, { status: 500 });
  return new Response('OK', { status: 200 });
});
```

**Note:** Supabase automatically creates backups via point-in-time recovery, so no manual backup files needed (unlike NDJSON approach)

#### 4.7 Chart Preview

**Purpose:** Show visual feedback of data being edited

**Configuration:**
```javascript
// Fixed settings for edit page
renderBPChart('bp-chart', { 
  showPulse: true, 
  meOnly: false, 
  nightShadows: false, 
  initialZoomDays: 30 
});
```

**Re-render on Save:**
```javascript
document.addEventListener('htmx:afterSwap', function(event) {
  if (event.detail.target.id === 'page') {
    const chartElement = document.getElementById('bp-chart');
    if (chartElement) {
      // Dispose old instance
      const existingChart = echarts.getInstanceByDom(chartElement);
      if (existingChart) existingChart.dispose();
      
      // Re-render
      renderBPChart('bp-chart', { 
        showPulse: true, 
        meOnly: false, 
        nightShadows: false, 
        initialZoomDays: 30 
      });
    }
  }
});
```

---

### 5. User Authentication

#### 5.1 Authentication Strategy

**Provider:** Supabase Auth

**Methods Supported:**
- Email/Password (primary)
- Magic Link (optional future)
- OAuth providers (optional future: Google, GitHub)

#### 5.2 User Flows

**Registration:**
1. User visits login page
2. Clicks "Sign Up"
3. Enters email and password
4. Supabase sends verification email (optional, can be disabled)
5. User confirms email
6. Redirected to main app
7. Profile created automatically via database trigger

**Login:**
1. User visits login page
2. Enters email and password
3. Supabase validates credentials
4. JWT token stored in `localStorage` by Supabase client
5. Redirected to main app

**Logout:**
1. User clicks logout button
2. Supabase clears session
3. JWT removed from `localStorage`
4. Redirected to login page

**Session Management:**
- JWT automatically refreshed by Supabase client
- Expires after inactivity (configurable, default 1 hour)
- Auto-logout on expiration

#### 5.3 Login Page UI

**Location:** `/login.html` (static file)

**Layout:**
```html
<div class="max-w-md mx-auto mt-20">
  <h1>Pulse - Blood Pressure Tracker</h1>
  
  <form id="login-form">
    <input type="email" name="email" placeholder="Email" required />
    <input type="password" name="password" placeholder="Password" required />
    <button type="submit">Log In</button>
  </form>
  
  <p>Don't have an account? <a href="/signup.html">Sign Up</a></p>
</div>
```

**JavaScript:**
```javascript
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const email = e.target.email.value;
  const password = e.target.password.value;
  
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });
  
  if (error) {
    alert(error.message);
  } else {
    // Redirect to main app
    window.location.href = '/';
  }
});
```

#### 5.4 Signup Page UI

**Location:** `/signup.html` (static file)

**Layout:**
```html
<div class="max-w-md mx-auto mt-20">
  <h1>Create Account</h1>
  
  <form id="signup-form">
    <input type="email" name="email" placeholder="Email" required />
    <input type="password" name="password" placeholder="Password" minlength="6" required />
    <button type="submit">Sign Up</button>
  </form>
  
  <p>Already have an account? <a href="/login.html">Log In</a></p>
</div>
```

**JavaScript:**
```javascript
document.getElementById('signup-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const email = e.target.email.value;
  const password = e.target.password.value;
  
  const { data, error } = await supabase.auth.signUp({
    email,
    password
  });
  
  if (error) {
    alert(error.message);
  } else {
    alert('Check your email for verification link');
    window.location.href = '/login.html';
  }
});
```

#### 5.5 Auth State Management

**Global Auth Check (every page):**
```javascript
// In base HTML or main.js
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkAuth() {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    // Not logged in, redirect to login
    window.location.href = '/login.html';
  }
  
  return user;
}

// On page load
const currentUser = await checkAuth();
```

**Logout Button:**
```html
<button id="logout-btn">Logout</button>

<script>
document.getElementById('logout-btn').addEventListener('click', async () => {
  await supabase.auth.signOut();
  window.location.href = '/login.html';
});
</script>
```

#### 5.6 Profile Creation Trigger

**Purpose:** Auto-create profile row on user signup

**Supabase SQL Function:**
```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, timezone)
  VALUES (NEW.id, 'Asia/Shanghai');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

#### 5.7 Protected Routes

**Supabase RLS Policies:**
All data queries automatically filtered by `user_id` via RLS (see Data Storage section)

**Client-Side Protection:**
- All pages (except login/signup) call `checkAuth()` on load
- Supabase client automatically includes JWT in API calls
- Edge Functions validate JWT and extract `user_id`

---

### 6. Data Storage

#### 6.1 Database Schema

**Table: `measurements`**

```sql
CREATE TABLE measurements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  
  -- Timezone metadata (for tracking, not calculations)
  local_tz TEXT NOT NULL,  -- e.g., "Asia/Shanghai", "Europe/Moscow"
  
  -- Local timestamp as TEXT (NOT timestamptz)
  -- Example: "2025-11-16T22:34:40+08:00"
  -- The offset (+08:00) is metadata only, not used for calculations
  t TEXT NOT NULL,
  
  -- Measurements
  sys INTEGER NOT NULL CHECK (sys >= 70 AND sys <= 250),
  dia INTEGER NOT NULL CHECK (dia >= 40 AND dia <= 150 AND dia < sys),
  pulse INTEGER NOT NULL CHECK (pulse >= 30 AND pulse <= 220),
  
  -- Original input (for reference)
  raw TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_measurements_user_id ON measurements(user_id);
CREATE INDEX idx_measurements_t ON measurements(t);  -- For sorting
CREATE INDEX idx_measurements_user_t ON measurements(user_id, t);  -- Composite
```

**Table: `profiles`**

```sql
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  
  -- User preferences
  timezone TEXT DEFAULT 'Asia/Shanghai' CHECK (timezone IN ('Asia/Shanghai', 'Europe/Moscow')),
  show_pulse BOOLEAN DEFAULT true,
  filter_me_only BOOLEAN DEFAULT false,
  night_shadows BOOLEAN DEFAULT false,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 6.2 Row-Level Security (RLS)

**Enable RLS:**
```sql
ALTER TABLE measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
```

**Policies for `measurements`:**

```sql
-- Users can only see their own measurements
CREATE POLICY "Users can view own measurements"
  ON measurements FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own measurements
CREATE POLICY "Users can insert own measurements"
  ON measurements FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own measurements
CREATE POLICY "Users can update own measurements"
  ON measurements FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own measurements
CREATE POLICY "Users can delete own measurements"
  ON measurements FOR DELETE
  USING (auth.uid() = user_id);
```

**Policies for `profiles`:**

```sql
-- Users can view their own profile
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
```

#### 6.3 Supabase Client Queries

**Fetch User Measurements:**
```javascript
const { data: measurements, error } = await supabase
  .from('measurements')
  .select('*')
  .order('t', { ascending: true });

// RLS automatically filters to current user
// Equivalent to: .eq('user_id', currentUser.id)
```

**Insert Measurement:**
```javascript
const { data, error } = await supabase
  .from('measurements')
  .insert({
    local_tz: 'Asia/Shanghai',
    t: '2025-11-16T22:34:40+08:00',
    sys: 120,
    dia: 80,
    pulse: 58,
    raw: '120 80 56 125 85 60'
  });

// user_id automatically set by RLS policy
```

**Update Profile Settings:**
```javascript
const { data, error } = await supabase
  .from('profiles')
  .update({
    timezone: 'Europe/Moscow',
    show_pulse: false
  })
  .eq('id', user.id);
```

**Delete Measurements (for edit page):**
```javascript
// Delete last 10 measurements
const { data: allMeasurements } = await supabase
  .from('measurements')
  .select('id')
  .order('t', { ascending: true });

const lastTenIds = allMeasurements.slice(-10).map(m => m.id);

const { error } = await supabase
  .from('measurements')
  .delete()
  .in('id', lastTenIds);
```

#### 6.4 Edge Functions for Complex Operations

**Function: `add-measurement`**

**Purpose:** Validate and insert new measurement

**Endpoint:** `https://<project-ref>.supabase.co/functions/v1/add-measurement`

**Input:**
```json
{
  "local_tz": "Asia/Shanghai",
  "line": "120 80 56 125 85 60"
}
```

**Logic:**
1. Extract JWT from Authorization header
2. Validate user session
3. Parse `line` input (split by whitespace)
4. Validate each triple
5. Compute medians
6. Generate timestamp in `local_tz`
7. Insert into `measurements` table
8. Return success/error

**Code:**
```typescript
import { createClient } from '@supabase/supabase-js';

Deno.serve(async (req) => {
  // CORS headers
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL'),
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  );
  
  // Validate JWT
  const authHeader = req.headers.get('Authorization');
  const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
  
  if (authError || !user) {
    return new Response('Unauthorized', { status: 401 });
  }
  
  const { local_tz, line } = await req.json();
  
  // Parse input
  const parts = line.trim().split(/\s+/);
  if (parts.length % 3 !== 0) {
    return new Response('Invalid format', { status: 400 });
  }
  
  // Validate and compute medians (see section 2.3)
  // ...
  
  // Generate timestamp
  const now = new Date();
  const timestamp = formatInTimeZone(now, local_tz, "yyyy-MM-dd'T'HH:mm:ssxxx");
  
  // Insert
  const { error } = await supabase.from('measurements').insert({
    user_id: user.id,
    local_tz,
    t: timestamp,
    sys: sysVal,
    dia: diaVal,
    pulse: pulseVal,
    raw: line
  });
  
  if (error) {
    return new Response(error.message, { status: 500 });
  }
  
  return new Response('Saved', { status: 200 });
});
```

#### 6.5 JSON Export Feature

**Purpose:** Download all user data as JSON file

**UI:**
```html
<button id="download-json">Download Data (JSON)</button>
```

**Implementation:**
```javascript
document.getElementById('download-json').addEventListener('click', async () => {
  // Fetch all user measurements
  const { data: measurements, error } = await supabase
    .from('measurements')
    .select('*')
    .order('t', { ascending: true });
  
  if (error) {
    alert('Error fetching data: ' + error.message);
    return;
  }
  
  // Generate JSON string
  const jsonStr = JSON.stringify(measurements, null, 2);
  
  // Create blob and download
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `pulse-data-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  
  URL.revokeObjectURL(url);
});
```

**Output Format:**
```json
[
  {
    "id": "uuid-1",
    "user_id": "uuid-user",
    "local_tz": "Asia/Shanghai",
    "t": "2025-11-16T22:34:40+08:00",
    "sys": 120,
    "dia": 80,
    "pulse": 58,
    "raw": "120 80 56 125 85 60",
    "created_at": "2025-11-16T14:34:40.123Z",
    "updated_at": "2025-11-16T14:34:40.123Z"
  },
  ...
]
```

---

## Data Models

### Measurement Entry

```typescript
interface Measurement {
  id: string;              // UUID (auto-generated)
  user_id: string;         // UUID (foreign key to auth.users)
  local_tz: string;        // IANA timezone name (e.g., "Asia/Shanghai")
  t: string;               // ISO timestamp with offset (e.g., "2025-11-16T22:34:40+08:00")
  sys: number;             // Systolic BP (70-250)
  dia: number;             // Diastolic BP (40-150, must be < sys)
  pulse: number;           // Pulse rate (30-220)
  raw: string;             // Original input string
  created_at: string;      // ISO timestamp (UTC)
  updated_at: string;      // ISO timestamp (UTC)
}
```

### User Profile

```typescript
interface Profile {
  id: string;              // UUID (matches auth.users.id)
  timezone: string;        // Default timezone for new measurements
  show_pulse: boolean;     // Chart preference
  filter_me_only: boolean; // Chart preference
  night_shadows: boolean;  // Chart preference
  created_at: string;      // ISO timestamp (UTC)
  updated_at: string;      // ISO timestamp (UTC)
}
```

### Chart Data Point

```typescript
interface ChartDataPoint {
  iso: string;             // Original ISO timestamp string
  x: number;               // Parsed timestamp as ms (local clock time)
  sys: number;             // Systolic value
  dia: number;             // Diastolic value
  pulse: number;           // Pulse value
}
```

---

## Validation Rules

### Input Ranges

| Field | Minimum | Maximum | Notes |
|-------|---------|---------|-------|
| SYS | 70 | 250 | mmHg |
| DIA | 40 | 150 | mmHg, must be < SYS |
| PULSE | 30 | 220 | bpm |

### Cross-Field Validation

- `DIA < SYS` (diastolic must be less than systolic)

### Timestamp Validation

- Must match ISO 8601 format with timezone offset
- Regex: `/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/`
- Must be parseable by JavaScript `Date` constructor

### Timezone Validation

- Must be valid IANA timezone name
- Supported values: `"Asia/Shanghai"`, `"Europe/Moscow"`
- Enforce via database CHECK constraint

### Bulk Input Validation

- Must be whitespace-separated integers
- Count must be multiple of 3
- Each triple validated individually before aggregation
- Aggregated values re-validated after median computation

---

## UI/UX Specifications

### Design System

**Framework:** Tailwind CSS (CDN)

**Color Palette:**
- Primary: Blue (#3B82F6)
- Success: Green (#10B981)
- Warning: Yellow (#FFD52B)
- Error: Red (#EF4444)
- Neutral: Gray (#6B7280)

**Typography:**
- Font: System font stack (sans-serif)
- Monospace: For data tables (sys/dia/pulse values, timestamps)

### Layout

**Max Width:** 1024px (max-w-4xl)  
**Margins:** 16px (m-4)  
**Responsive:** Mobile-first, scales to desktop

### Components

**Buttons:**
```html
<!-- Primary -->
<button class="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600">
  Save
</button>

<!-- Secondary -->
<button class="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">
  Cancel
</button>
```

**Input Fields:**
```html
<input class="px-2 py-1 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500" />
```

**Tables:**
```html
<table class="border-collapse border border-gray-300 mx-auto shadow-lg">
  <thead>
    <tr class="bg-gray-300">
      <th class="border border-gray-300 px-2 py-1">Header</th>
    </tr>
  </thead>
  <tbody>
    <tr class="even:bg-blue-50 hover:bg-gray-100">
      <td class="border border-gray-300 px-2 py-1 font-mono">Data</td>
    </tr>
  </tbody>
</table>
```

### Interactive States

**Hover:** Lighten background by 10%  
**Focus:** Blue ring (ring-2 ring-blue-500)  
**Disabled:** Gray text, no hover effect  
**Loading:** Disable form buttons during HTMX requests (hx-disabled-elt)

### Accessibility

- All form inputs have labels (visible or aria-label)
- Color is not the only indicator (use icons/text)
- Keyboard navigation supported
- Focus visible on all interactive elements

---

## Migration Strategy

### Phase 1: Database Setup

1. Create Supabase project
2. Run SQL scripts to create tables
3. Enable RLS and create policies
4. Create database trigger for profile auto-creation
5. Test with dummy data

### Phase 2: Auth Implementation

1. Create login/signup static pages
2. Integrate Supabase Auth client
3. Add auth state management to all pages
4. Test registration and login flows
5. Implement logout

### Phase 3: Data Migration

1. Export existing NDJSON data
2. Write migration script:
   - Parse each line of NDJSON
   - Associate with default user (or create users)
   - Insert into Supabase via API
3. Verify data integrity
4. Archive NDJSON files

### Phase 4: Core Features

1. Implement measurement entry form
2. Create Edge Function for validation
3. Build chart rendering with Supabase data source
4. Implement settings panel
5. Create daily summary table

### Phase 5: Advanced Features

1. Build edit page
2. Implement JSON export
3. Add profile settings sync
4. Test cross-timezone scenarios

### Phase 6: Deployment

1. Deploy static files to Netlify
2. Configure environment variables
3. Test production build
4. Set up custom domain (optional)
5. Monitor Supabase usage

### Data Migration Script (Python Example)

```python
import json
import os
from supabase import create_client, Client

# Initialize Supabase client
url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_KEY")
supabase: Client = create_client(url, key)

# Default user ID (create user first or get from auth.users)
default_user_id = "uuid-of-default-user"

# Read NDJSON file
with open('data/bp.ndjson', 'r') as f:
    for line in f:
        if not line.strip():
            continue
        
        entry = json.loads(line)
        
        # Transform to new schema
        measurement = {
            "user_id": default_user_id,
            "local_tz": entry.get("local_tz", "Asia/Shanghai"),
            "t": entry["t"],
            "sys": entry["sys"],
            "dia": entry["dia"],
            "pulse": entry["pulse"],
            "raw": entry.get("raw", "")
        }
        
        # Insert
        result = supabase.table("measurements").insert(measurement).execute()
        print(f"Inserted: {entry['t']}")

print("Migration complete!")
```

---

## Appendix: Key Design Decisions

### Why TEXT for Timestamps?

**Decision:** Store timestamps as TEXT instead of TIMESTAMPTZ

**Reasoning:**
1. PostgreSQL's TIMESTAMPTZ normalizes to UTC internally
2. We need to preserve the exact local time string
3. Offset is metadata only, not for calculations
4. Simplifies querying (string comparisons for date ranges)
5. Avoids timezone conversion bugs

**Tradeoff:** Less efficient for range queries, but acceptable for this use case

### Why Local Timeline Plotting?

**Decision:** Parse timestamps as local clock time, ignore offset

**Reasoning:**
1. Users think in their local timeline, not UTC
2. A measurement at "22:34 Shanghai time" should always plot at 22:34
3. Simplifies charting logic (no conversions)
4. Matches user's mental model of their data

**Example:**
- User in Shanghai takes measurement at 22:34 local (14:34 UTC)
- Stored as: "2025-11-16T22:34:40+08:00"
- User travels to Moscow, chart still shows measurement at 22:34
- New measurements in Moscow stored with +03:00 offset
- Both plot correctly on user's personal timeline

### Why Median for Multiple Measurements?

**Decision:** Use median instead of mean for aggregating multiple readings

**Reasoning:**
1. Medical best practice (reduces outlier influence)
2. More robust than mean for small sample sizes
3. Common in BP monitoring devices
4. Simple to implement and explain

### Why Supabase Edge Functions for Validation?

**Decision:** Server-side validation via Edge Functions, not just client-side

**Reasoning:**
1. Security: Client-side validation can be bypassed
2. Data integrity: Enforce rules at database boundary
3. Flexibility: Complex validation logic in TypeScript
4. Consistency: Single source of truth for validation

**Tradeoff:** Adds latency vs. direct database insert, but acceptable for data quality

---

## Conclusion

This specification provides a complete blueprint for rebuilding Pulse as a static frontend + Supabase backend application. Key features include:

- User-centric timezone handling (no browser TZ interference)
- Interactive ECharts visualization
- Supabase Auth for user management
- PostgreSQL with RLS for data isolation
- Edge Functions for validation
- JSON export for data portability

The architecture is designed for simplicity, security, and scalability while maintaining the original app's core functionality and user experience.

**Next Steps:**
1. Set up Supabase project
2. Implement authentication
3. Migrate data
4. Build UI components
5. Deploy to Netlify

**Estimated Timeline:** 2-4 weeks for full implementation

---

**Document Version:** 2.0  
**Last Updated:** January 3, 2026  
**Author:** Pulse Development Team
