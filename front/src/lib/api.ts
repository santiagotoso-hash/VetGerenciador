import axios from 'axios';

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('accessToken');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // 401 fora da tela de login = sessão expirada
    const isLogin = error.config?.url?.includes('/auth/login');
    if (error.response?.status === 401 && !isLogin && typeof window !== 'undefined') {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('auth-storage');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);

/** Extrai a mensagem de erro retornada pela API (NestJS) */
export function errorMessage(err: unknown): string {
  const data = (err as any)?.response?.data;
  const msg = data?.message;
  if (Array.isArray(msg)) return msg.join(', ');
  return msg || (err as Error)?.message || 'Erro inesperado';
}
