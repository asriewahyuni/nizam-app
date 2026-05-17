#!/usr/bin/env python3
"""
Simple reverse proxy: routes /9router/* → localhost:20128
Runs on port 8099 (can be changed via env PORT_9ROUTER_PROXY)
"""
import os, sys, logging
from fastapi import FastAPI, Request
from fastapi.responses import Response, HTMLResponse
import httpx

TARGET = os.environ.get("PROXY_TARGET", "http://localhost:20128")

app = FastAPI(title="9Router Proxy")
log = logging.getLogger(__name__)
log.setLevel(logging.INFO)
if not log.handlers:
    h = logging.StreamHandler(sys.stderr)
    h.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
    log.addHandler(h)

@app.api_route("/9router{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"])
async def proxy(request: Request, path: str = ""):
    """Proxy all /9router/* requests to 9Router backend."""
    target_url = f"{TARGET}/{path}"
    headers = {k: v for k, v in request.headers.items() 
               if k.lower() not in ("host", "connection", "transfer-encoding")}
    
    try:
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            r = await client.request(
                method=request.method,
                url=target_url,
                headers=headers,
                content=await request.body(),
            )
        return Response(
            content=r.text,
            status_code=r.status_code,
            media_type=r.headers.get("content-type", "text/html"),
            headers=dict(r.headers),
        )
    except Exception as e:
        log.error(f"Proxy error: {e}")
        return Response(
            content=f"<h1>502 Bad Gateway</h1><p>{e}</p>",
            status_code=502,
            media_type="text/html",
        )

@app.get("/9router")
@app.get("/9router/")
async def index():
    return HTMLResponse("""<!DOCTYPE html>
<html><head><title>9Router</title></head>
<body style="font-family:system-ui;text-align:center;padding:60px">
<h1>🚀 9Router Dashboard</h1>
<p><a href="/9router/dashboard" style="font-size:1.3em">Go to Dashboard →</a></p>
</body></html>""")

PORT = int(os.environ.get("PORT_9ROUTER_PROXY", "8099"))
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=PORT)
    print(f"\n✅ 9Router Proxy running at http://0.0.0.0:{PORT}/9router/dashboard\n")
