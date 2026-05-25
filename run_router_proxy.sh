#!/bin/bash
# Run router proxy on port 8089
cd /app/working/workspaces/default/nizam-app
export PORT_ROUTER_PROXY=8089
export PROXY_TARGET_HOST=localhost
export PROXY_TARGET_PORT=20128

nohup python3 proxy_router.py > /tmp/router_proxy.log 2>&1 &
echo $! > /tmp/router_proxy.pid
echo "Router proxy started with PID: $(cat /tmp/router_proxy.pid)"
echo "Access at: http://localhost:8089/router/"
