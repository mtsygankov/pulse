# Pulse Project Documentation for Developer Agents

## Project Overview
Pulse is a web-based application built with FastAPI for tracking and visualizing blood pressure (BP) measurements. It enables users to input systolic blood pressure (SYS), diastolic blood pressure (DIA), and pulse readings, storing them in a time-series NDJSON format. The application provides a web interface to view grouped measurements (morning and evening per day) with a generated matplotlib chart for BP trends.

## Purpose
The primary purpose of Pulse is to facilitate personal health monitoring by:
- Recording BP measurements with ISO UTC timestamps.
- Grouping measurements by date, highlighting morning (07:00-12:00) and evening (after 21:00) readings.
- Visualizing BP data via a combined bar/line chart displaying SYS/DIA ranges and pulse.
- Offering a simple web interface for data entry and review.
- Ensuring data validation and safe concurrent access to the NDJSON file.

The application supports timezone handling with a configurable current timezone saved on the server, defaulting to Asia/Shanghai, and both manual form input and text-based entry for flexibility.

## Project Structure

### Directories and Key Files
- **Root Directory** (`/Users/mikt/Documents/Yandex.Disk.localized/Python-Testbed/pulse`):
  - `README.md`: Empty file; use for project description and updates.
  - `pyproject.toml`: Project configuration with metadata, dependencies, and Python version requirements.
  - `.python-version`: Specifies Python 3.13.
  - `uv.lock`: Lock file for uv package manager with resolved dependencies.
  - `.gitignore`: Standard Python gitignore.
  - `.ruff_cache/`: Cache directory for Ruff linter/formatter.
  - `test_logic.py`: Test script for data grouping and highlighting logic.

