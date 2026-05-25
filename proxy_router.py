#!/usr/bin/env python3
"""
Lightweight proxy: /router → localhost:20128
Runs on port specified by PORT_ROUTER_PROXY env var (default 8089)
"""
import os
import sys
import logging
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, urljoin
import urllib.request
import urllib.error

TARGET_HOST = os.environ.get("PROXY_TARGET_HOST", "localhost")
TARGET_PORT = int(os.environ.get("PROXY_TARGET_PORT", "20128"))
LISTEN_PORT = int(os.environ.get("PORT_ROUTER_PROXY", "8089"))

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class ProxyHandler(BaseHTTPRequestHandler):
    def do_request(self, method):
        """Handle any HTTP method by proxying to target."""
        # Build target URL
        path = self.path
        if path.startswith("/router"):
            path = path[7:]  # Remove /router prefix
        
        target_url = f"http://{TARGET_HOST}:{TARGET_PORT}{path}"
        
        # Prepare headers (skip hop-by-hop headers)
        headers = {}
        skip_headers = {"host", "connection", "content-length", "transfer-encoding"}
        for key, value in self.headers.items():
            if key.lower() not in skip_headers:
                headers[key] = value
        
        # Get body
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length) if content_length > 0 else b""
        
        try:
            # Make request to target
            req = urllib.request.Request(
                target_url,
                data=body if body else None,
                headers=headers,
                method=method
            )
            
            with urllib.request.urlopen(req, timeout=30) as response:
                status = response.status
                resp_headers = dict(response.headers)
                resp_body = response.read()
            
            # Send response back to client
            self.send_response(status)
            for key, value in resp_headers.items():
                if key.lower() not in {"transfer-encoding", "content-encoding"}:
                    self.send_header(key, value)
            self.end_headers()
            self.wfile.write(resp_body)
            
            logger.info(f"{method} {self.path} → {status}")
            
        except urllib.error.HTTPError as e:
            self.send_response(e.code)
            self.send_header("Content-Type", "text/html")
            self.end_headers()
            self.wfile.write(e.read())
            logger.error(f"HTTP Error: {e.code} for {target_url}")
            
        except Exception as e:
            self.send_response(502)
            self.send_header("Content-Type", "text/html")
            self.end_headers()
            msg = f"<h1>502 Bad Gateway</h1><p>{e}</p>".encode()
            self.wfile.write(msg)
            logger.error(f"Proxy error: {e}")

    def do_GET(self):
        if self.path.startswith("/router"):
            self.do_request("GET")
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        if self.path.startswith("/router"):
            self.do_request("POST")
        else:
            self.send_response(404)
            self.end_headers()

    def do_PUT(self):
        if self.path.startswith("/router"):
            self.do_request("PUT")
        else:
            self.send_response(404)
            self.end_headers()

    def do_DELETE(self):
        if self.path.startswith("/router"):
            self.do_request("DELETE")
        else:
            self.send_response(404)
            self.end_headers()

    def do_PATCH(self):
        if self.path.startswith("/router"):
            self.do_request("PATCH")
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, format, *args):
        """Suppress default logging to avoid noise."""
        pass


if __name__ == "__main__":
    server = HTTPServer(("0.0.0.0", LISTEN_PORT), ProxyHandler)
    logger.info(f"✅ Proxy running: http://0.0.0.0:{LISTEN_PORT}/router → {TARGET_HOST}:{TARGET_PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        logger.info("Shutting down...")
        server.shutdown()
