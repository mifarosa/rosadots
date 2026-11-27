#!/usr/bin/env bash
# Rosadots online sunucusu kurulumu (Debian, Ubuntu, Raspberry Pi OS).
#
# Tek komutla kurar: Node.js, kod, bağımlılıklar, .env, Caddy (otomatik TLS), güvenlik duvarı
# ve sürekli çalışan servis. Depoyu indirip içinden çalıştır:
#   git clone https://github.com/mifarosa/rosadots ~/rosadots && bash ~/rosadots/server/install.sh
#
# Tekrar çalıştırmak güvenlidir: .env korunur, kod güncellenir, Caddy ve servis ayarı yenilenir.
#
# Ortam değişkenleri (hepsi isteğe bağlı):
#   ROSADOTS_DOMAIN    alan adı (varsayılan rosadots.mifarosa.com; verilmezse sorulur)
#   ROSADOTS_DIR       kodun yeri (varsayılan /opt/rosadots; betik bir depo içinden çalışıyorsa o depo)
#   ROSADOTS_BRANCH    hangi dal (varsayılan: deponun varsayılan dalı)
#   ROSADOTS_USER      servisin çalışacağı kullanıcı (varsayılan: betiği çalıştıran kullanıcı)
#   ROSADOTS_NO_SYSTEMD=1, ROSADOTS_SKIP_CADDY=1, ROSADOTS_SKIP_FIREWALL=1, ROSADOTS_SKIP_CHECK=1
#   Testler için: ROSADOTS_SKIP_NPM=1, ROSADOTS_NO_SUDO=1, ROSADOTS_UNIT_PATH=<dosya>,
#   ROSADOTS_CADDYFILE=<dosya>, ROSADOTS_NODE_PREFIX, ROSADOTS_NODE_BINDIR (bkz. server/src/install.test.ts)
set -euo pipefail

REPO_URL=${ROSADOTS_REPO:-https://github.com/mifarosa/rosadots}
PORT=8787
UNIT_NAME=rosadots-server
UNIT_PATH=${ROSADOTS_UNIT_PATH:-/etc/systemd/system/$UNIT_NAME.service}
CADDYFILE=${ROSADOTS_CADDYFILE:-/etc/caddy/Caddyfile}
BEGIN_MARK="# BEGIN rosadots (server/install.sh yönetir)"
END_MARK="# END rosadots"

say()  { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
ok()   { printf '    \033[32m✓\033[0m %s\n' "$*"; }
warn() { printf '    \033[33m!\033[0m %s\n' "$*"; }
die()  { printf '\n\033[31mHata:\033[0m %s\n' "$*" >&2; exit 1; }

# Yönetici yetkisi gereken komutlar: root isek doğrudan, değilsek sudo ile.
as_root() {
  if [ "$(id -u)" -eq 0 ] || [ "${ROSADOTS_NO_SUDO:-}" = 1 ]; then "$@"
  elif command -v sudo >/dev/null 2>&1; then sudo "$@"
  else die "Bu adım yönetici yetkisi ister ama sudo yok. Betiği root olarak çalıştır."
  fi
}

# Gerçekten kullanılabilir bir terminal var mı?
have_tty() { { true </dev/tty; } 2>/dev/null; }

# Soru sor. Değişken önceden doluysa sormaz; terminal yoksa varsayılanı kullanır.
ask() {
  local var=$1 prompt=$2 default=$3 value=
  [ -n "${!var:-}" ] && return 0
  if have_tty; then
    read -r -p "    $prompt [$default]: " value </dev/tty || true
  fi
  printf -v "$var" '%s' "${value:-$default}"
}

# ---------------------------------------------------------------- 1) Node.js
node_ok() {
  command -v node >/dev/null 2>&1 && node -e '
    const [a, b] = process.versions.node.split(".").map(Number);
    process.exit(a > 20 || (a === 20 && b >= 6) ? 0 : 1)' >/dev/null 2>&1
}

# Resmî Node.js 22'yi nodejs.org'dan indirip sağlama toplamını doğrulayarak kurar.
install_node() {
  local arch base sums line want file tmp prefix bindir dir
  [ "$(uname -s)" = Linux ] || die "Bu betik yalnızca Linux içindir."
  case "$(uname -m)" in
    x86_64|amd64)  arch=x64 ;;
    aarch64|arm64) arch=arm64 ;;
    armv7l)        arch=armv7l ;;
    *) die "Bu işlemci ($(uname -m)) için resmî Node.js 22 yok." ;;
  esac
  base=https://nodejs.org/dist/latest-v22.x
  sums=$(curl -fsSL "$base/SHASUMS256.txt") || die "nodejs.org'a ulaşılamadı. İnternet bağlantısını kontrol et."
  line=$(printf '%s\n' "$sums" | grep -E " node-v[0-9.]+-linux-$arch\.tar\.gz$" | head -n1 || true)
  [ -n "$line" ] || die "nodejs.org'da $arch için Node.js 22 bulunamadı."
  want=${line%% *}
  file=${line##* }
  tmp=$(mktemp -d)
  curl -fsSL "$base/$file" -o "$tmp/$file" || { rm -rf "$tmp"; die "$file indirilemedi."; }
  [ "$(sha256sum "$tmp/$file" | cut -d' ' -f1)" = "$want" ] \
    || { rm -rf "$tmp"; die "İndirilen Node.js dosyasının sağlama toplamı tutmuyor. Tekrar dene."; }
  prefix=${ROSADOTS_NODE_PREFIX:-/opt}
  bindir=${ROSADOTS_NODE_BINDIR:-/usr/local/bin}
  dir=$prefix/${file%.tar.gz}
  as_root mkdir -p "$prefix" "$bindir"
  as_root tar -xzf "$tmp/$file" -C "$prefix"
  for bin in node npm npx; do as_root ln -sf "$dir/bin/$bin" "$bindir/$bin"; done
  rm -rf "$tmp"
  export PATH="$bindir:$PATH"
  hash -r
}

