#!/usr/bin/env python3
"""
Multi-route proxy: 
  /router/* → localhost:20128
  /* → localhost:8089 (QwenPaw, yang dijalankan di port 8089)
  
Runs on port 8088 (main port)
"""
import os
import sys
import logging
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse
import urllib.request
import urllib.error
import io

QWENPAW_HOST = "localhost"
QWENPAW_PORT = 8089
ROUTER_HOST = "localhost"
ROUTER_PORT = 20128

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class MultiRouterHandler(BaseHTTPRequestHandler):
    def route_request(self, method):
        """Route request based on path."""
        path = self.path
        query = ""
        
        if "?" in path:
            path, query = path.split("?", 1)
            query = "?" + query
        
        # Determine target
        if path.startswith("/router"):
            target_host = ROUTER_HOST
            target_port = ROUTER_PORT
            target_path = path[7:]  # Remove /router prefix
            service = "Router"
        else:
            target_host = QWENPAW_HOST
            target_port = QWENPAW_PORT
            target_path = path
            service = "QwenPaw"
        
        target_url = f"http://{target_host}:{target_port}{target_path}{query}"
        
        # Prepare headers
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
            
            # Send response back
            self.send_response(status)
            for key, value in resp_headers.items():
                if key.lower() not in {"transfer-encoding", "content-encoding"}:
                    self.send_header(key, value)
            self.end_headers()
            self.wfile.write(resp_body)
            
            logger.info(f"{method} {self.path} [{service}] → {status}")
            
        except urllib.error.HTTPError as e:
            error_body = e.read()
            self.send_response(e.code)
            self.send_header("Content-Type", e.headers.get("Content-Type", "text/html"))
            self.end_headers()
            self.wfile.write(error_body)
            logger.error(f"HTTP {e.code} for {target_url}")
            
        except Exception as e:
            self.send_response(502)
            self.send_header("Content-Type", "text/html")
            self.end_headers()
            msg = f"<h1>502 Bad Gateway</h1><p>Error proxying to {service} ({target_host}:{target_port})<br/><pre>{e}</pre></p>".encode()
            self.wfile.write(msg)
            logger.error(f"Proxy error ({service}): {e}")

    def do_GET(self):
        self.route_request("GET")

    def do_POST(self):
        self.route_request("POST")

    def do_PUT(self):
        self.route_request("PUT")

    def do_DELETE(self):
        self.route_request("DELETE")

    def do_PATCH(self):
        self.route_request("PATCH")

    def do_HEAD(self):
        self.route_request("HEAD")

    def do_OPTIONS(self):
        self.route_request("OPTIONS")

    def log_message(self, format, *args):
        """Suppress default logging."""
        pass


if __name__ == "__main__":
    PORT = int(os.environ.get("PORT_MULTI_ROUTER", "8088"))
    
    logger.info(f"""
╔════════════════════════════════════════════════════════════════╗
║            Multi-Router Proxy v1.0                             ║
╠════════════════════════════════════════════════════════════════╣
║                                                                 ║
║  Main Port: {PORT}                                              ║
║  /router/* → {ROUTER_HOST}:{ROUTER_PORT}                                  ║
║  /* → {QWENPAW_HOST}:{QWENPAW_PORT} (QwenPaw)                                   ║
║                                                                 ║
║  Ready to serve requests...                                    ║
╚════════════════════════════════════════════════════════════════╝
    """)
    
    server = HTTPServer(("0.0.0.0", PORT), MultiRouterHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        logger.info("Shutting down...")
        server.shutdown()
