# Pulse - Blood Pressure Tracker: User Stories

## Overview
A web-based application for tracking and visualizing blood pressure (BP) and pulse measurements with time-series analysis and grouping capabilities.

## Technology Stack
- **Frontend:** React (SPA - Single Page Application)
- **Charts:** JavaScript charting library (Chart.js, Recharts, or similar)
- **Backend:** Supabase (PostgreSQL database + REST API + Real-time subscriptions)
- **Authentication:** Supabase Auth (optional for multi-user support)
- **Storage:** Supabase PostgreSQL database
- **Hosting:** Static hosting for React app (Vercel, Netlify, etc.)

## Core Features

### 1. Data Entry

**US-1.1: Quick Text Entry**
- **As a** user
- **I want to** enter multiple BP measurements using a simple text format (space-separated triplets: SYS DIA PULSE)
- **So that** I can quickly log several measurements at once without filling multiple forms
- **Example:** "120 80 56 125 85 60" records two measurements
- **Acceptance Criteria:**
  - Input field accepts space-separated numeric values
  - Values must be in multiples of 3 (SYS DIA PULSE triplets)
  - System computes median/average from multiple readings and stores single aggregated entry
  - Raw input string is preserved in "raw" field
  - Timestamp is automatically set to current UTC time

**US-1.2: Form-Based Entry**
- **As a** user
- **I want to** enter BP data using separate fields for systolic, diastolic, and pulse
- **So that** I can add measurements with explicit field labels
- **Acceptance Criteria:**
  - Three numeric input fields: Systolic, Diastolic, Pulse
  - Timestamp auto-generated on submission
  - Entry stored with current UTC timestamp

**US-1.3: Data Validation**
- **As a** system
- **I must** validate all BP measurements before storing
- **So that** data integrity is maintained
- **Validation Rules:**
  - Systolic: 70-250 mmHg
  - Diastolic: 40-150 mmHg
  - Pulse: 30-220 bpm
  - Diastolic must be less than Systolic
  - Display clear error messages for invalid inputs

### 2. Data Storage

**US-2.1: Supabase Database Storage**
- **As a** system
- **I must** store measurements in Supabase PostgreSQL database
- **So that** data is persistent, queryable, and scalable
- **Database Schema:**
  ```sql
  CREATE TABLE measurements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMPTZ NOT NULL,
    systolic INTEGER NOT NULL CHECK (systolic BETWEEN 70 AND 250),
    diastolic INTEGER NOT NULL CHECK (diastolic BETWEEN 40 AND 150),
    pulse INTEGER NOT NULL CHECK (pulse BETWEEN 30 AND 220),
    raw_input TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    user_id UUID REFERENCES auth.users(id) -- for multi-user support
  );
  
  CREATE INDEX idx_measurements_timestamp ON measurements(timestamp DESC);
  CREATE INDEX idx_measurements_user_id ON measurements(user_id, timestamp DESC);
  ```
- **Acceptance Criteria:**
  - Timestamps stored as TIMESTAMPTZ (with timezone)
  - Database constraints enforce validation rules
  - Indexes for efficient queries
  - Auto-generated UUID primary key
  - Audit timestamps (created_at, updated_at)
  - Optional user_id for multi-user scenarios

**US-2.2: Supabase Row Level Security (RLS)**
- **As a** system
- **I must** protect user data with row-level security policies
- **So that** users can only access their own measurements
- **Acceptance Criteria:**
  - RLS policies enabled on measurements table
  - Users can only SELECT/INSERT/UPDATE/DELETE their own records
  - Policy: `auth.uid() = user_id`
  - Public access for demo/single-user mode (optional)

**US-2.3: Data Versioning/History**
- **As a** system
- **I should** track changes to measurements for audit purposes
- **So that** users can see edit history
- **Acceptance Criteria:**
  - Use updated_at timestamp for tracking modifications
  - Optional: Create measurements_history table for full audit trail
  - Supabase triggers update updated_at on row changes

### 3. Data Visualization

