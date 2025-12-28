# load json objects from data/bp.ndjson
import json
def load_bp_data(filepath='data/bp.ndjson'):
    data = []
    with open(filepath, 'r') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('{ --- IGNORE ---'):
                data.append(json.loads(line))
    return data

if __name__ == '__main__':
    bp_data = load_bp_data()
    for entry in bp_data:
        # convert 't' to datetime object and print it as it is in local Shanghai time
        from datetime import datetime
        import pytz
        shanghai_tz = pytz.timezone('Asia/Shanghai')
        t_utc = datetime.fromisoformat(entry['t'].replace('Z', '+00:00'))
        t_local = t_utc.astimezone(shanghai_tz)
        # print(f"Local time: {t_local.strftime('%Y-%m-%dT%H:%M:%S+08:00')}")
        entry["local_tz"] = "Asia/Shanghai"
        entry['t'] = t_local.strftime('%Y-%m-%dT%H:%M:%S+08:00')
        print(entry)

    # save bp_data back to data/bp_converted.ndjson
    with open('data/bp_converted.ndjson', 'w') as f:
        for entry in bp_data:
            f.write(json.dumps(entry) + '\n')