say "1/6 Node.js"
if node_ok; then
  ok "Node.js $(node --version) var"
else
  if command -v node >/dev/null 2>&1; then
    warn "Mevcut Node.js $(node --version 2>&1 | head -n1) çok eski (gerekli: 20.6+); resmî Node.js 22 kuruluyor."
  else
    warn "Node.js yok; resmî Node.js 22 kuruluyor."
  fi
  install_node
  node_ok || die "Node.js kuruldu ama çalıştırılamadı. Ubuntu 20.04+ ya da Debian 10+ gerekir."
  ok "Node.js $(node --version) kuruldu"
fi
NODE_BIN=$(command -v node)

# ------------------------------------------------------------------- 2) Kod
say "2/6 Kod"
SELF=${BASH_SOURCE[0]:-}
ROOT=
if [ -n "$SELF" ] && [ -f "$SELF" ]; then
  candidate=$(cd "$(dirname "$SELF")/.." && pwd)
  [ -f "$candidate/game.ts" ] && ROOT=$candidate
fi
if [ -z "$ROOT" ]; then
  # Çalıştırılan betik bir depo içinde değil (örneğin curl | bash): depoyu indir.
  ROOT=${ROSADOTS_DIR:-/opt/rosadots}
  command -v git >/dev/null 2>&1 || { command -v apt-get >/dev/null 2>&1 && as_root apt-get install -y git; }
  command -v git >/dev/null 2>&1 || die "git gerekli. Kur ve tekrar çalıştır."
  BRANCH=${ROSADOTS_BRANCH:-}
  if [ -z "$BRANCH" ]; then
    BRANCH=$(git ls-remote --symref "$REPO_URL" HEAD 2>/dev/null | sed -n 's|^ref: refs/heads/\(.*\)\tHEAD$|\1|p' | head -n1 || true)
    [ -n "$BRANCH" ] || die "Deponun varsayılan dalı bulunamadı ($REPO_URL). ROSADOTS_BRANCH=<dal> ver."
  fi
  if [ -d "$ROOT/.git" ]; then
    git -C "$ROOT" fetch --quiet origin "$BRANCH"
    git -C "$ROOT" checkout --quiet "$BRANCH"
    git -C "$ROOT" pull --quiet --ff-only origin "$BRANCH"
    ok "$ROOT güncellendi ($BRANCH)"
  else
    as_root mkdir -p "$ROOT" && as_root chown "$(id -un)":"$(id -gn)" "$ROOT"
    git clone --quiet --branch "$BRANCH" "$REPO_URL" "$ROOT" \
      || die "Depo indirilemedi: $REPO_URL ($BRANCH). Depo özelse önce kendin 'git clone' ile indir."
    ok "$ROOT içine indirildi ($BRANCH)"
  fi
