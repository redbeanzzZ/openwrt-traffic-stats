# OpenWrt 流量统计

一个把 OpenWrt 路由器流量数据(接口级 + 设备级 + 协议级)持续采集到本地数据库,并通过 Web 页面可视化的小项目。Docker Compose 一键部署。

> **数据流**:OpenWrt(nlbwmon + /proc/net/dev)→ SSH 拉取 → MySQL 落库 → Express API → Vue3 + ECharts 前端

---

## 功能

- 📊 **WAN 上下行流量趋势图**,支持分钟 / 小时 / 天三种粒度
- 📱 **每台设备的流量明细**,排序、点击进入详情
- 🎨 **设备协议分布**(HTTPS / QUIC / DNS / mDNS / ...)— 看每台设备"在干嘛"
- ⏰ **自定义时间范围** + 8 个快捷选项(最近 1h/6h/24h/7d/30d、今天、昨天、本月)
- 🔄 **实时模式自动滚动**:窗口贴近"现在"时定时刷新自动平移

## 截图

(待补:三个页面截图)

---

## 部署方环境要求

| 项 | 最低 | 推荐 |
|---|---|---|
| Docker | 20.10+ | 24.0+ |
| docker compose | v2.0+ | v2.20+ |
| 内存 | 1 GB 可用 | 2 GB |
| 磁盘 | 5 GB | 20 GB |
| 网络 | 能 SSH 到 OpenWrt 路由器(同 LAN 即可) | 同 LAN |

## 路由器要求

| 项 | 要求 |
|---|---|
| 系统 | OpenWrt 19.07+(推荐 23.05/24.10) |
| 必装包 | **`nlbwmon`**(精到设备 × 协议) |
| 可选包 | `luci-app-nlbwmon`(LuCI 界面,只看不依赖) |
| SSH | Dropbear 开启,有可访问的 root(或同等权限)账号 |
| 内存 | >= 128 MB(nlbwmon 会驻留几 MB 内存) |

**路由器一次性准备命令**:

```sh
opkg update
opkg install nlbwmon

# 推荐配置:每 10 分钟刷盘一次,覆盖常见私有网段
uci set nlbwmon.@nlbwmon[0].commit_interval=10m
uci set nlbwmon.@nlbwmon[0].local_network='192.168.0.0/16' '172.16.0.0/12' '10.0.0.0/8' 'lan'
uci commit nlbwmon
/etc/init.d/nlbwmon enable
/etc/init.d/nlbwmon start
```

---

## 一键启动

```bash
# 1. 克隆
git clone https://github.com/你的用户名/openwrt-traffic-stats.git
cd openwrt-traffic-stats

# 2. 复制环境文件并修改
cp .env.example .env
vim .env    # 至少改:ROUTER_HOST、ROUTER_PASSWORD、MYSQL_ROOT_PASSWORD、MYSQL_PASSWORD

# 3. 启动
docker compose up -d

# 4. 看启动日志(可选)
docker compose logs -f backend

# 5. 浏览器访问
open http://localhost:8080
```

数据采集的反馈节奏:

| 时刻 | 现象 |
|---|---|
| 0 ~ 60 秒 | 容器启动,数据库初始化 |
| 60 秒后 | **WAN 趋势图**开始有第一个点 |
| 10 分钟后 | **设备列表**开始有数据(等第二次 nlbw 采样做差分) |
| 第二天 | 历史趋势完整 |

## 配置项详解

`.env` 文件里所有变量的含义见 [`.env.example`](.env.example) 内的注释。常改的有:

| 变量 | 默认 | 说明 |
|---|---|---|
| `ROUTER_HOST` | `192.168.1.1` | **必改**,你路由器的 LAN IP |
| `ROUTER_PASSWORD` | `change_me_...` | **必改**,路由器 SSH 密码 |
| `MYSQL_ROOT_PASSWORD` | `change_me_...` | **必改**,自己定 |
| `MYSQL_PASSWORD` | `change_me_too` | **必改**,业务账号密码 |
| `WEB_PORT` | `8080` | 浏览器访问端口 |
| `WATCH_IFACES` | `pppoe-wan,br-lan` | 关注的网口名(`ip link show` 看) |
| `RETENTION_DAYS` | `365` | 只保留最近多少天的差分统计和采集日志 |
| `INTERVAL_RETENTION_SEC` | `86400` | 数据保留清理任务的执行间隔 |

默认不保存 nlbwmon 原始快照,只保存差分后的展示数据和一份很小的当前累计基线。按 60 秒采样、约 27 台设备的当前规模估算,保留 365 天大约需要 3 ~ 4 GB 业务库空间。

---

## 故障排查

### 启动后访问 8080 没反应
- `docker compose ps` 看三个容器是否都 Up
- `docker compose logs frontend` 看 nginx 是否有错
- 防火墙是否放行 8080

### backend 容器连不上路由器
**最常见**。检查清单:
- `ROUTER_HOST` 是否填对(`ip route` 看你的网关)
- `ROUTER_PASSWORD` 是否正确(宿主机 `ssh root@${ROUTER_HOST}` 试一下)
- 路由器和 Docker 宿主机是否同子网。**极少数情况**:如果不同子网,改 `docker-compose.yml` 里 backend 服务加 `network_mode: host`

### 设备列表一直是空
- 路由器是否装了 `nlbwmon` 且 running:`ssh router '/etc/init.d/nlbwmon status'`
- `local_network` 是否覆盖了你的 LAN 网段
- 设备表至少要等**第二次 nlbw 采样**(10 分钟)才会有差分数据
- backend 日志:`docker compose logs backend | grep nlbw`

### MySQL 启动失败
- `./data/mysql` 目录权限问题:`sudo chown -R 999:999 ./data/mysql`(MySQL 镜像内 uid 999)
- 密码改了但容器没重建:`docker compose down -v && docker compose up -d`(⚠️ 会清空数据)

### 重置一切重新开始
```bash
docker compose down -v        # 删容器和卷
sudo rm -rf data/             # 删数据
docker compose up -d --build  # 重建
```

---

## 数据隐私声明

- 项目通过 SSH 读取路由器的**已聚合统计数据**(字节计数、连接数、协议分类)
- **不抓包、不记录任何 HTTPS 内容、不查域名、不上报任何第三方**
- 数据完全存储在你自己的 Docker 卷里(`./data/mysql`)
- 想完全卸载:`docker compose down -v && rm -rf data/`

## 协议

[MIT](LICENSE)

## 致谢

- [OpenWrt LuCI](https://github.com/openwrt/luci) — 参考了 `luci-app-nlbwmon` 的实现思路
- [nlbwmon](https://github.com/openwrt/packages/tree/master/net/nlbwmon) — 流量采集核心
- [Element Plus](https://element-plus.org/) — UI 组件
- [ECharts](https://echarts.apache.org/) — 图表
