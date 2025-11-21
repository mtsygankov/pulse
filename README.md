# Pulse - Blood Pressure Tracker

A web-based application for tracking and visualizing blood pressure measurements using FastAPI.

## Features

- Record systolic/diastolic blood pressure and pulse readings with timestamps
- Automatic grouping of measurements by date (morning 07:00-12:00, evening after 21:00)
- Interactive matplotlib charts showing BP trends with color-coded morning/evening highlights
- Timezone support (hardcoded to Asia/Shanghai UTC+8)
- Simple web interface with HTMX for dynamic updates
- Data validation and concurrent access safety

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
- `GET /json`: Raw measurements as JSON
- `GET /dump`: Raw NDJSON data

## Data Format

Measurements stored as NDJSON:
```json
{"t": "2024-01-01T08:00:00Z", "sys": 120, "dia": 80, "pulse": 70}
```

Validation ranges:
- SYS: 70-250
- DIA: 40-150, must be < SYS
- PULSE: 30-220