**US-3.1: Combined BP and Pulse Chart (React Component)**
- **As a** user
- **I want to** see a visual chart showing BP ranges and pulse over time
- **So that** I can identify trends and patterns
- **Chart Implementation:**
  - React component using Chart.js, Recharts, or Victory Charts
  - Dual Y-axes: left for pulse (red), right for BP (green)
  - Bars showing BP range (systolic-diastolic) with diastolic as baseline
  - Line overlay for pulse values (optional toggle)
  - Color coding: morning measurements (yellow), evening measurements (blue), other (gray)
  - X-axis: Date and time formatted in selected timezone
  - Tooltips showing SYS/DIA/Pulse on hover
  - Responsive/adaptive sizing using CSS or chart library features
  - Real-time updates when data changes

**US-3.2: Night Shadows Overlay**
- **As a** user
- **I want to** optionally display shaded regions for night hours (21:00-07:00)
- **So that** I can visually separate day and night measurements
- **Acceptance Criteria:**
  - Toggle setting in UI
  - Gray semi-transparent overlay for night periods
  - Setting persisted in browser localStorage

**US-3.3: Filter Morning/Evening Only**
- **As a** user
- **I want to** filter the chart to show only morning (07:00-12:00) and evening (after 21:00) measurements
- **So that** I can focus on key daily readings
- **Acceptance Criteria:**
  - Toggle setting in UI
  - Chart updates to show filtered data only
  - Setting persisted in browser localStorage

**US-3.4: Show/Hide Pulse**
- **As a** user
- **I want to** toggle pulse display on the chart
- **So that** I can focus only on BP data when needed
- **Acceptance Criteria:**
  - Toggle setting in UI
  - Pulse line and left Y-axis hidden when disabled
  - Y-axis scaling adjusts based on visible data
  - Setting persisted in browser localStorage

### 4. Data Grouping and Display

**US-4.1: Daily Summary Table**
- **As a** user
- **I want to** see measurements grouped by date with morning and evening readings
- **So that** I can quickly review my daily BP patterns
- **Grouping Logic:**
  - Measurements grouped by date in Asia/Shanghai timezone (UTC+8)
  - Morning: first measurement between 07:00-12:00
  - Evening: first measurement after 21:00
  - Display format: "SYS / DIA" for pressure, separate pulse column
- **Acceptance Criteria:**
  - Table with columns: Date, Morning (Pressure, Pulse), Evening (Pressure, Pulse)
  - Even rows shaded for readability
  - Pulse columns hide when "Show Pulse" disabled
  - Hover highlight on rows

**US-4.2: Record Count Display**
- **As a** user
- **I want to** see the total number of recorded measurements
- **So that** I can track my measurement history
- **Acceptance Criteria:**
  - Display "Records: N" on main page
  - Updates after adding/editing entries

### 5. Data Editing

**US-5.1: Edit Last 10 Records**
- **As a** user
- **I want to** edit the last 10 measurements in a table form
- **So that** I can correct recent errors or update values
- **Acceptance Criteria:**
  - Separate edit page accessible via "Edit" button
  - Editable table showing last 10 entries
  - Fields: Timestamp (ISO UTC), Systolic, Diastolic, Pulse, Raw Input
  - Display "Editing last X of Y total records" message
  - Chart preview at top of edit page

**US-5.2: Add Entry from Edit Page**
- **As a** user
- **I want to** add new rows in the edit table
- **So that** I can enter historical data
- **Acceptance Criteria:**
  - "Add Entry" button creates new empty row
  - All fields required before submission
  - New entries merged with existing data

**US-5.3: Bulk Save with Validation**
- **As a** system
- **I must** validate all edited entries before saving
- **So that** invalid data is not persisted
- **Acceptance Criteria:**
  - Validate each row independently
  - Display all validation errors together
  - Do not save if any row invalid
  - Show error with row number and issue
  - Entries sorted by timestamp after save

### 6. Timezone Handling

