#!/bin/bash
# Start everything needed for the plan pinning prototype:
# 1. CockroachDB demo with movr workload data
# 2. Continuous movr workload (keeps statement stats fresh)
# 3. cluster-ui build
# 4. webpack dev server
#
# Usage: ./start-dev.sh
# Stop:  Ctrl+C (kills all background processes)

set -e

COCKROACH=/tmp/cockroach-v24.3.5.darwin-11.0-arm64/cockroach
CLUSTER_UI_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
DB_CONSOLE_DIR="$(cd "$CLUSTER_UI_DIR/../db-console" && pwd)"

cleanup() {
  echo ""
  echo "Shutting down..."
  kill $COCKROACH_PID $WORKLOAD_PID $WEBPACK_PID 2>/dev/null
  wait 2>/dev/null
  echo "Done."
}
trap cleanup EXIT INT TERM

# Check cockroach binary
if [ ! -f "$COCKROACH" ]; then
  echo "Error: cockroach binary not found at $COCKROACH"
  echo "Download v24.3.5 from https://www.cockroachlabs.com/docs/releases/"
  exit 1
fi

# 1. Start CockroachDB demo
echo "Starting CockroachDB demo with movr..."
$COCKROACH demo movr --no-example-database=false --insecure &
COCKROACH_PID=$!
sleep 3

# Wait for CockroachDB to be ready
for i in {1..10}; do
  if curl -s http://localhost:8080/ > /dev/null 2>&1; then
    echo "CockroachDB ready on :8080"
    break
  fi
  sleep 1
done

# 2. Start continuous movr workload (restarts every 10 min)
echo "Starting continuous movr workload..."
(
  while true; do
    $COCKROACH workload run movr --duration=600s --concurrency=4 \
      'postgresql://root@localhost:26257/movr?sslmode=disable' 2>/dev/null
    echo "Workload cycle complete, restarting..."
    sleep 1
  done
) &
WORKLOAD_PID=$!

# 3. Build cluster-ui
echo "Building cluster-ui..."
cd "$CLUSTER_UI_DIR"
npx webpack --mode=development 2>&1 | tail -1

# 4. Start webpack dev server
echo "Starting webpack dev server on :3333..."
cd "$DB_CONSOLE_DIR"
./node_modules/.bin/webpack serve \
  --config webpack.config.js \
  --mode=development \
  --port 3333 \
  --env target=http://localhost:8080 \
  --env dist="" &
WEBPACK_PID=$!

sleep 3
echo ""
echo "========================================="
echo "  Plan Pinning Prototype Ready!"
echo "  http://localhost:3333/#/sql-activity?tab=Pinned+plans"
echo "========================================="
echo ""
echo "Press Ctrl+C to stop all services."

# Wait for any process to exit
wait
