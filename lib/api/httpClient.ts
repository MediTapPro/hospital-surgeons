'use client';

import axios from 'axios';

const apiClient = axios.create({
  baseURL: '',
});

let refreshPromise: Promise<string | null> | null = null;

const getAccessToken = () => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('accessToken');
};

const getRefreshToken = () => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('refreshToken');
};

const setAccessToken = (token: string) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem('accessToken', token);
};

const logout = () => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  window.location.href = '/login';
};

async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;

  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    logout();
    return null;
  }

  refreshPromise = (async () => {
    try {
      const response = await axios.post('/api/users/refresh', {
        refreshToken,
      });
      if (response.data?.success && response.data?.data?.accessToken) {
        setAccessToken(response.data.data.accessToken);
        return response.data.data.accessToken;
      }
      logout();
      return null;
    } catch (error) {
      logout();
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

apiClient.interceptors.request.use(
  (config) => {
    const token = getAccessToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (!originalRequest || originalRequest._retry) {
      return Promise.reject(error);
    }

    if (error.response?.status === 401) {
      const newToken = await refreshAccessToken();
      if (!newToken) return Promise.reject(error);

      originalRequest._retry = true;
      originalRequest.headers = originalRequest.headers || {};
      originalRequest.headers.Authorization = `Bearer ${newToken}`;
      return apiClient(originalRequest);
    }

    return Promise.reject(error);
  }
);

export { apiClient };
export default apiClient;
