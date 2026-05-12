import { createRouter, createWebHistory } from 'vue-router';

const routes = [
  { path: '/', redirect: '/wan' },
  { path: '/wan', name: 'wan', component: () => import('../views/WanView.vue') },
  { path: '/devices', name: 'devices', component: () => import('../views/DeviceListView.vue') },
  {
    path: '/devices/:mac',
    name: 'device-detail',
    component: () => import('../views/DeviceDetailView.vue'),
    props: true,
  },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});