else
  if [ -d "$ROOT/.git" ] && git -C "$ROOT" rev-parse --abbrev-ref '@{u}' >/dev/null 2>&1; then
    git -C "$ROOT" pull --quiet --ff-only && ok "$ROOT güncellendi" || warn "git pull yapılamadı; mevcut kod kullanılıyor."
  else
    ok "Mevcut depo kullanılıyor: $ROOT"
  fi
fi
SERVER_DIR=$ROOT/server
[ -f "$SERVER_DIR/src/index.ts" ] || die "$SERVER_DIR/src/index.ts bulunamadı. Bu dal sunucu kodunu içermiyor olabilir."

# ---------------------------------------------- 3) Bağımlılıklar ve ayarlar
say "3/6 Bağımlılıklar ve ayarlar"
if [ "${ROSADOTS_SKIP_NPM:-}" = 1 ]; then
  warn "npm atlandı (ROSADOTS_SKIP_NPM=1)"
else
  (cd "$SERVER_DIR" && npm ci --omit=dev --no-audit --no-fund --loglevel=error)
  ok "Bağımlılıklar kuruldu"
fi
if [ -f "$SERVER_DIR/.env" ]; then
  ok ".env var, olduğu gibi bırakıldı"
else
  cp "$SERVER_DIR/.env.example" "$SERVER_DIR/.env"
  ok ".env oluşturuldu"
fi
# Servis ve Caddy aynı portu kullanmalı: .env'deki değeri oku.
env_port=$(sed -n 's/^PORT=\([0-9]\{1,5\}\)$/\1/p' "$SERVER_DIR/.env" | tail -n1)
PORT=${env_port:-$PORT}

# ------------------------------------------------------------ 4) Caddy (TLS)
say "4/6 Caddy (otomatik TLS) ve güvenlik duvarı"
DOMAIN=${ROSADOTS_DOMAIN:-}
ask DOMAIN "Alan adı" "rosadots.mifarosa.com"
printf '%s' "$DOMAIN" | grep -Eq '^[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?$' || die "Geçersiz alan adı: $DOMAIN"

install_caddy() {
  command -v apt-get >/dev/null 2>&1 \
    || die "Caddy bu sistemde otomatik kurulamıyor (apt yok). https://caddyserver.com/docs/install adresinden kur, sonra tekrar çalıştır."
  as_root apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
    | as_root gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
    | as_root tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
  as_root apt-get update -y
  as_root apt-get install -y caddy
}

