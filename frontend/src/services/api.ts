import axios from 'axios';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 4000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  },
});

apiClient.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('stockflow_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      sessionStorage.removeItem('stockflow_token');
    }
    return Promise.reject(error);
  }
);

export const StockFlowApi = {
  async checkHealth(): Promise<boolean> {
    try {
      const res = await apiClient.get('/healthz');
      return res.status === 200;
    } catch {
      return false;
    }
  },

  async login(email: string, password: string) {
    return apiClient.post('/auth/login', { email, password });
  },

  async me() {
    return apiClient.get('/auth/me');
  },

  async googleRedirectUrl(): Promise<string> {
    try {
      const res = await apiClient.get('/auth/google/redirect');
      if (res.data?.url) return res.data.url;
    } catch {
      // Fallback to direct API route
    }
    return `${API_BASE_URL}/auth/google/redirect`;
  },

  async googleTokenLogin(idToken: string) {
    return apiClient.post('/auth/google/token', { id_token: idToken });
  },

  async logout() {
    try {
      await apiClient.post('/auth/logout');
    } catch {
      // Clean local session logout
    }
  },

  async logForbiddenAttempt(payload: { route: string; role: string; reason: string }) {
    try {
      await apiClient.post('/security/forbidden-attempt', payload);
    } catch {
      // Also logged locally
    }
  },

  async downloadBackendExport(report: string, format: 'pdf' | 'docx' | 'xlsx'): Promise<Blob | null> {
    try {
      const res = await apiClient.get(`/exports/${report}/${format}`, {
        responseType: 'blob',
        timeout: 6000,
      });
      if (res.status === 200 && res.data && res.data.size > 100) {
        return res.data as Blob;
      }
      return null;
    } catch {
      return null;
    }
  },
};
