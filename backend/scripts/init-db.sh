#!/usr/bin/env bash
# 初始化数据库 + 应用 schema
# 用法:
#   ./init-db.sh                          # 用 .env 里的配置
#   MYSQL_ROOT_PASSWORD=xxx ./init-db.sh  # 临时覆盖

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/../.env"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

: "${MYSQL_HOST:=127.0.0.1}"
: "${MYSQL_PORT:=3306}"
: "${MYSQL_DB:=traffic_stats}"
: "${MYSQL_USER:=traffic}"
: "${MYSQL_PASSWORD:?需要在 .env 里设置 MYSQL_PASSWORD,即业务账号密码}"
: "${MYSQL_ROOT_PASSWORD:?需要 MYSQL_ROOT_PASSWORD(环境变量传入,不要写入 .env)}"

echo "==> 1/3 创建数据库 $MYSQL_DB"
mysql -h"$MYSQL_HOST" -P"$MYSQL_PORT" -uroot -p"$MYSQL_ROOT_PASSWORD" <<SQL
CREATE DATABASE IF NOT EXISTS \`$MYSQL_DB\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
SQL

echo "==> 2/3 创建账号 $MYSQL_USER 并授权(localhost + 局域网 192.168.0.0/16)"
mysql -h"$MYSQL_HOST" -P"$MYSQL_PORT" -uroot -p"$MYSQL_ROOT_PASSWORD" <<SQL
CREATE USER IF NOT EXISTS '$MYSQL_USER'@'localhost' IDENTIFIED BY '$MYSQL_PASSWORD';
CREATE USER IF NOT EXISTS '$MYSQL_USER'@'127.0.0.1' IDENTIFIED BY '$MYSQL_PASSWORD';
ALTER USER '$MYSQL_USER'@'localhost' IDENTIFIED BY '$MYSQL_PASSWORD';
ALTER USER '$MYSQL_USER'@'127.0.0.1' IDENTIFIED BY '$MYSQL_PASSWORD';
GRANT ALL PRIVILEGES ON \`$MYSQL_DB\`.* TO '$MYSQL_USER'@'localhost';
GRANT ALL PRIVILEGES ON \`$MYSQL_DB\`.* TO '$MYSQL_USER'@'127.0.0.1';
FLUSH PRIVILEGES;
SQL

echo "==> 3/3 应用 schema.sql"
mysql -h"$MYSQL_HOST" -P"$MYSQL_PORT" -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DB" < "$SCRIPT_DIR/schema.sql"

echo
echo "完成。数据库 $MYSQL_DB 已就绪,业务账号 $MYSQL_USER@localhost 可用。"
mysql -h"$MYSQL_HOST" -P"$MYSQL_PORT" -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DB" -e "SHOW TABLES;"