**US-6.1: UTC Storage with Local Display**
- **As a** system
- **I must** store all timestamps in UTC but display in local timezone
- **So that** data is portable and display is user-friendly
- **Configuration:**
  - Storage: UTC (ISO 8601 with Z suffix or timezone offset)
  - Display: Selected timezone (via localStorage)
  - Configurable timezone constant in settings
- **Acceptance Criteria:**
  - All timestamps stored as UTC in Supabase
  - Chart X-axis shows selected timezone
  - Grouping logic uses selected timezone date boundaries

### 7. User Interface

**US-7.1: Settings Panel (React Component)**
- **As a** user
- **I want to** access chart configuration options via collapsible panel
- **So that** I can customize the visualization without clutter
- **Acceptance Criteria:**
  - Settings button (hamburger icon) in header
  - Panel toggles open/closed on click (React state)
  - Contains: "Morning/Evening Only", "Night Shadows", "Show Pulse" toggles, and "Timezone" selector
  - Settings persist across sessions (localStorage)
  - Chart re-renders immediately when settings change (React state update)

**US-7.2: Real-time Updates with Supabase**
- **As a** system
- **I should** enable real-time data synchronization
- **So that** users see updates immediately without manual refresh
- **Acceptance Criteria:**
  - Subscribe to Supabase real-time changes on measurements table
  - Chart and table update automatically when data changes
  - Connection status indicator (online/offline)
  - Graceful handling of connection failures

**US-7.3: Mobile Responsive Design (React + CSS)**
- **As a** user
- **I want to** use the app on mobile devices with proper layout
- **So that** I can log measurements anywhere
- **Acceptance Criteria:**
  - Tailwind CSS or CSS-in-JS for responsive design
  - Input fields adapt to mobile keyboards
  - Tables scroll horizontally on narrow screens or use card layout
  - Touch-friendly button sizes
  - Settings panel readable on mobile (480px breakpoint)
  - React responsive hooks for conditional rendering

**US-7.4: Timezone Selection**
- **As a** user
- **I want to** select my preferred timezone from the settings panel
- **So that** charts and daily groupings display in my local time
- **Acceptance Criteria:**
  - Dropdown/select field in settings panel with common timezones
  - Includes major world timezones (UTC, America/New_York, Europe/London, Asia/Shanghai, Asia/Tokyo, etc.)
  - Selected timezone persisted in browser localStorage
  - Chart X-axis labels update to show selected timezone
  - Daily grouping boundaries (morning/evening) calculated in selected timezone
  - Default timezone: Asia/Shanghai (UTC+8) if none selected
  - Timezone displayed in human-readable format (e.g., "UTC+8 (Shanghai)")
  - Chart and table update immediately when timezone changed

### 8. Additional Features

**US-8.1: Timezone Support (Client-Side)**
- **As a** system
- **I must** handle timezone conversions in the React frontend
- **So that** timezones work without server-side processing
- **Acceptance Criteria:**
  - Use `date-fns-tz` or `Luxon` library for timezone handling
  - Timezone list hardcoded in frontend or loaded from CDN
  - All conversions happen client-side
  - UTC timestamps from Supabase converted to selected timezone for display

**US-8.2: Data Export (Client-Side)**
- **As a** user
- **I want to** export my data as JSON or CSV
- **So that** I can backup or analyze data externally
- **Acceptance Criteria:**
  - Export button downloads data from Supabase query
  - Support JSON and CSV formats
  - Client-side file generation using Blob API
  - Filename includes timestamp: `bp-export-YYYYMMDD.json`

**US-8.3: PWA Support**
- **As a** system
- **I should** enable Progressive Web App features
- **So that** users can install app and use offline
- **Acceptance Criteria:**
  - Service worker for offline support
  - Web app manifest for installability
  - Cache API for offline data access
  - Sync API for offline entry submission

## Technical Requirements

