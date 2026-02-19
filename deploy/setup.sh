#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
SERVICE_NAME="rcc"
SERVICE_FILE="$SCRIPT_DIR/rcc.service"
SYSTEMD_DIR="/etc/systemd/system"

echo "=== Remote Claude Code Deployment Setup ==="
echo "Project directory: $PROJECT_DIR"
echo ""

# 1. 프로젝트 빌드
echo "[1/4] Installing dependencies..."
cd "$PROJECT_DIR"
npm ci

echo "[2/4] Building project..."
npm run build

# 3. systemd 서비스 파일 설치
echo "[3/4] Installing systemd service..."

CURRENT_USER="$(whoami)"
NODE_PATH="$(which node)"
NODE_BIN="$(dirname "$NODE_PATH")"
NODE_VERSION="$(basename "$(dirname "$(dirname "$NODE_PATH")")")"
CLAUDE_BIN="$(dirname "$(which claude 2>/dev/null || echo "/usr/local/bin/claude")")"

echo "  Detected node: $NODE_PATH ($(node -v))"
echo "  Detected claude: $(which claude 2>/dev/null || echo 'not found')"

# 템플릿에서 실제 경로로 치환하여 임시 파일 생성
TEMP_SERVICE=$(mktemp)
sed \
    -e "s|User=<your-user>|User=$CURRENT_USER|g" \
    -e "s|WorkingDirectory=/path/to/remote-claude-code|WorkingDirectory=$PROJECT_DIR|g" \
    -e "s|EnvironmentFile=/path/to/remote-claude-code/.env|EnvironmentFile=$PROJECT_DIR/.env|g" \
    -e "s|/home/<your-user>/.nvm/versions/node/<node-version>/bin/node|$NODE_PATH|g" \
    -e "s|/home/<your-user>/.nvm/versions/node/<node-version>/bin|$NODE_BIN|g" \
    -e "s|/home/<your-user>/.local/bin|/home/$CURRENT_USER/.local/bin|g" \
    "$SERVICE_FILE" > "$TEMP_SERVICE"

sudo cp "$TEMP_SERVICE" "$SYSTEMD_DIR/$SERVICE_NAME.service"
rm "$TEMP_SERVICE"

echo "  Service file installed to $SYSTEMD_DIR/$SERVICE_NAME.service"

# 4. systemd 데몬 리로드 + 서비스 활성화 + 시작
echo "[4/4] Starting service..."
sudo systemctl daemon-reload
sudo systemctl enable "$SERVICE_NAME"
sudo systemctl restart "$SERVICE_NAME"

echo ""
echo "=== Setup Complete ==="
echo ""
sudo systemctl status "$SERVICE_NAME" --no-pager
echo ""
echo "Useful commands:"
echo "  sudo systemctl status $SERVICE_NAME    # 상태 확인"
echo "  sudo systemctl restart $SERVICE_NAME   # 재시작"
echo "  journalctl -u $SERVICE_NAME -f         # 실시간 로그"
