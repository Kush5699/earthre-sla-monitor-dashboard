import urllib.request
import ssl
import json
import time

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

urls = [
    ("Dashboard HTML", "https://sla-monitor-dashboard.sla-monitor-backend.workers.dev/"),
    ("Frontend HTML", "https://sla-monitor-frontend.sla-monitor-backend.workers.dev/"),
    ("CSS Asset", "https://sla-monitor-dashboard.sla-monitor-backend.workers.dev/assets/index-Cz11nkms.css"),
    ("JS Asset", "https://sla-monitor-dashboard.sla-monitor-backend.workers.dev/assets/index-CUVKeo6j.js"),
    ("Backend Health", "https://sla-monitor-api.sla-monitor-backend.workers.dev/api/health"),
    ("Backend Uploads", "https://sla-monitor-api.sla-monitor-backend.workers.dev/api/uploads"),
    ("Backend Stats", "https://sla-monitor-api.sla-monitor-backend.workers.dev/api/stats"),
]

for label, url in urls:
    t0 = time.time()
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'})
        with urllib.request.urlopen(req, timeout=10, context=ctx) as res:
            data = res.read()
            dt = time.time() - t0
            print(f"[OK] {label}: {res.status} ({len(data)} bytes, {dt:.2f}s)")
    except Exception as e:
        dt = time.time() - t0
        print(f"[FAIL] {label}: {e} ({dt:.2f}s)")