- **app/**: Main application code.
  - `main.py`: Core FastAPI application with routes, data handling, validation, and plotting logic.
  - `static/`: Static assets.
    - `style.css`: CSS styling for the web interface.
  - `templates/`: Jinja2 HTML templates.
    - `base.html`: Base template.
    - `index.html`: Main page template for displaying data and forms.

- **data/**: Data storage.
  - `bp.ndjson`: NDJSON file storing BP measurement entries (one JSON object per line).

### Architecture
- **Backend**: FastAPI framework with async support, Jinja2 templating, and static file serving.
- **Data Storage**: File-based NDJSON format for simplicity and append-only operations with file locking (`fcntl`) for concurrency.
- **Visualization**: Matplotlib for generating PNG charts, served dynamically.
- **Frontend**: HTML/CSS with HTMX for partial page updates.

## Dependencies
Based on `pyproject.toml`:
- `fastapi>=0.121.2`: Web framework for building APIs.
- `jinja2>=3.1.6`: Templating engine for HTML rendering.
- `matplotlib>=3.10.7`: Plotting library for generating BP charts.
- `python-multipart>=0.0.20`: For handling multipart form data in FastAPI.
- `uvicorn[standard]>=0.38.0`: ASGI server for running the FastAPI app.
- Requires Python >=3.13.

The project uses `uv` for dependency management (evidenced by `uv.lock`).

## How to Run or Initialize the Project
1. **Prerequisites**: Ensure Python 3.13 is installed (matches `.python-version`).
2. **Install Dependencies**: Use `uv` to install dependencies:
   ```
   uv sync
   ```
3. **Run the Application**: the server with sutho-restart enabled is already run at localohost:8002
   
4. **Data Initialization**: The app automatically creates `data/bp.ndjson` if it doesn't exist. No manual initialization required.
5. **Access**: Open a web browser to the server URL. The main page (`/`) displays existing measurements and provides forms for adding new data. The chart is available at `/chart/combined.png`.

## Guidelines for Developer Agents
- **Code Style and Quality**: Use Ruff for linting and formatting (cache in `.ruff_cache/`). Follow Python best practices, especially for async FastAPI routes and data validation.
- **Data Handling**:
  - Measurements are stored as NDJSON with fields: `local_tz` (timezone name: "Asia/Shanghai" or "Europe/Moscow"), `t` (ISO timestamp with explicit offset, e.g., "2025-11-16T22:34:40+08:00"), `sys` (systolic), `dia` (diastolic), `pulse`, and optional `raw` (original input).
  - The `t` field stores the **local clock time** at which the measurement was taken, with an explicit timezone offset (e.g., +08:00 for Shanghai, +03:00 for Moscow).
  - The `local_tz` field indicates the timezone of the measurement for metadata/tracking purposes (e.g., distinguishing measurements taken in different locations during travel).
  - Validate inputs strictly (ranges: SYS 70-250, DIA 40-150, PULSE 30-220; DIA < SYS).
  - Use file locking (`fcntl`) for safe concurrent writes.
  - **No timezone conversions at plotting time**: The stored local timestamps are used directly for date grouping, hour detection (morning/evening), night shadows, and chart labels. This simplifies visualization for users tracking measurements across different timezones during travel.
- **Web Development**:
  - Templates use Jinja2; ensure responsive design with provided CSS.
  - HTMX is used for dynamic updates; maintain compatibility.
  - Chart generation is CPU-intensive; optimize matplotlib usage for performance.
- **Testing**: Extend `test_logic.py` for unit tests on data functions. Add integration tests for API endpoints.
- **Security and Best Practices**:
  - No authentication implemented; add if deploying publicly.
  - Validate all user inputs to prevent injection or invalid data.
  - Handle exceptions gracefully in routes.
- **Deployment**: Suitable for local/personal use. For production, consider database migration (e.g., SQLite/PostgreSQL) instead of file-based storage, and add proper logging.
- **Contributions**: Document changes in `README.md`. Use `uv` for dependency management to maintain `uv.lock` consistency.

## Build, Lint, and Test Commands

- **Install Dependencies**: `uv sync` (installs all dependencies from `pyproject.toml`).
- **Run the Application**: `uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8002` (starts the FastAPI server with auto-reload).
- **Lint Code**: Use Ruff for linting (if added to dependencies): `uv run ruff check`. Fix issues with `uv run ruff check --fix`.
- **Format Code**: `uv run ruff format` (auto-formats code to PEP8 standards).
- **Run Tests**: Execute `python test_logic.py` (runs the test script for data logic). For integration tests, use `uv run pytest` if pytest is added.
- **Run a Single Test**: If using pytest with test files, `uv run pytest tests/test_file.py::TestClass::test_method`. Currently, modify `test_logic.py` to run specific functions manually (e.g., add `if __name__ == "__main__": test_function()`).

## Code Style Guidelines

- **Imports**: Group imports as standard library (e.g., `os`, `json`), third-party (e.g., `fastapi`, `matplotlib`), and local modules. Use absolute imports. Avoid wildcard imports (`from module import *`).
- **Formatting**: Follow PEP8. Use 4 spaces for indentation. Line length limit: 88 characters (Black/Ruff default). Use Ruff for automatic formatting.
- **Type Hints**: Use type hints for function parameters and return types (e.g., `def func(x: int) -> str:`). For complex types, import from `typing` (e.g., `List`, `Optional`).
- **Naming Conventions**:
  - Variables and functions: `snake_case` (e.g., `load_current_timezone`).
  - Constants: `UPPER_CASE` (e.g., `SYS_MIN = 70`).
  - Classes: `CamelCase` (e.g., `DataHandler`).
  - Private methods/attributes: Prefix with `_` (e.g., `_private_func`).
- **Docstrings**: Use triple-quoted docstrings for modules, classes, and functions. Follow Google/NumPy style (e.g., describe parameters, returns, raises).
- **Error Handling**: Catch specific exceptions (e.g., `ValueError`, `FileNotFoundError`). Use `try/except` blocks. Log errors with appropriate levels (e.g., `logging.error`). Avoid bare `except:` clauses.
- **Async/Await**: Use `async def` for FastAPI routes and I/O operations. Await async calls properly.
- **Comments**: Use inline comments for complex logic. Prefer self-documenting code. No unnecessary comments.
- **Security**: Never hardcode secrets or keys. Use environment variables. Validate all user inputs to prevent injection. Sanitize data before processing.
- **Performance**: Optimize for CPU-intensive tasks like chart generation. Use efficient data structures (e.g., lists over dicts where appropriate).
- **File Handling**: Use context managers (`with open(...)`). For concurrent access, use file locking (`fcntl`).
- **Testing**: Write unit tests for pure functions. Use assertions. Extend `test_logic.py` or add `pytest` for better test framework.
- **Version Control**: Commit small, focused changes. Use descriptive commit messages (e.g., "Add timezone config saving").
- **HTMX Integration**: Use HTMX for dynamic form submissions and partial updates. Ensure forms include `hx-post` and appropriate triggers. Handle responses gracefully to update the UI without full page reloads.
- **FastAPI Best Practices**: Use dependency injection where appropriate. Return appropriate HTTP status codes. Use Pydantic models for request/response validation.
- **Matplotlib Usage**: Generate charts server-side and cache where possible. Use `io.BytesIO` for in-memory image handling. Avoid rendering charts on every request if not necessary.