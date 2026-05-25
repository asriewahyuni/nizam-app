#!/bin/bash
set -e

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║        Router Proxy Setup - Automated                          ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if running as root (needed for binding to port 8088)
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}❌ This script must be run as root (for binding to port 8088)${NC}"
   echo "   Run with: sudo bash setup_router_proxy.sh"
   exit 1
fi

# Function to check if port is in use
check_port() {
    local port=$1
    if lsof -i :$port > /dev/null 2>&1; then
        return 0  # Port in use
    else
        return 1  # Port free
    fi
}

# Function to kill process on port
kill_port() {
    local port=$1
    echo -e "${YELLOW}⚠️  Port $port is in use. Attempting to free it...${NC}"
    local pid=$(lsof -ti:$port)
    if [ ! -z "$pid" ]; then
        kill -9 $pid 2>/dev/null || true
        sleep 1
        echo -e "${GREEN}✅ Port $port freed${NC}"
    fi
}

# Step 1: Check ports
echo -e "${BLUE}Step 1: Checking ports...${NC}"
if check_port 8088; then
    kill_port 8088
fi

if ! check_port 8089; then
    echo -e "${GREEN}✅ Port 8089 is free${NC}"
else
    echo -e "${RED}❌ Port 8089 is in use${NC}"
    exit 1
fi

# Step 2: Verify files exist
echo ""
echo -e "${BLUE}Step 2: Verifying files...${NC}"
if [ ! -f "multi_router_proxy.py" ]; then
    echo -e "${RED}❌ multi_router_proxy.py not found${NC}"
    exit 1
fi
echo -e "${GREEN}✅ multi_router_proxy.py exists${NC}"

# Step 3: Kill old QwenPaw (if on port 8088)
echo ""
echo -e "${BLUE}Step 3: Stopping QwenPaw from port 8088...${NC}"
if check_port 8088; then
    kill_port 8088
fi
# Also kill any qwenpaw process that might be running
pkill -f "qwenpaw app" || true
sleep 1
echo -e "${GREEN}✅ QwenPaw stopped${NC}"

# Step 4: Start QwenPaw on port 8089
echo ""
echo -e "${BLUE}Step 4: Starting QwenPaw on port 8089...${NC}"
nohup /app/venv/bin/qwenpaw app --host 0.0.0.0 --port 8089 > /tmp/qwenpaw_8089.log 2>&1 &
QWENPAW_PID=$!
echo "QwenPaw PID: $QWENPAW_PID"
sleep 3

# Check if QwenPaw started
if ps -p $QWENPAW_PID > /dev/null; then
    echo -e "${GREEN}✅ QwenPaw started (PID: $QWENPAW_PID)${NC}"
else
    echo -e "${RED}❌ QwenPaw failed to start${NC}"
    cat /tmp/qwenpaw_8089.log | tail -20
    exit 1
fi

# Step 5: Start Multi-Router Proxy
echo ""
echo -e "${BLUE}Step 5: Starting Multi-Router Proxy on port 8088...${NC}"
cd /app/working/workspaces/default/nizam-app
nohup python3 multi_router_proxy.py > /tmp/multi_router_proxy.log 2>&1 &
PROXY_PID=$!
echo "Proxy PID: $PROXY_PID"
sleep 2

if ps -p $PROXY_PID > /dev/null; then
    echo -e "${GREEN}✅ Proxy started (PID: $PROXY_PID)${NC}"
else
    echo -e "${RED}❌ Proxy failed to start${NC}"
    cat /tmp/multi_router_proxy.log | tail -20
    exit 1
fi

# Step 6: Run tests
echo ""
echo -e "${BLUE}Step 6: Running connectivity tests...${NC}"

echo "  Testing /router/ endpoint..."
if curl -s http://localhost:8088/router/ > /dev/null 2>&1; then
    echo -e "  ${GREEN}✅ /router/ is accessible${NC}"
else
    echo -e "  ${YELLOW}⚠️  /router/ not responding (may require auth or be slow)${NC}"
fi

echo "  Testing / endpoint (QwenPaw)..."
if curl -s http://localhost:8088/ > /dev/null 2>&1; then
    echo -e "  ${GREEN}✅ / (QwenPaw) is accessible${NC}"
else
    echo -e "  ${YELLOW}⚠️  / not responding${NC}"
fi

# Step 7: Save PIDs to file
echo ""
echo -e "${BLUE}Step 7: Saving process info...${NC}"
cat > /tmp/router_proxy_info.txt <<EOF
Multi-Router Proxy Setup
Generated: $(date)

QwenPaw:
  Port: 8089
  PID: $QWENPAW_PID
  Log: /tmp/qwenpaw_8089.log

Multi-Router Proxy:
  Port: 8088
  PID: $PROXY_PID
  Log: /tmp/multi_router_proxy.log

Routes:
  /router/* → localhost:20128 (9Router)
  /*        → localhost:8089 (QwenPaw)

To stop services:
  kill $QWENPAW_PID    # Stop QwenPaw
  kill $PROXY_PID      # Stop Proxy

To restart:
  bash setup_router_proxy.sh
EOF
echo -e "${GREEN}✅ Process info saved to /tmp/router_proxy_info.txt${NC}"

# Final summary
echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                 🎉 Setup Complete!                             ║${NC}"
echo -e "${GREEN}╠════════════════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║                                                                ║${NC}"
echo -e "${GREEN}║  Access Points:                                                ║${NC}"
echo -e "${GREEN}║  • QwenPaw:  http://localhost:8088/                            ║${NC}"
echo -e "${GREEN}║  • Router:   http://localhost:8088/router/                     ║${NC}"
echo -e "${GREEN}║  • Router Dashboard: http://localhost:8088/router/dashboard    ║${NC}"
echo -e "${GREEN}║                                                                ║${NC}"
echo -e "${GREEN}║  PIDs:                                                         ║${NC}"
echo -e "${GREEN}║  • QwenPaw Proxy: $QWENPAW_PID                                      ║${NC}"
echo -e "${GREEN}║  • Router Proxy:  $PROXY_PID                                       ║${NC}"
echo -e "${GREEN}║                                                                ║${NC}"
echo -e "${GREEN}║  Logs:                                                         ║${NC}"
echo -e "${GREEN}║  • QwenPaw: /tmp/qwenpaw_8089.log                              ║${NC}"
echo -e "${GREEN}║  • Proxy:   /tmp/multi_router_proxy.log                        ║${NC}"
echo -e "${GREEN}║                                                                ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "Next steps:"
echo "  1. Open browser: http://localhost:8088/"
echo "  2. Check logs if any issues: tail -f /tmp/multi_router_proxy.log"
echo "  3. Stop services: cat /tmp/router_proxy_info.txt"
echo ""
