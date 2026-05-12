<template>
  <div class="layout">
    <header class="topbar">
      <div class="brand">📊 路由器流量统计</div>
      <nav>
        <RouterLink to="/wan">WAN 上下行</RouterLink>
        <RouterLink to="/devices">设备列表</RouterLink>
      </nav>
    </header>
    <main class="content">
      <RouterView />
    </main>
  </div>
</template>

<script setup lang="ts">
import { RouterView, RouterLink } from 'vue-router';
</script>

<style>
/* Element Plus 主题色对齐项目蓝 */
:root {
  --el-color-primary: #2563eb;
  --el-color-primary-light-3: #4d80ee;
  --el-color-primary-light-5: #7da6f3;
  --el-color-primary-light-7: #aec5f7;
  --el-color-primary-light-8: #c8d8fa;
  --el-color-primary-light-9: #e9eff8;
  --el-color-primary-dark-2: #1d50ba;
  --el-font-size-base: 13px;
  --el-border-radius-base: 6px;
}

* {
  box-sizing: border-box;
}
html,
body,
#app {
  margin: 0;
  padding: 0;
  height: 100%;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  background: #f5f7fa;
  color: #1f2937;
}
.layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}
.topbar {
  height: 56px;
  background: #1e293b;
  color: #f1f5f9;
  display: flex;
  align-items: center;
  padding: 0 24px;
  gap: 32px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
}
.brand {
  font-size: 18px;
  font-weight: 600;
}
.topbar nav {
  display: flex;
  gap: 4px;
}
.topbar nav a {
  color: #cbd5e1;
  padding: 8px 16px;
  border-radius: 6px;
  text-decoration: none;
  font-size: 14px;
  transition: all 0.15s;
}
.topbar nav a:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
}
.topbar nav a.router-link-active {
  background: #334155;
  color: #fff;
}
.content {
  flex: 1;
  padding: 24px;
  max-width: 1400px;
  margin: 0 auto;
  width: 100%;
}
.card {
  background: #fff;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  margin-bottom: 16px;
}
.card-title {
  font-size: 15px;
  font-weight: 600;
  margin: 0 0 16px;
  color: #374151;
}
.toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}
.toolbar label {
  font-size: 13px;
  color: #64748b;
}
button.btn,
select.btn {
  padding: 6px 14px;
  border: 1px solid #d1d5db;
  background: #fff;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  color: #374151;
  transition: all 0.1s;
}
button.btn:hover {
  border-color: #94a3b8;
}
button.btn.active {
  background: #2563eb;
  border-color: #2563eb;
  color: #fff;
}
table.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
table.data-table th {
  text-align: left;
  padding: 10px 12px;
  background: #f8fafc;
  color: #475569;
  font-weight: 600;
  border-bottom: 1px solid #e2e8f0;
  cursor: pointer;
  user-select: none;
}
table.data-table th:hover {
  background: #f1f5f9;
}
table.data-table td {
  padding: 10px 12px;
  border-bottom: 1px solid #f1f5f9;
}
table.data-table tr:hover td {
  background: #f8fafc;
}
table.data-table td.right,
table.data-table th.right {
  text-align: right;
}
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}
.kpi {
  background: #fff;
  border-radius: 8px;
  padding: 14px 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}
.kpi .label {
  font-size: 12px;
  color: #64748b;
  margin-bottom: 4px;
}
.kpi .value {
  font-size: 20px;
  font-weight: 600;
  color: #1e293b;
}
.muted {
  color: #94a3b8;
}
.mono {
  font-family: 'SFMono-Regular', Menlo, Consolas, monospace;
  font-size: 12px;
}
.chart-host {
  width: 100%;
  height: 380px;
}
</style>
