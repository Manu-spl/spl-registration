#!/bin/bash
set -euo pipefail
SRC="${DATA_DIR:-/var/www/spl/data}"
DEST=/var/backups/spl
mkdir -p "$DEST"
STAMP=$(date +%Y%m%d)
tar -czf "$DEST/spl-$STAMP.tar.gz" -C "$SRC" .
ls -1t "$DEST"/spl-*.tar.gz | tail -n +8 | xargs -r rm -f
echo "backup ok $DEST/spl-$STAMP.tar.gz"
