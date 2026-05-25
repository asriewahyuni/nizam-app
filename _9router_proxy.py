#!/usr/bin/env python3
"""
Simple reverse proxy: routes /9router/* and /router/* → localhost:20128
Runs on port 8099 (can be changed via env PORT_9ROUTER_PROXY)
"""
import os
import sys
import logging
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


def _filter_headers(request_headers):
    """
    Filter request headers, removing hop-by-hop and host-related headers.
    Keep Authorization, Content-Type, and other important headers.
    """
    hop_by_hop = {
        "host", "connection", "transfer-encoding", 
        "keep-alive", "proxy-authenticate", "proxy-authorization",
        "te", "trailer", "upgrade"
    }
    return {k: v for k, v in request_headers.items() if k.lower() not in hop_by_hop}


async def _proxy_request(target_url, request: Request):
    """
    Generic proxy handler: forward request to target URL and return response.
    """
    headers = _filter_headers(request.headers)
    
    try:
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            r = await client.request(
                method=request.method,
                url=target_url,
                headers=headers,
                content=await request.body(),
            )
        
        # Forward response headers (with filtering)
        response_headers = dict(r.headers)
        # Remove hop-by-hop response headers
        response_headers.pop("transfer-encoding", None)
        response_headers.pop("connection", None)
        
        return Response(
            content=r.text,
            status_code=r.status_code,
            media_type=r.headers.get("content-type", "text/html"),
            headers=response_headers,
        )
    except Exception as e:
        log.error(f"Proxy error for {target_url}: {e}")
        return Response(
            content=f"<h1>502 Bad Gateway</h1><p>Error: {e}</p>",
            status_code=502,
            media_type="text/html",
        )


@app.api_route("/9router{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"])
async def proxy_9router(request: Request, path: str = ""):
    """Proxy all /9router/* requests to 9Router backend."""
    target_url = f"{TARGET}/{path.lstrip('/')}"
    return await _proxy_request(target_url, request)


@app.api_route("/router{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"])
async def proxy_router(request: Request, path: str = ""):
    """Proxy all /router/* requests to 9Router backend."""
    target_url = f"{TARGET}/{path.lstrip('/')}"
    return await _proxy_request(target_url, request)


@app.get("/9router")
@app.get("/9router/")
async def index():
    return HTMLResponse("""<!DOCTYPE html>
<html><head><title>9Router</title></head>
<body style="font-family:system-ui;text-align:center;padding:60px">
<h1>🚀 9Router Dashboard</h1>
<p><a href="/9router/dashboard" style="font-size:1.3em">Go to 9Router Dashboard →</a></p>
<p><a href="/router/dashboard" style="font-size:1.3em">Go to Router Dashboard →</a></p>
</body></html>""")


@app.get("/router")
@app.get("/router/")
async def router_index():
    return HTMLResponse("""<!DOCTYPE html>
<html><head><title>Router</title></head>
<body style="font-family:system-ui;text-align:center;padding:60px">
<h1>🚀 Router (via /router)</h1>
<p><a href="/router/dashboard" style="font-size:1.3em">Go to Dashboard →</a></p>
</body></html>""")


if __name__ == "__main__":
    import uvicorn
    PORT = int(os.environ.get("PORT_9ROUTER_PROXY", "8088"))
    uvicorn.run(app, host="0.0.0.0", port=PORT)
    print(f"\n✅ 9Router Proxy running at http://localhost:{PORT}/9router/dashboard\n")
