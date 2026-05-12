-- =================================================================
-- OpenWrt 流量统计项目 - MySQL schema
-- =================================================================
-- 设计原则:
--   1. 累计计数器(原始)单独存,便于排查
--   2. 差分(实际用量)单独存,API 直接查这张
--   3. 设备元信息独立维护,后续可叠加 OUI/vendor

-- ----------------------------------------------------------------
-- 接口流量(WAN/LAN)
-- ----------------------------------------------------------------

-- 接口最近一次的累计计数器(用作下次差分的基准,只保留最新)
CREATE TABLE IF NOT EXISTS iface_counter_last (
  iface VARCHAR(32) NOT NULL PRIMARY KEY,
  ts DATETIME NOT NULL,
  rx_total BIGINT UNSIGNED NOT NULL,
  tx_total BIGINT UNSIGNED NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='接口累计计数器(差分基准)';

-- 接口每分钟流量(差分后的增量,这是 API 查的对象)
CREATE TABLE IF NOT EXISTS iface_traffic (
  ts DATETIME NOT NULL COMMENT '采样时刻(分钟级对齐)',
  iface VARCHAR(32) NOT NULL,
  rx_bytes BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '本分钟下行字节',
  tx_bytes BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '本分钟上行字节',
  PRIMARY KEY (ts, iface),
  KEY idx_iface_ts (iface, ts)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='接口每分钟流量增量';

-- ----------------------------------------------------------------
-- 设备元信息
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS device_info (
  mac VARCHAR(17) NOT NULL PRIMARY KEY,
  hostname VARCHAR(64) DEFAULT NULL COMMENT 'DHCP 主机名或推断名',
  ip_last VARCHAR(45) DEFAULT NULL COMMENT '最近一次出现的 IP',
  vendor VARCHAR(64) DEFAULT NULL COMMENT 'OUI 厂商(预留)',
  first_seen DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_last_seen (last_seen)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='设备主表';

-- ----------------------------------------------------------------
-- 设备流量 - nlbwmon
-- ----------------------------------------------------------------

-- nlbwmon 原始累计快照(保留排查用,可定期清理 30 天前)
CREATE TABLE IF NOT EXISTS device_traffic_raw (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  ts DATETIME NOT NULL,
  mac VARCHAR(17) NOT NULL,
  ip VARCHAR(45) DEFAULT NULL,
  family TINYINT NOT NULL COMMENT '4=IPv4, 6=IPv6',
  proto VARCHAR(8) DEFAULT NULL COMMENT 'TCP/UDP/IP',
  port INT UNSIGNED DEFAULT NULL,
  layer7 VARCHAR(32) DEFAULT NULL COMMENT 'HTTPS/QUIC/DNS/...',
  conns INT UNSIGNED NOT NULL DEFAULT 0,
  rx_bytes BIGINT UNSIGNED NOT NULL DEFAULT 0,
  rx_pkts BIGINT UNSIGNED NOT NULL DEFAULT 0,
  tx_bytes BIGINT UNSIGNED NOT NULL DEFAULT 0,
  tx_pkts BIGINT UNSIGNED NOT NULL DEFAULT 0,
  KEY idx_mac_ts (mac, ts),
  KEY idx_ts (ts)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='nlbwmon 累计快照';

-- 设备每 10 分钟流量(差分后,聚合到 mac × layer7 粒度)
CREATE TABLE IF NOT EXISTS device_traffic (
  ts DATETIME NOT NULL COMMENT '采样时刻(10 分钟对齐)',
  mac VARCHAR(17) NOT NULL,
  layer7 VARCHAR(32) NOT NULL DEFAULT '__other__' COMMENT '协议,null 占位为 __other__',
  rx_bytes BIGINT UNSIGNED NOT NULL DEFAULT 0,
  tx_bytes BIGINT UNSIGNED NOT NULL DEFAULT 0,
  conns INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (ts, mac, layer7),
  KEY idx_mac_ts (mac, ts),
  KEY idx_ts (ts)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='设备每 10 分钟流量增量';

-- ----------------------------------------------------------------
-- nlbwmon 会计周期跟踪
-- nlbwmon 默认每月 1 号清零,周期切换时差分会变成负数,
-- 需要识别切换点,确保跨周期的差分计算正确
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS nlbwmon_period (
  period_date DATE NOT NULL PRIMARY KEY,
  first_seen DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  is_active TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='nlbwmon 会计周期';

-- ----------------------------------------------------------------
-- 采集器运行日志(可选,用于排查)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS collector_log (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  ts DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  job VARCHAR(32) NOT NULL COMMENT 'iface | nlbw | dhcp',
  status VARCHAR(16) NOT NULL COMMENT 'ok | error',
  duration_ms INT UNSIGNED DEFAULT NULL,
  rows_affected INT UNSIGNED DEFAULT NULL,
  error_msg TEXT DEFAULT NULL,
  KEY idx_ts (ts),
  KEY idx_job_ts (job, ts)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='采集器运行日志';
