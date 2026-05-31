'use client';

import axios from 'axios';

const apiClient = axios.create({
  baseURL: '',
});

let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;
const pendingRequests: Array<(token: string | null) => void> = [];

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
        token: refreshToken,
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
      if (!isRefreshing) {
        isRefreshing = true;
        const newToken = await refreshAccessToken();
        isRefreshing = false;
        pendingRequests.forEach((cb) => cb(newToken));
        pendingRequests.length = 0;

        if (!newToken) {
          return Promise.reject(error);
        }
      }

      return new Promise((resolve, reject) => {
        pendingRequests.push((token) => {
          if (!token) {
            reject(error);
            return;
          }
          originalRequest._retry = true;
          originalRequest.headers.Authorization = `Bearer ${token}`;
          resolve(apiClient(originalRequest));
        });
      });
    }

    return Promise.reject(error);
  }
);

export { apiClient };
export default apiClient;