# Caddyfile'a yalnızca kendi bloğumuzu yazar; başka siteler varsa dokunmaz.
configure_caddy() {
  local tmp
  tmp=$(mktemp)
  if [ -f "$CADDYFILE" ]; then
    awk -v b="$BEGIN_MARK" -v e="$END_MARK" '$0==b{skip=1} !skip{print} $0==e{skip=0}' "$CADDYFILE" > "$tmp"
    as_root cp "$CADDYFILE" "$CADDYFILE.bak"
  fi
  printf '\n%s\n%s {\n\treverse_proxy 127.0.0.1:%s\n}\n%s\n' "$BEGIN_MARK" "$DOMAIN" "$PORT" "$END_MARK" >> "$tmp"
  as_root mkdir -p "$(dirname "$CADDYFILE")"
  as_root install -m 644 "$tmp" "$CADDYFILE"
  rm -f "$tmp"
  if ! as_root caddy validate --config "$CADDYFILE" --adapter caddyfile >/dev/null 2>&1; then
    [ -f "$CADDYFILE.bak" ] && as_root cp "$CADDYFILE.bak" "$CADDYFILE"
    die "Caddy ayarı geçersiz (aynı alan adı $CADDYFILE içinde başka yerde de tanımlı olabilir). Eski ayar geri yüklendi."
  fi
  if as_root systemctl is-active --quiet caddy 2>/dev/null; then as_root systemctl reload caddy
  else as_root systemctl enable --now caddy
  fi
}

open_firewall() {
  if command -v ufw >/dev/null 2>&1 && as_root ufw status 2>/dev/null | grep -q '^Status: active'; then
    as_root ufw allow 80/tcp >/dev/null && as_root ufw allow 443/tcp >/dev/null
    ok "ufw: 80 ve 443 açıldı"
  elif command -v iptables >/dev/null 2>&1; then
    local port pos changed=0 policy
    policy=$(as_root iptables -S INPUT 2>/dev/null | sed -n 's/^-P INPUT //p' | head -n1 || true)
    for port in 80 443; do
      as_root iptables -C INPUT -p tcp --dport "$port" -j ACCEPT 2>/dev/null && continue
      # İlk REJECT/DROP kuralının önüne koy (Oracle Cloud imajları sonda REJECT ile gelir).
      pos=$(as_root iptables -L INPUT --line-numbers -n 2>/dev/null | awk '/REJECT|DROP/ {print $1; exit}' || true)
      if [ -n "$pos" ]; then as_root iptables -I INPUT "$pos" -p tcp --dport "$port" -j ACCEPT; changed=1
      elif [ "$policy" = DROP ]; then as_root iptables -A INPUT -p tcp --dport "$port" -j ACCEPT; changed=1
      fi
    done
    if [ "$changed" = 1 ]; then
      if command -v netfilter-persistent >/dev/null 2>&1; then as_root netfilter-persistent save >/dev/null 2>&1 || true
      else warn "iptables kuralları yeniden başlatınca silinebilir (netfilter-persistent yok)."
      fi
      ok "iptables: 80 ve 443 açıldı"
    else
      ok "Sunucudaki güvenlik duvarı 80 ve 443'ü zaten geçiriyor"
    fi
  else
    ok "Sunucuda güvenlik duvarı aracı yok"
  fi
  warn "Sağlayıcının panelindeki güvenlik duvarında da 80 ve 443 açık olmalı (Oracle Cloud: VCN > Security List > Ingress Rules)."
}

if [ "${ROSADOTS_SKIP_CADDY:-}" = 1 ]; then
  warn "Caddy atlandı (ROSADOTS_SKIP_CADDY=1)"
else
  if command -v caddy >/dev/null 2>&1; then ok "Caddy $(caddy version 2>/dev/null | head -n1 | cut -d' ' -f1) var"
  else install_caddy; ok "Caddy kuruldu"
  fi
  configure_caddy
  ok "$DOMAIN → 127.0.0.1:$PORT ($CADDYFILE)"
  if [ "${ROSADOTS_SKIP_FIREWALL:-}" = 1 ]; then warn "Güvenlik duvarı atlandı (ROSADOTS_SKIP_FIREWALL=1)"
  else open_firewall
  fi
fi

# ---------------------------------------------------------------- 5) Servis
say "5/6 Servis"
SVC_USER=${ROSADOTS_USER:-${SUDO_USER:-}}
if [ -z "$SVC_USER" ]; then
  if [ "$(id -u)" -eq 0 ] && id deploy >/dev/null 2>&1; then SVC_USER=deploy; else SVC_USER=$(id -un); fi
