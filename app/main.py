from fastapi import FastAPI, Request, Form, Query
from fastapi.responses import (
    HTMLResponse,
    RedirectResponse,
    StreamingResponse,
    Response,
)
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

import os, io, json, time, fcntl, datetime, shutil
from zoneinfo import ZoneInfo
from typing import List

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.dates as mdates

# Настройки ######################################################
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(os.path.dirname(BASE_DIR), "data")
os.makedirs(DATA_DIR, exist_ok=True)
DATA_FILE = os.path.join(DATA_DIR, "bp.ndjson")

SYS_MIN, SYS_MAX = 70, 250
DIA_MIN, DIA_MAX = 40, 150
PUL_MIN, PUL_MAX = 30, 220

TZ_CHART = ZoneInfo("Asia/Shanghai")  # UTC+8
TZ_GROUP = ZoneInfo("Asia/Shanghai")  # UTC+8
TZ_UTC = datetime.timezone.utc

FIG_SIZE = (8, 4)
BAR_WIDTH = 5
####################################################################

app = FastAPI()
app.mount(
    "/static", StaticFiles(directory=os.path.join(BASE_DIR, "static")), name="static"
)
app.mount(
    "/icons", StaticFiles(directory=os.path.join(BASE_DIR, "../icons")), name="icons"
)
templates = Jinja2Templates(directory=os.path.join(BASE_DIR, "templates"))


def ensure_data_file():
    if not os.path.exists(DATA_FILE):
        with open(DATA_FILE, "w", encoding="utf-8"):
            pass


def now_local_iso(tz_name: str):
    """Generate ISO timestamp in the specified local timezone with explicit offset."""
    tz = ZoneInfo(tz_name)
    return datetime.datetime.now(tz).isoformat(timespec='seconds')


