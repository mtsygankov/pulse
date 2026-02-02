# Pulse - Blood Pressure Tracker PWA

A web-based Progressive Web App (PWA) for tracking and visualizing blood pressure measurements using FastAPI.

## PWA Features

The app now supports PWA installation with:
- Web app manifest with proper name, icons, and theme colors
- Mobile-friendly responsive design
- Installable on mobile and desktop devices
- Offline-capable through service worker (basic caching)

## Features

- Record systolic/diastolic blood pressure and pulse readings with timestamps
- Automatic grouping of measurements by date (morning 07:00-12:00, evening after 21:00)
- Interactive matplotlib charts showing BP trends with color-coded morning/evening highlights
- Chart customization options including pulse display toggle, measurement filtering, and night shadows
- Settings persistence using browser local storage
- Timezone support (hardcoded to Asia/Shanghai UTC+8)
- Simple web interface with HTMX for dynamic updates
- Data validation and concurrent access safety

## Chart Settings

The application provides a settings panel accessible via the hamburger menu button (☰) in the top-left corner of the interface. This panel allows users to customize the chart display:

- **Show Pulse on Chart**: Toggle the visibility of the pulse line on the blood pressure chart. When enabled, the chart displays a red pulse line alongside the BP bars. This setting is persisted in the browser's local storage and defaults to enabled.
- **Plot only morning/evening measurements**: Filter the chart to show only measurements taken during morning (07:00-12:00) or evening (after 21:00) hours.
- **Night shadows**: Add shaded regions to the chart indicating nighttime hours (18:00-24:00 and 00:00-06:00).

Settings are automatically saved to local storage and restored on page reload, providing a consistent user experience.

## Project Structure

- `app/main.py`: FastAPI application with routes and plotting logic
- `app/templates/`: Jinja2 HTML templates
- `app/static/`: CSS and static assets
- `data/bp.ndjson`: NDJSON file storing measurements
- `requirements.txt`: Python dependencies for deployment

## Local Development

1. Install Python 3.12 and uv:
   ```bash
   uv sync
   ```

2. Run the application:
   ```bash
   uv run uvicorn app.main:app --reload
   ```

3. Open http://localhost:8000

## Deployment to Render.com

### Prerequisites
- GitHub repository with this code
- Render.com account

### Steps

1. **Prepare the Code** (already done):
   - Dependencies exported to `requirements.txt`
   - Python version set to 3.12 (Render compatible)

2. **Push to GitHub**:
   ```bash
   git add .
   git commit -m "Prepare for Render deployment"
   git push origin main
   ```

3. **Create Render Web Service**:
   - Go to [Render Dashboard](https://dashboard.render.com)
   - Click "New" → "Web Service"
   - Connect your GitHub repository
   - Configure settings:
     - **Runtime**: Python 3.12
     - **Build Command**: `pip install -r requirements.txt`
     - **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - Add environment variables if needed (none required by default)

4. **Deploy**:
   - Click "Create Web Service"
   - Render will build and deploy automatically
   - Access your app at the provided URL

### Important Notes

- **Data Persistence**: This app uses file-based storage (`data/bp.ndjson`). On Render's free tier, data is ephemeral and will reset on redeploys. For persistent data:
  - Consider upgrading to a paid plan with persistent disks
  - Or migrate to a database (PostgreSQL available on Render)

- **Free Tier Limits**: Monitor usage as free tier has monthly limits

- **Custom Domain**: Available on paid plans

## API Endpoints

- `GET /`: Main page with form and measurements
- `POST /add`: Add new measurement
- `GET /chart/combined.png`: BP trend chart
  - Query parameters:
    - `filter=me_only`: Show only morning (07:00-12:00) and evening (after 21:00) measurements
    - `night_shadows=true`: Add night shading to the chart (18:00-24:00 and 00:00-06:00)
    - `show_pulse=true/false`: Toggle pulse line visibility on the chart (default: true)
- `GET /json`: Raw measurements as JSON
- `GET /dump`: Raw NDJSON data

## UI Customization

The header UI elements (timezone pill, icon buttons, input field, and save button) use a unified shadow style controlled by a CSS custom property. To customize the shadow effect, modify the `--header-shadow` variable in `app/static/style.css`:

```css
:root {
  --header-shadow: 0 4px 6px rgba(0,0,0,0.1);
}
```

This single change affects all header elements simultaneously, making it easy to adjust the visual depth of the interface.

## Data Format

Measurements stored as NDJSON:
```json
{"t": "2024-01-01T08:00:00Z", "sys": 120, "dia": 80, "pulse": 70}
```

Validation ranges:
- SYS: 70-250
- DIA: 40-150, must be < SYS
- PULSE: 30-220

## PWA Configuration

The PWA manifest is located at `/icons/site.webmanifest` and includes:
- App name: "Blood Pressure Tracker"
- Short name: "BP Tracker"
- Theme colors: white background
- Multiple icon sizes for different devices
- Standalone display mode

## PWA Installation

1. Open the app in a modern browser (Chrome, Edge, Safari, etc.)
2. The browser should prompt you to install the app
3. Alternatively, use the browser's "Add to Home Screen" option

## Notes

- The app uses file-based storage (NDJSON format)
- Data is stored in `data/bp.ndjson`
- No authentication is implemented (for personal use only)
- PWA features work best on HTTPS connections