### Frontend Stack
- **Framework:** React 18+ with Hooks
- **Build Tool:** Vite or Create React App
- **Styling:** Tailwind CSS or CSS-in-JS (styled-components/emotion)
- **Charting:** Chart.js + react-chartjs-2, or Recharts, or Victory Charts
- **HTTP Client:** Supabase JS Client (@supabase/supabase-js)
- **Date Handling:** date-fns or Luxon with timezone support
- **State Management:** React Context API or Zustand (optional)
- **Form Handling:** React Hook Form (optional)

### Backend/Database
- **Platform:** Supabase
- **Database:** PostgreSQL 15+
- **API:** Supabase REST API (auto-generated)
- **Real-time:** Supabase Real-time subscriptions
- **Authentication:** Supabase Auth (optional, for multi-user)
- **Storage:** PostgreSQL TIMESTAMPTZ for timestamps

### Data Format
- **Database Storage:** PostgreSQL native types (INTEGER, TIMESTAMPTZ, TEXT)
- **API Transport:** JSON via REST
- **Timestamp Format:** ISO 8601 with timezone (YYYY-MM-DDTHH:MM:SS.sssZ)
- **Client Storage:** localStorage for user preferences

### Validation Rules
- **Systolic BP:** 70-250 mmHg (integer)
- **Diastolic BP:** 40-150 mmHg (integer)
- **Pulse:** 30-220 bpm (integer)
- **Business Rule:** Diastolic < Systolic

### Timezone Configuration
- **Storage Timezone:** UTC
- **Display/Grouping Timezone:** Configurable (default: Asia/Shanghai UTC+8)
- **Morning Window:** 07:00-12:00 local time
- **Evening Window:** After 21:00 local time

### Chart Specifications
- **Rendering:** Canvas (Chart.js) or SVG (Recharts/Victory)
- **Responsiveness:** CSS-based or chart library responsive features
- **Bar Width:** Configurable based on data density
- **Colors:**
  - Morning: #ffd52b (yellow)
  - Evening: #989dfcff (blue)
  - Other: #b0b0b0 (gray)
  - Pulse line: red
  - BP bars: green
  - Night overlay: gray, 30% opacity
- **Animations:** Smooth transitions on data updates
- **Interactivity:** Tooltips, zoom, pan (optional)

### Performance Considerations
- **Pagination:** Load data in chunks (e.g., last 30 days)
- **Indexes:** Database indexes on timestamp and user_id
- **Caching:** React Query or SWR for client-side caching
- **Lazy Loading:** Code splitting for chart components
- **Debouncing:** Debounce chart updates on rapid data changes
- **Virtual Scrolling:** For large measurement lists (react-window)

### Browser Storage
- **localStorage Keys:**
  - `filter_me_only`: boolean
  - `night_shadows`: boolean
  - `showPulse`: boolean
  - `timezone`: string (IANA timezone name, e.g., "Asia/Shanghai")

## Implementation Notes

### React Component Architecture
```
App (Root)
├── Header (Settings toggle, title)
├── SettingsPanel (Collapsible settings)
│   ├── FilterToggle (Morning/Evening only)
│   ├── NightShadowsToggle
│   ├── ShowPulseToggle
│   └── TimezoneSelector
├── EntryForm (Add measurements)
├── ChartContainer
│   └── BPChart (Chart.js or Recharts component)
├── DailySummaryTable
└── EditModal (Edit last N records)
```

### State Management
- **Global State:** User preferences (settings), authentication
- **Server State:** Measurements data (via React Query/SWR)
- **Local State:** UI state (modals, dropdowns, form inputs)

### Multi-Measurement Aggregation (Client-Side)
When user enters multiple measurements (e.g., "120 80 56 125 85 60"):
1. Parse into triplets (SYS, DIA, PULSE) in React component
2. Validate each triplet independently
3. Compute median for each value type (JavaScript)
4. Send single aggregated entry to Supabase via INSERT
5. Preserve original input in "raw_input" column

### Morning/Evening Selection Logic (Client-Side)
For each date (in selected timezone):
- **Morning:** Filter measurements in 07:00-12:00 window, take FIRST
- **Evening:** Filter measurements after 21:00, take FIRST
- Use these for highlighting in chart (bar colors) and summary table
- Implement as React useMemo hook for performance

