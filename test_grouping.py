import json
from datetime import datetime, timedelta
from app.main import parse_iso, group_measurements_by_date

# Load data from NDJSON file
data_file = "data/bp.ndjson"
entries = []
with open(data_file, "r", encoding="utf-8") as f:
    for line in f:
        line = line.strip()
        if not line:
            continue
        entries.append(json.loads(line))

# Group by date using new algorithm
grouped = group_measurements_by_date(entries)

# Print first 10 days to verify
print("First 10 days of grouped data:")
print("-" * 100)
print(
    f"{'Date':<15} {'Morning Time':<20} {'Morning BP':<20} {'Evening Time':<20} {'Evening BP':<20}"
)
print("-" * 100)

for day in grouped[:10]:
    morning_time = (
        f"{parse_iso(day['morning']['t']).strftime('%H:%M')}"
        if day["morning"]
        else "N/A"
    )
    morning_bp = (
        f"{day['morning']['sys']}/{day['morning']['dia']}" if day["morning"] else "N/A"
    )
    evening_time = (
        f"{parse_iso(day['evening']['t']).strftime('%H:%M')}"
        if day["evening"]
        else "N/A"
    )
    evening_bp = (
        f"{day['evening']['sys']}/{day['evening']['dia']}" if day["evening"] else "N/A"
    )

    print(
        f"{day['date']:<15} {morning_time:<20} {morning_bp:<20} {evening_time:<20} {evening_bp:<20}"
    )

print("\n" + "=" * 100)
print("Verification of key test cases:")
print("=" * 100)

# Test case 1: 2025-11-16 (should have evening only, no morning)
day_1116 = next((d for d in grouped if d["date"] == "2025-11-16"), None)
if day_1116:
    print(f"\n2025-11-16:")
    print(f"  Morning: {day_1116['morning']['t'] if day_1116['morning'] else 'None'}")
    print(f"  Evening: {day_1116['evening']['t'] if day_1116['evening'] else 'None'}")
    print(f"  Expected: Morning=None, Evening=22:34:40 (within 21:00-03:00)")

# Test case 2: 2025-11-17 (should have morning at 09:19:21, evening at 22:13:31)
day_1117 = next((d for d in grouped if d["date"] == "2025-11-17"), None)
if day_1117:
    print(f"\n2025-11-17:")
    print(f"  Morning: {day_1117['morning']['t'] if day_1117['morning'] else 'None'}")
    print(f"  Evening: {day_1117['evening']['t'] if day_1117['evening'] else 'None'}")
    print(f"  Expected: Morning=09:19:21, Evening=22:13:31")

# Test case 3: 2025-11-26 (has 12:14:14 which should NOT be morning)
day_1126 = next((d for d in grouped if d["date"] == "2025-11-26"), None)
if day_1126:
    print(f"\n2025-11-26:")
    print(f"  Morning: {day_1126['morning']['t'] if day_1126['morning'] else 'None'}")
    print(f"  Evening: {day_1126['evening']['t'] if day_1126['evening'] else 'None'}")
    print(f"  Expected: Morning=11:06:56 (not 12:14:14), Evening=22:59:14")

# Test case 4: 2026-01-20 (Moscow timezone)
day_0120 = next((d for d in grouped if d["date"] == "2026-01-20"), None)
if day_0120:
    print(f"\n2026-01-20:")
    print(f"  Morning: {day_0120['morning']['t'] if day_0120['morning'] else 'None'}")
    print(f"  Evening: {day_0120['evening']['t'] if day_0120['evening'] else 'None'}")
    print(f"  Expected: Morning=08:31:25, Evening=23:18:27")

print("\n" + "=" * 100)