def now_utc_iso():
    return datetime.datetime.now(TZ_UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


def parse_iso(s: str) -> datetime.datetime:
    """Parse ISO timestamp with explicit offset (handles +08:00, +03:00, etc.)."""
    # Handle legacy 'Z' suffix if any remain
    if s.endswith('Z'):
        s = s.replace('Z', '+00:00')
    return datetime.datetime.fromisoformat(s)


def read_all():
    ensure_data_file()
    items = []
    with open(DATA_FILE, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                items.append(json.loads(line))
            except Exception:
                continue
    # сортировка по времени (parse to handle different offsets)
    items.sort(key=lambda x: parse_iso(x["t"]))
    return items


def group_measurements_by_date(entries):
    from collections import defaultdict

    grouped = defaultdict(list)
    for entry in entries:
        dt = parse_iso(entry["t"])
        # Use local-clock date (no timezone conversion)
        date_str = dt.date().isoformat()
        grouped[date_str].append((dt, entry))
    # Sort dates
    sorted_dates = sorted(grouped.keys())
    result = []
    for date in sorted_dates:
        measurements = grouped[date]
        # Sort by time
        measurements.sort(key=lambda x: x[0])
        morning_measurements = [m for m in measurements if 7 <= m[0].hour < 12]
        evening_measurements = [m for m in measurements if m[0].hour >= 21]
        morning = morning_measurements[0][1] if morning_measurements else None
        evening = evening_measurements[0][1] if evening_measurements else None
        result.append({"date": date, "morning": morning, "evening": evening})
    return result


def get_highlighted_timestamps(entries):
    grouped = group_measurements_by_date(entries)
    morning_ts = set()
    for day in grouped:
        if day["morning"]:
            morning_ts.add(day["morning"]["t"])

    evening_ts = set()
    for day in grouped:
        if day["evening"]:
            evening_ts.add(day["evening"]["t"])
    return morning_ts, evening_ts


def append_entry(entry: dict):
    ensure_data_file()
    with open(DATA_FILE, "a", encoding="utf-8") as f:
        fcntl.flock(f.fileno(), fcntl.LOCK_EX)
        try:
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")
        finally:
            fcntl.flock(f.fileno(), fcntl.LOCK_UN)


def validate_values(sys_bp: int, dia_bp: int, pulse: int):
    if not (SYS_MIN <= sys_bp <= SYS_MAX):
        raise ValueError(f"Systolic out of range {SYS_MIN}-{SYS_MAX}")
    if not (DIA_MIN <= dia_bp <= DIA_MAX):
        raise ValueError(f"Diastolic out of range {DIA_MIN}-{DIA_MAX}")
    if not (PUL_MIN <= pulse <= PUL_MAX):
        raise ValueError(f"Pulse out of range {PUL_MIN}-{PUL_MAX}")
    if dia_bp > sys_bp:
        raise ValueError("Diastolic cannot be greater than systolic")


def compute_median_avg(vals: list[int]) -> int:
    sorted_vals = sorted(vals)
    n = len(sorted_vals)
    if n % 2 == 0:
        return round((sorted_vals[n // 2 - 1] + sorted_vals[n // 2]) / 2)
    else:
        return sorted_vals[n // 2]


def plot_pressure(entries, night_shadows=None, show_pulse=True):
    # Готовим данные (use local timestamps directly)
    times = [parse_iso(e["t"]) for e in entries]
    times_num = mdates.date2num(times)
    sys_vals = [e["sys"] for e in entries]
    dia_vals = [e["dia"] for e in entries]
    pulse_vals = [e["pulse"] for e in entries]

    # Определяем цвета для утренних и вечерних измерений
    morning_ts, evening_ts = get_highlighted_timestamps(entries)
    colors = []
    for e in entries:
        if e["t"] in morning_ts:
            colors.append("#ffd52b")
        elif e["t"] in evening_ts:
            colors.append("#989dfcff")
        else:
            colors.append("#b0b0b0")  # "#ff6f6f")
    fig, ax = plt.subplots(figsize=FIG_SIZE)  # адаптивно ужмётся по CSS
    ax2 = ax.twinx()
    if times:
        if night_shadows is not None:
            # Add night shading (use timezone from entries)
            tz_info = times[0].tzinfo if times else None
            dates = set(dt.date() for dt in times)
            for date in dates:
                # Evening shading 18:00 to 24:00
                start_eve = datetime.datetime.combine(
                    date, datetime.time(18, 0), tzinfo=tz_info
                )
                end_eve = datetime.datetime.combine(
                    date + datetime.timedelta(days=1),
                    datetime.time(0, 0),
                    tzinfo=tz_info,
                )
                ax.axvspan(
                    float(mdates.date2num(start_eve)),
                    float(mdates.date2num(end_eve)),
                    color="lightgrey",
                    alpha=0.3,
                )
                # Morning shading 00:00 to 06:00 next day
                start_mor = datetime.datetime.combine(
                    date + datetime.timedelta(days=1),
                    datetime.time(0, 0),
                    tzinfo=tz_info,
                )
                end_mor = datetime.datetime.combine(
                    date + datetime.timedelta(days=1),
                    datetime.time(6, 0),
                    tzinfo=tz_info,
                )
                ax.axvspan(
                    float(mdates.date2num(start_mor)),
                    float(mdates.date2num(end_mor)),
                    color="lightgrey",
                    alpha=0.3,
                )
        # Calculate y-axis limits based on data being shown
        if show_pulse:
            overall_min = min(min(sys_vals), min(dia_vals), min(pulse_vals)) - 10
            overall_max = max(max(sys_vals), max(dia_vals), max(pulse_vals)) + 10
        else:
            overall_min = min(min(sys_vals), min(dia_vals)) - 10
            overall_max = max(max(sys_vals), max(dia_vals)) + 10
        # Temporary invisible bars to set axis limits
        temp_bars = ax2.bar(
            times_num,
            height=[s - d for s, d in zip(sys_vals, dia_vals)],
            bottom=dia_vals,
            width=0.005,
            alpha=0,
            color="#d32f2f",
        )
        if show_pulse:
            ax.plot(
                times_num,
                pulse_vals,
                color="red",
                alpha=0.4,
                label="Pulse",
                linewidth=2,
            )
            ax.set_ylim(overall_min, overall_max)
            ax.tick_params(axis="y", colors="red")
        else:
            ax.tick_params(axis="y", labelleft=False)
        ax2.set_ylim(overall_min, overall_max)
        ax.xaxis.set_major_formatter(mdates.DateFormatter("%b %d\n%H:%M"))
        ax.tick_params(axis="x", rotation=0, labelsize=7)
        ax2.tick_params(axis="y", colors="green")
        fig.tight_layout()
        # Calculate bar width for 5 pixels
        xlim = ax.get_xlim()
        pos = ax.get_position()
        fig_width, fig_height = fig.get_size_inches()
        dpi = fig.dpi
        axis_width_pixels = pos.width * fig_width * dpi
        data_range = xlim[1] - xlim[0]
        data_per_pixel = data_range / axis_width_pixels
        bar_width = BAR_WIDTH * data_per_pixel
        # Remove temp bars
        for bar in temp_bars:
            bar.remove()
        # Redraw bars with calculated width
        ax2.bar(
            times_num,
            height=[s - d for s, d in zip(sys_vals, dia_vals)],
            bottom=dia_vals,
            width=bar_width,
            alpha=0.7,
            color=colors,
            label="Blood Pressure",
        )
        # Add text labels after redrawing
        for i in range(len(times_num)):
            ax2.text(
                times_num[i],
                sys_vals[i] + 2,
                str(sys_vals[i]),
                ha="center",
                va="bottom",
                fontsize=5,
                fontdict={"weight": "bold"},
                color="green",
            )
            ax2.text(
                times_num[i],
                dia_vals[i] - 2,
                str(dia_vals[i]),
                ha="center",
                va="top",
                fontsize=5,
                fontdict={"weight": "bold"},
                color="green",
            )
            if show_pulse:
                ax.text(
                    times_num[i],
                    pulse_vals[i],
                    str(pulse_vals[i]),
                    ha="center",
                    va="center",
                    fontsize=5,
                    fontdict={"weight": "bold"},
                    color="red",
                    bbox=dict(
                        boxstyle="circle,pad=0.2",
                        facecolor="white",
                        edgecolor="red",
                        linewidth=0,
                        alpha=0.88,
                    ),
                )
    if show_pulse:
        ax.set_ylabel("bpm", color="red")
    ax2.set_ylabel("mmHg", color="green")
    ax.grid(True, linestyle=":", alpha=0.5)
    # ax.legend(loc="upper left")
    # ax2.legend(loc="upper right")
    fig.tight_layout()

    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=200)
    plt.close(fig)
    buf.seek(0)
    return buf


@app.get("/", response_class=HTMLResponse)
def index(request: Request, status_msg: str | None = None):
    entries = read_all()
    grouped_data = group_measurements_by_date(entries)
    cache_bust = int(time.time())
    return templates.TemplateResponse(
        "index.html",
        {
            "request": request,
            "entries_count": len(entries),
            "status_msg": status_msg,
            "cache_bust": cache_bust,
            "grouped_data": grouped_data,
        },
    )


@app.post("/add")
def add(
    request: Request,
    line: str | None = Form(default=None),
    sys_bp: int | None = Form(default=None),
    dia_bp: int | None = Form(default=None),
    pulse: int | None = Form(default=None),
    local_tz: str | None = Form(default=None),
):
    input_value = None
    try:
        if line:
            parts = line.strip().split()
            if len(parts) % 3 != 0:
                raise ValueError(
                    "Input must contain a multiple of 3 values (SYS DIA PULSE)"
                )
            num_measurements = len(parts) // 3
            sys_list = [int(parts[i * 3]) for i in range(num_measurements)]
            dia_list = [int(parts[i * 3 + 1]) for i in range(num_measurements)]
            pulse_list = [int(parts[i * 3 + 2]) for i in range(num_measurements)]
            # Validate each triple
            for i in range(num_measurements):
                validate_values(sys_list[i], dia_list[i], pulse_list[i])
            # Compute aggregated values
            sys_v = compute_median_avg(sys_list)
            dia_v = compute_median_avg(dia_list)
            pul_v = compute_median_avg(pulse_list)
            # Validate aggregated values
            validate_values(sys_v, dia_v, pul_v)
        else:
            if sys_bp is None or dia_bp is None or pulse is None:
                raise ValueError("Need three values: sys, dia, pulse")
            sys_v, dia_v, pul_v = sys_bp, dia_bp, pulse
            validate_values(sys_v, dia_v, pul_v)

        # Use local timezone for timestamp
        tz_name = local_tz or "Asia/Shanghai"
        entry = {
            "local_tz": tz_name,
            "t": now_local_iso(tz_name),
            "sys": sys_v,
            "dia": dia_v,
            "pulse": pul_v
        }
        if line:
            entry["raw"] = line
        else:
            entry["raw"] = f"sys_bp={sys_v} dia_bp={dia_v} pulse={pul_v}"
        append_entry(entry)
        status_msg = "Saved"
    except ValueError as e:
        status_msg = f"Error: {e}"
        input_value = line

    # Если запрос сделан через HTMX, вернём заново главную страницу для частичной замены
    if request.headers.get("HX-Request") == "true":
        entries = read_all()
        grouped_data = group_measurements_by_date(entries)
        cache_bust = int(time.time())
        return templates.TemplateResponse(
            "index.html",
            {
                "request": request,
                "entries_count": len(entries),
                "status_msg": status_msg,
                "cache_bust": cache_bust,
                "grouped_data": grouped_data,
                "input_value": input_value,
            },
        )
    # Иначе — обычный PRG (POST/Redirect/GET)
    return RedirectResponse(url="/", status_code=303)


@app.get("/chart/combined.png")
def chart_combined(
    filter: str | None = None,
    night_shadows: str | None = Query(default=None),
    show_pulse: bool = Query(default=True),
):
    entries = read_all()
    if filter == "me_only":
        morning_ts, evening_ts = get_highlighted_timestamps(entries)
        filtered_entries = [
            e for e in entries if e["t"] in morning_ts or e["t"] in evening_ts
        ]
    else:
        filtered_entries = entries
    buf = plot_pressure(
        filtered_entries, night_shadows=night_shadows, show_pulse=show_pulse
    )
    return StreamingResponse(buf, media_type="image/png")


@app.post("/update_chart")
def update_chart(
    filter: str | None = Form(default=None),
    night_shadows: str | None = Form(default=None),
    show_pulse: bool = Form(default=True),
):
    cache_bust = int(time.time())
    filter_param = f"&filter={filter}" if filter else ""
    night_shadows_param = f"&night_shadows={night_shadows}" if night_shadows else ""
    show_pulse_param = f"&show_pulse={str(show_pulse).lower()}"
    html_content = f'<div id="charts" class="flex flex-col gap-3"><img class="w-full h-auto" alt="Blood Pressure and Pulse" src="/chart/combined.png?cb={cache_bust}{filter_param}{night_shadows_param}{show_pulse_param}" /></div>'
    return HTMLResponse(content=html_content)


@app.get("/json")
def dump():
    entries = read_all()
    return entries


@app.get("/edit")
def edit(request: Request, status_msg: str | None = None):
    all_entries = read_all()
    # Take last 10 (most recent)
    entries = all_entries[-10:] if len(all_entries) >= 10 else all_entries
    total_count = len(all_entries)
    cache_bust = int(time.time())
    return templates.TemplateResponse(
        "edit.html",
        {
            "request": request,
            "entries": entries,
            "total_count": total_count,
            "status_msg": status_msg,
            "cache_bust": cache_bust,
        },
    )


@app.post("/edit")
def save_edit(
    request: Request,
    t: List[str] = Form(...),
    sys: List[int] = Form(...),
    dia: List[int] = Form(...),
    pulse: List[int] = Form(...),
    raw: List[str] = Form(...),
    local_tz: List[str] = Form(...),
):
    if not (len(t) == len(sys) == len(dia) == len(pulse) == len(raw) == len(local_tz)):
        status_msg = "Error: Mismatched number of fields"
        all_entries = read_all()
        entries = all_entries[-10:] if len(all_entries) >= 10 else all_entries
        total_count = len(all_entries)
        cache_bust = int(time.time())
        return templates.TemplateResponse(
            "edit.html",
            {
                "request": request,
                "entries": entries,
                "total_count": total_count,
                "status_msg": status_msg,
                "cache_bust": cache_bust,
            },
        )

    edited_entries = []
    errors = []
    for i in range(len(t)):
        try:
            # Validate timestamp
            dt = parse_iso(t[i])
            # Validate values
            validate_values(sys[i], dia[i], pulse[i])
            entry = {
                "local_tz": local_tz[i],
                "t": t[i],
                "sys": sys[i],
                "dia": dia[i],
                "pulse": pulse[i],
                "raw": raw[i],
            }
            edited_entries.append(entry)
        except ValueError as e:
            errors.append(f"Entry {i + 1}: {e}")

    if errors:
        status_msg = "Validation errors: " + "; ".join(errors)
        all_entries = read_all()
        entries = all_entries[-10:] if len(all_entries) >= 10 else all_entries
        total_count = len(all_entries)
        cache_bust = int(time.time())
        return templates.TemplateResponse(
            "edit.html",
            {
                "request": request,
                "entries": entries,
                "total_count": total_count,
                "status_msg": status_msg,
                "cache_bust": cache_bust,
            },
        )

    # Read full entries
    all_entries = read_all()
    all_entries.sort(key=lambda x: x["t"])

    # Combine: keep all except last 10, append edited
    combined_entries = all_entries[:-10] + edited_entries

    # Sort combined by timestamp
    combined_entries.sort(key=lambda x: x["t"])

    # Create backup
    backup_file = None
    if os.path.exists(DATA_FILE):
        backup_file = (
            DATA_FILE + ".backup." + datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        )
        shutil.copy(DATA_FILE, backup_file)

    # Write new data
    ensure_data_file()
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        fcntl.flock(f.fileno(), fcntl.LOCK_EX)
        try:
            for entry in combined_entries:
                f.write(json.dumps(entry, ensure_ascii=False) + "\n")
        finally:
            fcntl.flock(f.fileno(), fcntl.LOCK_UN)

    backup_msg = (
        f" Backup created as {os.path.basename(backup_file)}" if backup_file else ""
    )
    status_msg = f"Data saved successfully.{backup_msg}"

    # If HTMX, return updated page
    if request.headers.get("HX-Request") == "true":
        all_entries = read_all()
        entries = all_entries[-10:] if len(all_entries) >= 10 else all_entries
        total_count = len(all_entries)
        cache_bust = int(time.time())
        return templates.TemplateResponse(
            "edit.html",
            {
                "request": request,
                "entries": entries,
                "total_count": total_count,
                "status_msg": status_msg,
                "cache_bust": cache_bust,
            },
        )
    # Else redirect
    return RedirectResponse(url="/edit", status_code=303)


@app.get("/dump")
def dump_raw():
    if not os.path.exists(DATA_FILE):
        return Response("", media_type="text/plain")
    with open(DATA_FILE, "r", encoding="utf-8") as f:
        content = f.read()
    return Response(content, media_type="text/plain")
