#!/bin/bash
ulimit -n 65536
cd /app/working/workspaces/default/nizam-app
PORT=3000 npx next dev --webpack -p 3000
