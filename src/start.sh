#!/bin/bash
set -e

# Ensure fallback DNS resolvers are present (Railway containers sometimes
# lack reliable DNS, causing resolution failures for less-common domains).
if ! grep -q '8.8.8.8' /etc/resolv.conf 2>/dev/null; then
  echo "nameserver 8.8.8.8" >> /etc/resolv.conf
  echo "nameserver 1.1.1.1" >> /etc/resolv.conf
  echo "[dns] Added fallback resolvers (8.8.8.8, 1.1.1.1)"
fi

# Start the wrapper as the main process.
exec node src/server.js
