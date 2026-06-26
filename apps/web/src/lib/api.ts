import axios from 'axios';

const apiUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '');

const api = axios.create({
  baseURL: apiUrl ? `${apiUrl}/api` : '/api',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        const currentPath = window.location.pathname;
        const requestUrl = error.config?.url || '';
        const isAuthPage = currentPath === '/login' || currentPath === '/register';
        const isAuthRequest =
          requestUrl.includes('/auth/login') ||
          requestUrl.includes('/auth/register') ||
          requestUrl.includes('/auth/logout');

        if (!isAuthPage && !isAuthRequest) {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  },
);

export default api;