fi
[ "$SVC_USER" = root ] && warn "Servis root olarak çalışacak. Yetkisiz bir kullanıcı daha güvenlidir (ROSADOTS_USER=<kullanıcı>)."
if [ "${ROSADOTS_NO_SYSTEMD:-}" = 1 ]; then
  warn "systemd atlandı (ROSADOTS_NO_SYSTEMD=1). Elle başlat: cd $SERVER_DIR && npm start"
else
  tmp=$(mktemp)
  sed -e "s|^User=.*|User=$SVC_USER|" \
      -e "s|/opt/rosadots|$ROOT|g" \
      -e "s|^ExecStart=/usr/bin/node|ExecStart=$NODE_BIN|" \
      "$SERVER_DIR/rosadots-server.service" > "$tmp"
  as_root install -m 644 "$tmp" "$UNIT_PATH"
  rm -f "$tmp"
  as_root systemctl daemon-reload
  as_root systemctl enable "$UNIT_NAME" >/dev/null 2>&1 || as_root systemctl enable "$UNIT_NAME"
  as_root systemctl restart "$UNIT_NAME"
  sleep 2
  if as_root systemctl is-active --quiet "$UNIT_NAME"; then
    ok "Servis çalışıyor ($UNIT_NAME, kullanıcı: $SVC_USER)"
  else
    as_root journalctl -u "$UNIT_NAME" -n 25 --no-pager 2>/dev/null || true
    die "Servis başlamadı. Günlük yukarıda; 'journalctl -u $UNIT_NAME -f' ile izleyebilirsin."
  fi
fi

# --------------------------------------------------------------- 6) Kontrol
say "6/6 Kontrol"
if [ "${ROSADOTS_SKIP_CHECK:-}" = 1 ]; then
  warn "Kontrol atlandı (ROSADOTS_SKIP_CHECK=1)"
else
  # Düz HTTP isteğine WebSocket sunucusu 426 (Upgrade Required) döner: ayakta demektir.
  code=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT" 2>/dev/null || true)
  if [ "$code" = 426 ]; then ok "Sunucu 127.0.0.1:$PORT üzerinde yanıt veriyor"
  else warn "Sunucu yerelde beklenen yanıtı vermedi (HTTP ${code:-yok}). 'journalctl -u $UNIT_NAME -f' ile bak."
  fi
  if [ "${ROSADOTS_SKIP_CADDY:-}" != 1 ]; then
    resolved=$(getent hosts "$DOMAIN" 2>/dev/null | awk '{print $1; exit}' || true)
    if [ -n "$resolved" ]; then ok "DNS: $DOMAIN → $resolved (bu sunucunun herkese açık IP adresi olmalı)"
    else warn "DNS: $DOMAIN henüz bir adrese çözülmüyor. Alan adının DNS ayarına bu sunucunun IP adresiyle bir A kaydı ekle."
    fi
    printf '    sertifika bekleniyor (en fazla ~1 dk)'
    tls=
    for _ in 1 2 3 4 5 6 7 8 9 10 11 12; do
      code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "https://$DOMAIN" 2>/dev/null || true)
      [ "$code" = 426 ] && { tls=1; break; }
      printf '.'; sleep 5
    done
    printf '\n'
    if [ -n "$tls" ]; then ok "https://$DOMAIN çalışıyor (wss:// hazır)"
    else warn "https://$DOMAIN yanıt vermedi. Sırasıyla bak: DNS A kaydı, 80/443 portları (sunucu ve bulut güvenlik listesi), 'journalctl -u caddy -f'. Düzelince betiği tekrar çalıştırabilirsin."
    fi
  fi
fi

printf '\n\033[32mKurulum tamam.\033[0m  Uygulamadaki adres: wss://%s\n' "$DOMAIN"
printf 'Günlük: journalctl -u %s -f     Güncelleme: bu betiği tekrar çalıştır.\n' "$UNIT_NAME"
