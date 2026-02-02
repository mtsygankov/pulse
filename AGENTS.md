# Pulse Project Documentation for Developer Agents

## Project Overview
Pulse is a Progressive Web App (PWA) built with FastAPI for tracking and visualizing blood pressure (BP) measurements. It enables users to input systolic blood pressure (SYS), diastolic blood pressure (DIA), and pulse readings, storing them in a time-series NDJSON format. The application provides a web interface to view grouped measurements (morning and evening per day) with interactive client-side ECharts for BP trends. Features include dark mode support, multi-timezone switching, edit functionality for recent measurements, and browser-based settings persistence via local storage.

## Purpose
The primary purpose of Pulse is to facilitate personal health monitoring by:
- Recording BP measurements with ISO timestamps and timezone metadata.
- Grouping measurements by date, highlighting morning (07:00-13:00) and evening (21:00-03:00 next day) readings.
- Visualizing BP data via interactive client-side ECharts with zoom/pan capabilities, displaying SYS/DIA ranges and pulse.
- Providing editable interface for recent measurements with automatic backups.
- Supporting multi-timezone tracking for users traveling across different time zones.
- Offering a responsive web interface with dark mode support.
- Ensuring data validation and safe concurrent access to NDJSON file.

The application uses timezone-aware timestamps stored with explicit offsets, supporting configurable timezone switching with UI-based selection (defaults to Asia/Shanghai). Both manual form input and text-based entry are supported for flexibility.

## Project Structure

### Directories and Key Files
- **Root Directory** (`/Users/mikt/Documents/Yandex.Disk.localized/Python-Testbed/pulse`):
  - `README.md`: Project description and usage guide.
  - `pyproject.toml`: Project configuration with metadata, dependencies, and Python version requirements (>=3.12).
  - `.python-version`: Specifies Python 3.13 for local development.
  - `uv.lock`: Lock file for uv package manager with resolved dependencies.
  - `.gitignore`: Standard Python gitignore.
  - `.ruff_cache/`: Cache directory for Ruff linter/formatter.
  - `test_grouping.py`: Test script for data grouping and highlighting logic.
  - `Makefile`: Build commands for Tailwind CSS compilation and deployment.
  - `tailwind.config.js`: Tailwind CSS configuration file.
  - `tailwindcss`: Binary executable for Tailwind CSS processing.
  - `convert.py`: Data conversion utility script.
  - `PRD.md`, `PRD_old.md`: Product requirement documents.
  - `GH_US.md`: GitHub usage documentation.