### Edit Feature (React Modal)
- Query last N entries from Supabase
- Display in editable table/form
- On save: Use Supabase UPSERT or batch UPDATE
- Optimistic updates in React Query cache
- Show loading spinner during save

### Supabase Integration
```javascript
// Initialize Supabase client
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
);

// Custom hook for measurements
function useMeasurements() {
  const { data, error, isLoading } = useQuery('measurements', async () => {
    const { data } = await supabase
      .from('measurements')
      .select('*')
      .order('timestamp', { ascending: false });
    return data;
  });
  
  return { measurements: data, error, isLoading };
}
```

## Non-Functional Requirements

### Security
- **Input Validation:** Client-side validation + database constraints
- **SQL Injection:** Protected by Supabase parameterized queries
- **XSS Prevention:** React's built-in escaping
- **Row Level Security:** Supabase RLS policies for multi-user
- **API Keys:** Supabase anon key is safe for client-side use
- **HTTPS:** Enforce HTTPS in production

### Usability
- **Error Messages:** Clear, actionable error descriptions
- **Visual Feedback:** Loading spinners, success/error toasts
- **Keyboard Support:** Standard form navigation, keyboard shortcuts
- **Touch Support:** Mobile-friendly controls and gestures
- **Accessibility:** ARIA labels, semantic HTML, keyboard navigation

### Maintainability
- **Component Architecture:** Small, reusable React components
- **TypeScript:** Optional but recommended for type safety
- **Code Splitting:** Lazy load components for performance
- **Configuration:** Environment variables for Supabase credentials
- **Comments:** JSDoc comments for functions
- **Testing:** Jest + React Testing Library for unit/integration tests

### Compatibility
- **Modern Browsers:** Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- **Features Required:** ES6+, localStorage, Fetch API, Canvas/SVG
- **Mobile Browsers:** iOS Safari 14+, Chrome Mobile 90+
- **Responsive:** 320px - 2560px viewport widths

## API Endpoints Summary (Supabase REST API)

### Supabase Auto-Generated Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------||
| GET | `/rest/v1/measurements` | Query measurements with filters |
| POST | `/rest/v1/measurements` | Insert new measurement |
| PATCH | `/rest/v1/measurements?id=eq.{id}` | Update measurement by ID |
| DELETE | `/rest/v1/measurements?id=eq.{id}` | Delete measurement by ID |

### Query Examples (using Supabase JS Client)

```javascript
// Get all measurements sorted by timestamp
const { data } = await supabase
  .from('measurements')
  .select('*')
  .order('timestamp', { ascending: false });

// Get measurements for specific date range
const { data } = await supabase
  .from('measurements')
  .select('*')
  .gte('timestamp', startDate)
  .lte('timestamp', endDate)
  .order('timestamp');

// Insert new measurement
const { data, error } = await supabase
  .from('measurements')
  .insert({
    timestamp: new Date().toISOString(),
    systolic: 120,
    diastolic: 80,
    pulse: 65,
    raw_input: '120 80 65'
  });

// Real-time subscription
const subscription = supabase
  .channel('measurements-changes')
  .on('postgres_changes', 
    { event: '*', schema: 'public', table: 'measurements' },
    (payload) => console.log('Change detected:', payload)
  )
  .subscribe();
```

## Future Enhancement Ideas
- User authentication with Supabase Auth (email/password, OAuth)
- Multi-user support with user isolation via RLS
- Medication tracking correlation
- PDF report generation (client-side with jsPDF)
- Data import from CSV/JSON
- Custom date range filtering with calendar picker
- Statistical analysis dashboard (averages, trends, percentiles)
- Push notifications/reminders (using Web Push API)
- Notes/annotations on measurements (additional column)
- Tags/categories for measurements
- Dark mode theme toggle
- Data sharing/export via shareable links
- Mobile app using React Native (code sharing)
- Integration with health devices (Bluetooth, APIs)
- Automated backups to cloud storage

