import axios from 'axios';

export const http = axios.create({
  baseURL: '/api',
  timeout: 15000,
});

http.interceptors.response.use(
  (resp) => resp,
  (err) => {
    console.error('[api]', err.config?.url, err.message);
    return Promise.reject(err);
  }
);
