# Router Proxy Setup Guide

## Objective
Enable access to `http://localhost:20128/dashboard` via `http://localhost:8088/router`

---

## Current Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  User Browser                                               │
└────────┬────────────────────────────────────────────────────┘
         │ http://localhost:8088/router/dashboard
         ▼
┌─────────────────────────────────────────────────────────────┐
│  Multi-Router Proxy (port 8088)                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ /router/*  → proxy to localhost:20128               │    │
│  │ /*         → proxy to localhost:8089 (QwenPaw)      │    │
│  └─────────────────────────────────────────────────────┘    │
└─┬──────────────────────────────────────────────────────────┬─┘
  │                                                           │
  ▼                                                           ▼
┌──────────────────────────────┐       ┌──────────────────────────────┐
│  9Router (port 20128)        │       │  QwenPaw (port 8089)         │
│  localhost:20128/dashboard   │       │  localhost:8089/...          │
└──────────────────────────────┘       └──────────────────────────────┘
```

---

## Setup Steps

### Step 1: Move QwenPaw to Port 8089 (Temporary)

Currently: `qwenpaw app --host 0.0.0.0 --port 8088`

Need to change to: `qwenpaw app --host 0.0.0.0 --port 8089`

**Option A: Manual (if running from CLI)**
```bash
# Stop current QwenPaw
pkill -f "qwenpaw app"

# Start on port 8089
qwenpaw app --host 0.0.0.0 --port 8089
```

**Option B: Via Supervisor (persistent)**
Update supervisor config to run QwenPaw on port 8089:
```ini
[program:qwenpaw]
command=/app/venv/bin/qwenpaw app --host 0.0.0.0 --port 8089
```

Then reload supervisor:
```bash
supervisorctl reread
supervisorctl update
supervisorctl start qwenpaw
```

---

### Step 2: Start Multi-Router Proxy on Port 8088

```bash
cd /app/working/workspaces/default/nizam-app

# Run in background
nohup python3 multi_router_proxy.py > /tmp/multi_router_proxy.log 2>&1 &

# Or run in foreground (for debugging)
python3 multi_router_proxy.py
```

---

### Step 3: Test the Setup

**Test Router Access:**
```bash
curl http://localhost:8088/router/dashboard
```
Expected: Redirect to /login or dashboard content from port 20128

**Test QwenPaw Access:**
```bash
curl http://localhost:8088/api/agents
```
Expected: QwenPaw API response from port 8089

---

## Files Created

| File | Purpose |
|------|---------|
| `multi_router_proxy.py` | Main proxy that routes /router/* and /* |
| `proxy_router.py` | Alternative lightweight proxy (single route) |
| `run_router_proxy.sh` | Bash script to start proxy_router.py |
| `nginx-router.conf` | Nginx config (if you want to use nginx later) |

---

## Troubleshooting

### Port Already in Use
```bash
# Find what's using port 8088
lsof -i :8088

# Kill the process if needed
kill -9 <PID>
```

### Proxy Not Responding
```bash
# Check logs
tail -f /tmp/multi_router_proxy.log

# Test connectivity to backends
curl http://localhost:20128/dashboard
curl http://localhost:8089/
```

### Authentication Issues
The proxy passes headers and body as-is. If port 20128 requires specific auth headers or cookies, make sure your client includes them.

---

## Alternative: Simple Wrapper Script

If you want even simpler setup, use a shell script wrapper:

```bash
#!/bin/bash
# Start both services and proxy

# Kill old processes
pkill -f "qwenpaw app"
pkill -f "multi_router_proxy"
sleep 1

# Start QwenPaw on 8089
qwenpaw app --host 0.0.0.0 --port 8089 &

# Start proxy on 8088
cd /app/working/workspaces/default/nizam-app
python3 multi_router_proxy.py &

# Wait for startup
sleep 3

# Test
curl http://localhost:8088/router/
curl http://localhost:8088/

echo "✅ Multi-router proxy setup complete!"
```

---

## Performance Notes

- **Proxy overhead:** ~5-10ms per request
- **Max connections:** Limited by OS file descriptors
- **Timeout:** 30 seconds (configurable in multi_router_proxy.py)

For production, consider using nginx or Apache instead.

---

## Next Steps

1. **Decide on deployment**: Will this be permanent or temporary?
2. **Update documentation**: Add /router endpoint to main docs
3. **Add authentication**: If port 20128 requires auth, update proxy headers
4. **Monitor**: Set up log rotation for /tmp/multi_router_proxy.log