## Project Setup Steps

### 1. Supabase Setup
```bash
# Create new project at supabase.com
# Run database migration:
CREATE TABLE measurements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMPTZ NOT NULL,
  systolic INTEGER NOT NULL CHECK (systolic BETWEEN 70 AND 250),
  diastolic INTEGER NOT NULL CHECK (diastolic BETWEEN 40 AND 150),
  pulse INTEGER NOT NULL CHECK (pulse BETWEEN 30 AND 220),
  raw_input TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_measurements_timestamp ON measurements(timestamp DESC);
CREATE INDEX idx_measurements_user_id ON measurements(user_id, timestamp DESC);

# Enable RLS if multi-user
ALTER TABLE measurements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can access own measurements" ON measurements
  FOR ALL USING (auth.uid() = user_id);
```

### 2. React App Setup
```bash
# Create React app with Vite
npm create vite@latest pulse-app -- --template react
cd pulse-app
npm install

# Install dependencies
npm install @supabase/supabase-js
npm install chart.js react-chartjs-2  # or recharts
npm install date-fns date-fns-tz
npm install @tanstack/react-query  # optional, for data fetching
npm install tailwindcss postcss autoprefixer  # for styling
npx tailwindcss init -p

# Create .env file
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Development
```bash
npm run dev  # Start dev server at localhost:5173
```

### 4. Deployment
```bash
npm run build  # Build production bundle
# Deploy 'dist' folder to Vercel, Netlify, or Supabase hosting
```batch UPDATE
- Optimistic updates in React Query cache
- Show loading spinner during save

### Supabase Integration
```javascript
// Initialize Supabase client
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
);

// Custom hook for measurements
function useMeasurements() {
  const { data, error, isLoading } = useQuery('measurements', async () => {
    const { data } = await supabase
      .from('measurements')
      .select('*')
      .order('timestamp', { ascending: false });
    return data;
  });
  
  return { measurements: data, error, isLoading };
}
```
When user enters multiple measurements (e.g., "120 80 56 125 85 60"):
1. Parse into triplets ( (Supabase REST API)

### Supabase Auto-Generated Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/rest/v1/measurements` | Query measurements with filters |
| POST | `/rest/v1/measurements` | Insert new measurement |
| PATCH | `/rest/v1/measurements?id=eq.{id}` | Update measurement by ID |
| DELETE | `/rest/v1/measurements?id=eq.{id}` | Delete measurement by ID |

### Query Examples (using Supabase JS Client)

```javascript
// Get all measurements sorted by timestamp
const { data } = await supabase
  .from('measurements')
  .select('*')
  .order('timestamp', { ascending: false });

// Get measurements for specific date range
const { data } = await supabase
  .from('measurements')
  .select('*')
  .gte('timestamp', startDate)
  .lte('timestamp', endDate)
  .order('timestamp');

// Insert new measurement
const { data, error } = await supabase
  .from('measurements')
  .insert({
    timestamp: new Date().toISOString(),
    systolic: 120,
    diastolic: 80,
    pulse: 65,
    raw_input: '120 80 65'
  });

// Real-time subscription
const subscription = supabase
  .channel('measurements-changes')
  .on('postgres_changes', 
    { event: '*', schema: 'public', table: 'measurements' },
    (payload) => console.log('Change detected:', payload)
  )
  .subscribe();
```

## Future Enhancement Ideas
- User authentication with Supabase Auth (email/password, OAuth)
- Multi-user support with user isolation via RLS
- Medication tracking correlation
- PDF report generation (client-side with jsPDF)
- Data import from CSV/JSON
- Custom date range filtering with calendar picker
- Statistical analysis dashboard (averages, trends, percentiles)
- Push notifications/reminders (using Web Push API)
- Notes/annotations on measurements (additional column)
- Tags/categories for measurements
- Dark mode theme toggle
- Data sharing/export via shareable links
- Mobile app using React Native (code sharing)
- Integration with health devices (Bluetooth, APIs)
- Automated backups to cloud storage
