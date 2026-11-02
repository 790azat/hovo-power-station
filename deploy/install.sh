#!/usr/bin/env bash
# Hovo Power server: install or update on a fresh Ubuntu 22.04/24.04 VPS.
#   curl -fsSL https://raw.githubusercontent.com/790azat/hovo-power-station/main/deploy/install.sh | sudo bash
# Optional: DOMAIN=api.hovo.am (otherwise <ip>.sslip.io is used, which still gets a real https certificate)
set -euo pipefail
REPO=https://github.com/790azat/hovo-power-station.git
DIR=/opt/hovo

echo "==> Packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq curl git ca-certificates gnupg debian-keyring debian-archive-keyring apt-transport-https ufw >/dev/null

if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 22 ]; then
  echo "==> Node.js 22"
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null
  apt-get install -y -qq nodejs >/dev/null
fi

if ! command -v caddy >/dev/null; then
  echo "==> Caddy (https)"
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/gpg.key | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -qq && apt-get install -y -qq caddy >/dev/null
fi

echo "==> Code"
if [ -d "$DIR/src/.git" ]; then git -C "$DIR/src" pull -q; else git clone -q --depth 1 "$REPO" "$DIR/src"; fi
rm -rf "$DIR/web" && git clone -q --depth 1 --branch web-live "$REPO" "$DIR/web"
(cd "$DIR/src/server" && npm ci --omit=dev --silent)
mkdir -p "$DIR/data"

IP=$(curl -fsS https://api.ipify.org || hostname -I | awk '{print $1}')
DOMAIN=${DOMAIN:-$(echo "$IP" | tr . -).sslip.io}

if [ ! -f /etc/hovo.env ]; then
  echo "==> Settings /etc/hovo.env (test payments until you add Idram/bank keys)"
  cat > /etc/hovo.env <<ENV
PORT=8080
PUBLIC_URL=https://$DOMAIN
DB_FILE=$DIR/data/hovo.db
WEB_DIR=$DIR/web
IDRAM_MOCK=1
IDRAM_REC_ACCOUNT=
IDRAM_SECRET_KEY=
CARD_MOCK=1
CARD_GATEWAY_USERNAME=
CARD_GATEWAY_PASSWORD=
ENV
fi

cat > /etc/systemd/system/hovo.service <<UNIT
[Unit]
Description=Hovo Power server
After=network.target
[Service]
EnvironmentFile=/etc/hovo.env
WorkingDirectory=$DIR/src/server
ExecStart=/usr/bin/node --disable-warning=ExperimentalWarning src/index.ts
Restart=always
RestartSec=3
[Install]
WantedBy=multi-user.target
UNIT

cat > /etc/caddy/Caddyfile <<CADDY
$DOMAIN {
  encode gzip
  reverse_proxy 127.0.0.1:8080
}
CADDY

ufw allow OpenSSH >/dev/null; ufw allow 80 >/dev/null; ufw allow 443 >/dev/null; ufw --force enable >/dev/null

systemctl daemon-reload
systemctl enable -q --now hovo
systemctl restart hovo caddy

echo
echo "Done."
echo "  App (open on the phone, add to Home Screen): https://$DOMAIN"
echo "  Charger OCPP URL:                            wss://$DOMAIN/ocpp/HOVO-001"
echo "  Settings: /etc/hovo.env   then: systemctl restart hovo"
echo "  Logs:     journalctl -u hovo -f"
