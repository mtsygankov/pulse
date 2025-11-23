from fastapi import FastAPI, Request, Form
from fastapi.responses import HTMLResponse, RedirectResponse, StreamingResponse, Response
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

import os, io, json, time, fcntl, datetime
from zoneinfo import ZoneInfo

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.dates as mdates

# Настройки
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

app = FastAPI()
app.mount(
    "/static", StaticFiles(directory=os.path.join(BASE_DIR, "static")), name="static"
)
templates = Jinja2Templates(directory=os.path.join(BASE_DIR, "templates"))


def ensure_data_file():
    if not os.path.exists(DATA_FILE):
        with open(DATA_FILE, "w", encoding="utf-8"):
            pass


def now_utc_iso():
    return datetime.datetime.now(TZ_UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


def parse_iso_utc(s: str) -> datetime.datetime:
    # '...Z' -> aware UTC
    return datetime.datetime.fromisoformat(s.replace("Z", "+00:00"))


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
    # сортировка по времени
    items.sort(key=lambda x: x.get("t", ""))
    return items


def group_measurements_by_date(entries):
    from collections import defaultdict
    grouped = defaultdict(list)
    for entry in entries:
        dt_utc = parse_iso_utc(entry["t"])
        dt_group = dt_utc.astimezone(TZ_GROUP)
        date_str = dt_group.strftime("%Y-%m-%d")
        grouped[date_str].append((dt_group, entry))
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
        result.append({
            'date': date,
            'morning': morning,
            'evening': evening
        })
    return result


def get_highlighted_timestamps(entries):
    grouped = group_measurements_by_date(entries)
    morning_ts = set()
    for day in grouped:
        if day['morning']:
            morning_ts.add(day['morning']['t'])

    evening_ts = set()
    for day in grouped:
        if day['evening']:
            evening_ts.add(day['evening']['t'])
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
        raise ValueError(f"Систолическое вне диапазона {SYS_MIN}-{SYS_MAX}")
    if not (DIA_MIN <= dia_bp <= DIA_MAX):
        raise ValueError(f"Диастолическое вне диапазона {DIA_MIN}-{DIA_MAX}")
    if not (PUL_MIN <= pulse <= PUL_MAX):
        raise ValueError(f"Пульс вне диапазона {PUL_MIN}-{PUL_MAX}")
    if dia_bp > sys_bp:
        raise ValueError("Диастолическое не может быть больше систолического")


def plot_pressure(entries):
    # Готовим данные
    times = [parse_iso_utc(e["t"]).astimezone(TZ_CHART) for e in entries]
    times_num = mdates.date2num(times)
    sys_vals = [e["sys"] for e in entries]
    dia_vals = [e["dia"] for e in entries]
    pulse_vals = [e["pulse"] for e in entries]

    # Определяем цвета для утренних и вечерних измерений
    morning_ts, evening_ts = get_highlighted_timestamps(entries)
    colors = []
    for e in entries:
        if e['t'] in morning_ts:
            colors.append("#ffd52b")
        elif e['t'] in evening_ts:
            colors.append("#4caf50")
        else:
            colors.append("#808080")#"#ff6f6f")

    fig, ax = plt.subplots(figsize=(8, 3))  # адаптивно ужмётся по CSS
    ax2 = ax.twinx()
    if times:
        # Add night shading
        dates = set(dt.date() for dt in times)
        for date in dates:
            # Evening shading 18:00 to 24:00
            start_eve = datetime.datetime.combine(date, datetime.time(18, 0), tzinfo=TZ_CHART)
            end_eve = datetime.datetime.combine(date + datetime.timedelta(days=1), datetime.time(0, 0), tzinfo=TZ_CHART)
            ax.axvspan(float(mdates.date2num(start_eve)), float(mdates.date2num(end_eve)), color='lightgrey', alpha=0.3)
            # Morning shading 00:00 to 06:00 next day
            start_mor = datetime.datetime.combine(date + datetime.timedelta(days=1), datetime.time(0, 0), tzinfo=TZ_CHART)
            end_mor = datetime.datetime.combine(date + datetime.timedelta(days=1), datetime.time(6, 0), tzinfo=TZ_CHART)
            ax.axvspan(float(mdates.date2num(start_mor)), float(mdates.date2num(end_mor)), color='lightgrey', alpha=0.3)
        # Temporary invisible bars to set axis limits
        temp_bars = ax.bar(times_num, height=[s - d for s, d in zip(sys_vals, dia_vals)], bottom=dia_vals, width=0.005, alpha=0, color="#d32f2f")
        ax2.plot(times_num, pulse_vals, color="#388e3c", label="Пульс", linewidth=2)
        ax.set_ylim(
            min(min(sys_vals), min(dia_vals)) - 5,
            max(max(sys_vals), max(dia_vals)) + 5,
        )
        ax2.set_ylim(min(pulse_vals) - 5, max(pulse_vals) + 5)
        ax.xaxis.set_major_formatter(
            mdates.DateFormatter("%Y-%m-%d\n%H:%M", tz=TZ_CHART)
        )
        ax.tick_params(axis="x", rotation=0, labelsize=6)
        ax.tick_params(axis='y', colors='red')
        ax2.tick_params(axis='y', colors='green')
        fig.tight_layout()
        # Calculate bar width for 5 pixels
        xlim = ax.get_xlim()
        pos = ax.get_position()
        fig_width, fig_height = fig.get_size_inches()
        dpi = fig.dpi
        axis_width_pixels = pos.width * fig_width * dpi
        data_range = xlim[1] - xlim[0]
        data_per_pixel = data_range / axis_width_pixels
        bar_width = 7 * data_per_pixel
        # Remove temp bars
        for bar in temp_bars:
            bar.remove()
        # Redraw bars with calculated width
        ax.bar(times_num, height=[s - d for s, d in zip(sys_vals, dia_vals)], bottom=dia_vals, width=bar_width, alpha=0.7, color=colors, label="Кровяное давление")
        # Add text labels after redrawing
        for i in range(len(times_num)):
            ax.text(times_num[i], sys_vals[i] + 2, str(sys_vals[i]), ha='center', va='bottom', fontsize=5, color='black')
            ax.text(times_num[i], dia_vals[i] - 2, str(dia_vals[i]), ha='center', va='top', fontsize=5, color='black')
    ax.set_ylabel("mmHg", color='red')
    ax2.set_ylabel("bpm", color='green')
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
):
    try:
        if line:
            parts = line.strip().split()
            if len(parts) != 3:
                raise ValueError('Формат ввода: "SYS DIA PULSE"')
            sys_v, dia_v, pul_v = map(int, parts)
        else:
            if sys_bp is None or dia_bp is None or pulse is None:
                raise ValueError("Нужно три значения: sys, dia, pulse")
            sys_v, dia_v, pul_v = sys_bp, dia_bp, pulse

        validate_values(sys_v, dia_v, pul_v)
        entry = {"t": now_utc_iso(), "sys": sys_v, "dia": dia_v, "pulse": pul_v}
        append_entry(entry)
        status_msg = "Сохранено"
    except ValueError as e:
        status_msg = f"Ошибка: {e}"

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
            },
        )
    # Иначе — обычный PRG (POST/Redirect/GET)
    return RedirectResponse(url="/", status_code=303)


@app.get("/chart/combined.png")
def chart_combined():
    entries = read_all()
    buf = plot_pressure(entries)
    return StreamingResponse(buf, media_type="image/png")

@app.get("/json")
def dump():
    entries = read_all()
    return entries

@app.get("/dump")
def dump_raw():
    if not os.path.exists(DATA_FILE):
        return Response("", media_type="text/plain")
    with open(DATA_FILE, "r", encoding="utf-8") as f:
        content = f.read()
    return Response(content, media_type="text/plain")
