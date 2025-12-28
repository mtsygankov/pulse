# Product Requirements Document (PRD) for Pulse Blood Pressure Tracking App

## Overview
Pulse is a web-based application for personal blood pressure (BP) and pulse monitoring. Users can record measurements, view grouped daily summaries, and visualize trends through charts. The app supports flexible data entry, validation, and safe concurrent access.

## Functional Requirements (User Stories)

1. **As a user, I want to add a single blood pressure measurement (systolic, diastolic, pulse) via a web form so that I can quickly record my readings.**
   - Acceptance Criteria: Form validates inputs (ranges: SYS 70-250, DIA 40-150, PULSE 30-220; DIA < SYS). On success, data is saved with current timestamp. On failure, show error message.

2. **As a user, I want to add multiple blood pressure measurements at once via text input (e.g., "120 80 56 125 85 60") so that I can batch-enter readings from a device or manual notes.**
   - Acceptance Criteria: Parse text as triples (SYS DIA PULSE), validate each, compute median values, save aggregated entry with timestamp. Handle invalid formats gracefully.

3. **As a user, I want to view my blood pressure data grouped by day (morning and evening readings) in a table so that I can track daily trends.**
   - Acceptance Criteria: Display table with columns: Date, Morning (SYS/DIA Pulse), Evening (SYS/DIA Pulse). Morning: earliest measurement between 07:00-12:00; Evening: earliest after 21:00 (timezone-adjusted). Show only dates with data.

4. **As a user, I want to visualize my blood pressure and pulse data in a chart so that I can see trends over time.**
   - Acceptance Criteria: Chart shows bars for BP range (SYS-DIA), line for pulse. Color-code: yellow for morning, blue for evening, gray for others. Include timestamps on x-axis, values labeled on bars/lines. Chart is a combined bar/line plot generated as a PNG image. Bars represent the BP range (SYS-DIA) with height from DIA to SYS. Red line overlays pulse values. X-axis shows timestamps (dates) in chronological order. Y-axis scales to BP values (e.g., 40-250 mmHg), with pulse line adjusted proportionally. Morning measurements (07:00-12:00) in yellow, evening (after 21:00) in blue, others in gray. Values are labeled on bars and line points for readability.

5. **As a user, I want to customize the chart (filter to morning/evening only, add night shadows, toggle pulse) so that I can focus on relevant data.**
   - Acceptance Criteria: Settings panel with toggles. Filter removes non-morning/evening points. Night shadows shade 18:00-06:00 periods. Pulse toggle hides/shows line and adjusts y-axis. Settings persist across sessions. Settings panel includes: 'Filter to morning/evening' toggle (hides non-morning/evening points and bars). 'Add night shadows' toggle (adds gray shading for 18:00-06:00 periods to indicate nighttime). 'Toggle pulse' (hides/shows red line; when hidden, y-axis adjusts to BP range only). Settings persist in browser localStorage. Chart updates dynamically via AJAX/HTMX on toggle changes without page reload.

6. **As a user, I want to edit recent blood pressure entries (last 10) so that I can correct mistakes or add missing data.**
   - Acceptance Criteria: Edit page shows table with inputs for timestamp (ISO UTC), SYS, DIA, PULSE, raw input. Validate on save. Create backup before overwriting data. Allow adding new rows.

7. **As a user, I want the app to handle data safely with concurrent access so that multiple users/devices don't corrupt the data.**
   - Acceptance Criteria: Use file locking for writes. Ensure reads are consistent. Handle errors gracefully (e.g., invalid JSON lines skipped).

8. **As a user, I want data stored in a simple, exportable format so that I can backup or migrate my records.**
   - Acceptance Criteria: Store as NDJSON (one JSON object per line). Provide endpoints to export as JSON or raw text. Include original input in records for traceability.

9. **As a user, I want the interface to update dynamically without full page reloads so that I can interact smoothly.**
   - Acceptance Criteria: Use AJAX/HTMX for form submissions and chart updates. Show loading states and error messages inline.

10. **As a user, I want the app to be responsive and mobile-friendly so that I can use it on any device.**
    - Acceptance Criteria: UI adapts to screen sizes (e.g., table scrolls horizontally on mobile). Touch-friendly inputs and buttons.

## Technical Considerations
- **Data Model**: Each measurement includes timestamp (ISO UTC), systolic, diastolic, pulse, and optional raw input.
- **Validation Rules**: Strict input validation to ensure data integrity.
- **Performance**: Optimize chart generation and dynamic updates.
- **Security**: Input sanitization; consider authentication for multi-user scenarios.
- **Scalability**: File-based storage suitable for personal use; consider database for larger deployments.
- **Visualization Details**: Chart uses matplotlib for server-side PNG generation. Supports up to 1000+ data points efficiently. Dynamic updates reduce server load by regenerating only on settings change. Responsive design ensures chart scales on mobile devices.

## Assumptions
- Target users are individuals monitoring personal health data.
- Timezone handling defaults to Asia/Shanghai (UTC+8) but should be configurable.
- App prioritizes simplicity and ease of use over advanced features.