- **app/**: Main application code.
  - `main.py`: Core FastAPI application with routes, data handling, validation, and legacy matplotlib plotting.
  - `config.json`: Timezone configuration file with current timezone and timezone mappings (auto-created if missing).
  - `static/`: Static assets.
    - `style.css`: Custom CSS styling including dark mode support and timezone badge styles.
    - `tailwind.min.css`: Compiled Tailwind CSS utility classes.
    - `echarts.min.js`: ECharts library for interactive client-side charting.
    - `charting.js`: Client-side BP chart rendering logic using ECharts.
    - `htmx.min.js`: HTMX library for progressive enhancement and partial page updates.
    - `favicon.ico`: Website favicon.
    - `input.css`: Tailwind CSS source file for compilation.
  - `templates/`: Jinja2 HTML templates.
    - `base.html`: Base template with PWA manifest link and common head elements.
    - `index.html`: Main page template with chart, data entry forms, and grouped measurements table.
    - `edit.html`: Edit page template for modifying last 10 measurements with chart preview.

- **icons/**: PWA icons and manifest.
  - `site.webmanifest`: PWA manifest with app name, theme colors, and icon definitions.
  - `apple-touch-icon.png`: iOS home screen icon (180x180).
  - `android-chrome-192x192.png`: Android icon (192x192).
  - `android-chrome-512x512.png`: Android icon (512x512).
  - `favicon-32x32.png`: Favicon (32x32).
  - `favicon-16x16.png`: Favicon (16x16).
  - `about.txt`: Icons attribution and licensing information.

- **data/**: Data storage.
  - `bp.ndjson`: NDJSON file storing BP measurement entries (one JSON object per line).
  - `bp.ndjson.backup.YYYYMMDD_HHMMSS`: Automatic backups created before edit operations.

### Architecture
- **Backend**: FastAPI framework with async support, Jinja2 templating, and static file serving.
- **Data Storage**: File-based NDJSON format for simplicity with append-only operations and full rewrite on edits. File locking (`fcntl`) ensures concurrency safety.
- **Visualization**: **Client-side ECharts** as primary charting engine (interactive, zoom/pan, tooltips). Matplotlib remains as legacy `/chart/combined.png` endpoint for backwards compatibility.
- **Frontend**: HTML/CSS with Tailwind CSS utility classes, HTMX for progressive enhancement, and custom JavaScript for client-side charting.
- **Settings Persistence**: Browser `localStorage` for user preferences (show pulse, filter options, night shadows, timezone).
- **State Management**: Client-side for chart settings; server-side for timezone configuration and data storage.

## Dependencies
Based on `pyproject.toml`:
- `fastapi>=0.121.2`: Web framework for building APIs.
- `httpx>=0.28.1`: HTTP client (included but not currently used).
- `jinja2>=3.1.6`: Templating engine for HTML rendering.
- `matplotlib>=3.10.7`: Plotting library for legacy PNG chart generation.
- `python-multipart>=0.0.20`: For handling multipart form data in FastAPI.
- `pytz>=2025.2`: Timezone support for datetime operations.
- `uvicorn[standard]>=0.38.0`: ASGI server for running the FastAPI app.
- Requires Python >=3.12.

**Development Dependencies**:
- `ruff>=0.14.13`: Python linter and formatter.

The project uses `uv` for dependency management (evidenced by `uv.lock`). Tailwind CSS binary is included for styling compilation.

## How to Run or Initialize the Project

1. **Prerequisites**: Ensure Python 3.12 or higher is installed (`.python-version` shows 3.13 for local development).

2. **Install Dependencies**: Use `uv` to install dependencies:
   ```bash
   uv sync
   ```

3. **Build Tailwind CSS** (required first time or after CSS changes):
   ```bash
   # One-time build
   make build
   
   # Or watch mode for development (auto-rebuilds on changes)
   make watch
   ```
   This compiles `app/static/input.css` to `app/static/tailwind.min.css`.

4. **Run the Application**: Start the FastAPI server with auto-reload:
   ```bash
   uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8002
   ```
   The server runs at `http://localhost:8002`.

5. **Data Initialization**: The app automatically creates `data/bp.ndjson` and `app/config.json` if they don't exist. No manual initialization required.

6. **Access**: Open a web browser to `http://localhost:8002`. The main page (`/`) displays existing measurements, interactive ECharts visualization, and forms for adding new data.

## Guidelines for Developer Agents

### Code Style and Quality
- Use Ruff for linting and formatting (cache in `.ruff_cache/`).
- Follow Python best practices, especially for async FastAPI routes and data validation.
- Run linter and formatter before committing changes.

### Data Handling

#### Measurement Storage Format
Measurements are stored as NDJSON with the following fields:
- `local_tz`: Timezone name for metadata (e.g., "Asia/Shanghai", "Europe/Moscow")
- `t`: ISO timestamp with explicit timezone offset (e.g., "2025-11-16T22:34:40+08:00", "2026-01-15T21:58:01+03:00")
- `sys`: Systolic blood pressure (integer)
- `dia`: Diastolic blood pressure (integer)
- `pulse`: Heart rate in beats per minute (integer)
- `raw` (optional): Original input string for reference

**Important**:
- The `t` field stores the **local clock time** at which the measurement was taken, with an explicit timezone offset.
- The `local_tz` field indicates the timezone for metadata/tracking purposes (distinguishing measurements taken in different locations during travel).
- **Client-side parsing**: JavaScript charting code (`charting.js`) ignores timezone offset and treats timestamps as local clock time for consistent visualization across time zones.
- **No timezone conversions at plotting time**: Stored local timestamps are used directly for date grouping, hour detection (morning/evening), night shadows, and chart labels.

#### Grouping Logic
- **Morning**: Measurements taken between 07:00-13:00 (inclusive of 07:00, exclusive of 13:00)
  - Selects earliest measurement in this window per date
- **Evening**: Measurements taken between 21:00-03:00 next day (6-hour window)
  - Checks current date for 21:00-24:00
  - Checks next date for 00:00-03:00
  - Selects earliest chronologically from both groups
- Implementation in `group_measurements_by_date()` function in `app/main.py`

#### Config File Structure
`app/config.json` contains timezone configuration:
```json
{
  "current_timezone": "Europe/Moscow",
  "timezones": {
    "Asia/Shanghai": {
      "city": "Shanghai",
      "badgeClass": "tz-badge--shanghai",
      "utc_offset": "UTC+8"
    },
    "Europe/Moscow": {
      "city": "Moscow",
      "badgeClass": "tz-badge--moscow",
      "utc_offset": "UTC+3"
    },
    "America/New_York": {
      "city": "New York",
      "badgeClass": "tz-badge--newyork",
      "utc_offset": "UTC-5"
    }
  }
}
```

The file is auto-created with defaults if missing. Timezone mappings control badge colors and city names displayed in the UI.

#### File Locking and Concurrent Access
- Uses `fcntl.flock()` with `LOCK_EX` for exclusive write locks
- `append_entry()`: Append-only for new measurements
- `save_edit()`: Full rewrite with backup creation before saving
- Locks are released automatically via context manager (`finally` clause)

#### Validation Ranges
```python
SYS_MIN, SYS_MAX = 70, 250
DIA_MIN, DIA_MAX = 40, 150
PUL_MIN, PUL_MAX = 30, 220
# Additional constraint: DIA must be < SYS
```

#### Input Modes
- **Form input**: Individual SYS/DIA/PULSE values via form fields
- **Text input**: Space-separated triplets (e.g., "120 80 70" or "118 78 65 122 82 72")
  - Multiple triplets are aggregated using median calculation
  - Supports manual entry from blood pressure monitors
  - Raw input stored in `raw` field for reference

### Web Development

#### Client-Side Charting (`app/static/charting.js`)
Primary chart rendering uses ECharts library:
```javascript
async function renderBPChart(containerId, options) {
  // options.showPulse: boolean - toggle pulse line visibility
  // options.meOnly: boolean - filter to morning/evening measurements only
  // options.nightShadows: boolean - show night shading (18:00-06:00)
  // options.initialZoomDays: number - initial zoom window in days (default: 30)
  
  // Fetches data from /json endpoint
  // Renders interactive charts with:
  //   - Custom vertical bars for BP (dia -> sys)
  //   - Line chart for pulse (optional)
  //   - Zoom/pan via mouse wheel and drag
  //   - Data labels for SYS, DIA, and pulse values
  //   - Night shading regions
  //   - Morning/evening color highlighting
}
```

**Chart Features**:
- Custom `renderItem` function creates vertical bars from DIA to SYS values
- Bar width fixed at 5 pixels for consistency
- Color coding: Yellow (#ffd52b) for morning, Blue (#989dfc) for evening, Gray (#b0b0b0) for other
- DataZoom component enables pan and zoom with minimum 24-hour window
- Responsive to container size changes (ResizeObserver)
- Preserves zoom state when re-rendering (e.g., after settings change)

#### HTMX Integration
- Forms use `hx-post` for dynamic updates without full page reload
- `hx-target="#page"` replaces entire page content on success
- `hx-disabled-elt="button"` disables submit button during request
- `htmx:afterSwap` event listener re-initializes charts after DOM updates
- Supports both HTMX-enhanced and traditional browser navigation (PRG pattern)

#### Browser Local Storage
Chart settings persisted in browser:
```javascript
localStorage.getItem('showPulse')      // boolean - toggle pulse line
localStorage.getItem('filter_me_only') // boolean - show morning/evening only
localStorage.getItem('night_shadows')   // boolean - show night shading
localStorage.getItem('local_tz')       // string - selected timezone name
```

Settings are loaded on page load and synchronized with UI toggle states.

#### Dark Mode
- System preference detection via `@media (prefers-color-scheme: dark)`
- CSS custom properties in `app/static/style.css` override Tailwind defaults
- Automatic color scheme switching based on user's OS/browser preference
- Dark mode styles for tables, forms, modals, and chart backgrounds

#### Timezone Selection UI
1. Clickable timezone badge in header (displays city name)
2. Modal opens with available timezone options from `/api/timezones`
3. Selecting timezone updates:
   - Hidden form field (`local_tz`) for next submission
   - Badge color and text
   - Browser local storage
   - Server config (persisted on next form submission via `save_current_timezone()`)

#### Edit Functionality
- Accessible via "Edit" button on main page
- Shows last 10 measurements for editing
- Inline form validation on save
- Automatic backup creation before write: `bp.ndjson.backup.YYYYMMDD_HHMMSS`
- Chart preview on edit page
- Supports adding new entries via "Add Entry" button

### Testing
```bash
# Run grouping logic tests
python test_grouping.py
```

**Test Coverage** (`test_grouping.py`):
- Morning/evening grouping with edge cases (midnight, boundary hours)
- Multi-timezone handling (Shanghai UTC+8, Moscow UTC+3)
- Verification of earliest measurement selection in time windows
- Border conditions (03:00, 13:00, 21:00)

Add integration tests for API endpoints if using pytest.

### Security and Best Practices
- **No authentication implemented**: Suitable for single-user personal use; add authentication if deploying publicly.
- **Input validation**: FastAPI's `Form()` handles basic type validation; additional ranges enforced in `validate_values()`.
- **File locking**: `fcntl` ensures concurrent write protection.
- **Backup creation**: Automatic backups before edit operations preserve data history.
- **CSRF protection**: Not implemented (single-user scenario); consider adding for public deployment.
- **Error handling**: Try/except blocks with specific exception types; logging for errors.

### Deployment
- **Local use**: File-based storage sufficient for personal monitoring.
- **Production considerations**:
  - File-based storage (`bp.ndjson`) persists on server but may be lost on server reconfiguration
  - Consider migrating to SQLite or PostgreSQL for production reliability
  - Add proper logging infrastructure
  - Implement authentication and CSRF protection for public access
- **Current deployment** (Makefile):
  ```bash
  make deploy  # rsync to ubuntu@35.166.88.10:~/pulse/
  ```

### Contributions
- Document significant changes in `README.md`.
- Use `uv` for dependency management to maintain `uv.lock` consistency.
- Follow code style guidelines and run linter before committing.

## Build, Lint, and Test Commands

### Tailwind CSS Build Commands (Makefile)
```bash
make build        # Compile Tailwind CSS once
make watch        # Watch mode for development (auto-rebuild on changes)
make build-prod   # Alias for build (production build)
make clean        # Remove compiled CSS (app/static/tailwind.min.css)
make help         # Display all available commands
```

### Python Development Commands
```bash
# Install dependencies
uv sync

# Run FastAPI server with auto-reload
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8002

# Linting (Ruff)
uv run ruff check           # Check for issues
uv run ruff check --fix     # Auto-fix issues
uv run ruff format          # Format code to PEP8 standards

# Run tests
python test_grouping.py      # Run grouping logic tests
uv run pytest               # If pytest is added for integration tests
```

### Deployment Commands
```bash
make deploy       # Deploy to production server via rsync
```

## Code Style Guidelines

### Python
- **Imports**: Group imports as standard library (e.g., `os`, `json`), third-party (e.g., `fastapi`, `matplotlib`), and local modules. Use absolute imports. Avoid wildcard imports (`from module import *`).
- **Formatting**: Follow PEP8. Use 4 spaces for indentation. Line length limit: 88 characters (Black/Ruff default). Use Ruff for automatic formatting.
- **Type Hints**: Use type hints for function parameters and return types (e.g., `def func(x: int) -> str:`). For complex types, import from `typing` (e.g., `List`, `Optional`).
- **Naming Conventions**:
  - Variables and functions: `snake_case` (e.g., `load_current_timezone`)
  - Constants: `UPPER_CASE` (e.g., `SYS_MIN = 70`)
  - Classes: `CamelCase` (e.g., `DataHandler`)
  - Private methods/attributes: Prefix with `_` (e.g., `_private_func`)
- **Docstrings**: Use triple-quoted docstrings for modules, classes, and functions. Follow Google/NumPy style (describe parameters, returns, raises).
- **Error Handling**: Catch specific exceptions (e.g., `ValueError`, `FileNotFoundError`). Use `try/except` blocks. Log errors with appropriate levels (e.g., `logging.error`). Avoid bare `except:` clauses.
- **Async/Await**: Use `async def` for FastAPI routes and I/O operations. Await async calls properly.
- **Comments**: Use inline comments for complex logic. Prefer self-documenting code. No unnecessary comments.

### JavaScript
- Use `const` by default, `let` when reassignment needed; avoid `var`
- Use camelCase for variables and function names
- Use async/await for asynchronous operations
- Include JSDoc-style comments for complex functions
- Prefer arrow functions for callbacks and short functions

### CSS
- Prefer Tailwind utility classes for styling
- Use custom CSS in `app/static/style.css` for complex interactions or component-specific styles
- Follow CSS custom properties pattern (e.g., `--header-shadow`) for theming
- Include dark mode overrides via `@media (prefers-color-scheme: dark)`

### File Naming
- Python files: `snake_case.py`
- JavaScript files: `camelCase.js`
- CSS files: `kebab-case.css`
- Static assets: `kebab-case.extension`

## API Endpoints

### Main Application
- **GET /**: Main page with data entry form, grouped measurements table, and interactive ECharts visualization
- **POST /add**: Add new BP measurement
  - Accepts: `line` (text input for space-separated triplets), `sys_bp`, `dia_bp`, `pulse`, `local_tz`
  - Supports multiple measurements in text input (aggregated by median)
  - Validates all values against ranges
  - Returns: HTML response (HTMX partial update) or redirect (PRG pattern)
- **GET /json**: Raw measurements as JSON array (used by client-side charting)
- **GET /dump**: Raw NDJSON data as plain text

### Edit Functionality
- **GET /edit**: Edit page for last 10 measurements
  - Displays editable form with chart preview
  - Shows total count of all records
- **POST /edit**: Save edited measurements
  - Accepts arrays of `t`, `sys`, `dia`, `pulse`, `raw`, `local_tz`
  - Validates all entries before writing
  - Creates backup: `bp.ndjson.backup.YYYYMMDD_HHMMSS`
  - Returns: Updated edit page (HTMX) or redirect

### Timezone Management
- **GET /api/timezones**: Get timezone configuration
  - Returns: JSON with `current_timezone` and `timezones` mapping
- **POST /set_timezone**: Set current timezone
  - Accepts: `local_tz` (timezone name string)
  - Updates `app/config.json`
  - Returns: `{"status": "ok"}`

### Legacy Endpoints
- **GET /chart/combined.png**: Server-side matplotlib PNG chart (backwards compatible)
  - Query parameters: `filter` (me_only), `night_shadows`, `show_pulse`
  - Note: Client-side ECharts is now the primary charting method
- **POST /update_chart**: Legacy HTMX chart update (deprecated, kept for compatibility)

## PWA Configuration

### Manifest
PWA manifest located at `/icons/site.webmanifest`:
```json
{
  "name": "Blood Pressure Tracker",
  "short_name": "BP Tracker",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#ffffff",
  "icons": [
    {"src": "/icons/android-chrome-192x192.png", "sizes": "192x192", "type": "image/png"},
    {"src": "/icons/android-chrome-512x512.png", "sizes": "512x512", "type": "image/png"},
    {"src": "/icons/apple-touch-icon.png", "sizes": "180x180", "type": "image/png"},
    {"src": "/icons/favicon-32x32.png", "sizes": "32x32", "type": "image/png"},
    {"src": "/icons/favicon-16x16.png", "sizes": "16x16", "type": "image/png"}
  ]
}
```

### Installation
1. Open the app in a modern browser (Chrome, Edge, Safari, etc.)
2. Browser prompts to install the app (or use "Add to Home Screen" option)
3. App launches in standalone mode without browser chrome
4. Works offline with basic caching (service worker not fully implemented)

### Icons
Multiple icon sizes provided for different devices and contexts:
- Android Chrome: 192x192 and 512x512
- Apple iOS: 180x180 (touch icon)
- Favicon: 16x16 and 32x32 for browser tabs

## UI Customization

### Header Shadow Customization
Header UI elements (timezone pill, icon buttons, input field, and save button) use a unified shadow style controlled by CSS custom property. To customize, modify in `app/static/style.css`:
```css
:root {
  --header-shadow: 0 4px 6px rgba(0,0,0,0.1);
}
```

### Timezone Badge Colors
Badge colors defined in `app/static/style.css`:
```css
.tz-badge--shanghai { background-color: #3b82f6; }  /* Blue */
.tz-badge--moscow   { background-color: #ef4444; }  /* Red */
.tz-badge--newyork  { background-color: #10b981; }  /* Green */
```

Add new timezone badge classes following the `tz-badge--cityname` pattern.

## Chart Customization Options

Client-side chart supports the following options via UI toggles:
- **Show Pulse on Chart**: Toggle red pulse line visibility (default: enabled)
- **Plot Only Morning/Evening**: Filter to show only highlighted measurements (morning 07:00-13:00, evening 21:00-03:00)
- **Night Shadows**: Add shaded regions for nighttime hours (18:00-24:00 and 00:00-06:00)

All settings are automatically saved to browser local storage and restored on page reload.

## Performance Considerations

- **Client-side charting**: ECharts rendering offloads chart generation from server to browser, reducing server CPU load
- **Data loading**: Chart fetches JSON data via `/json` endpoint; consider pagination for large datasets
- **File I/O**: Append-only for new measurements; full rewrite only on edits (with backup)
- **Caching**: Browser caches static assets (CSS, JS, icons); chart data fetched without cache for freshness
- **Tailwind compilation**: Use `make watch` for development; `make build` for production to minify CSS

## Migration Notes

### Matplotlib to ECharts Transition
The project migrated from server-side matplotlib to client-side ECharts for primary charting:
- **Legacy**: `/chart/combined.png` endpoint still generates matplotlib charts for backwards compatibility
- **Current**: Client-side `renderBPChart()` in `charting.js` provides interactive charts
- **Benefits**: Zoom/pan, better performance on server, responsive design, no PNG generation overhead

### Data Format Compatibility
Both charting methods use the same NDJSON data format, ensuring smooth migration. The `t` field with explicit timezone offset works with both matplotlib (legacy) and ECharts (current).
