import { create } from 'zustand';
import api from '@/lib/api';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  avatar?: string;
}

interface Company {
  id: string;
  name: string;
  plan: string;
  ownerName?: string;
  whatsapp?: string | null;
  email?: string | null;
  address?: string | null;
  openingTime?: string;
  closingTime?: string;
  workingDays?: string[];
}

interface AuthState {
  user: User | null;
  company: Company | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string, companyName: string) => Promise<void>;
  logout: () => void;
  loadUser: () => Promise<void>;
}

function setCookie(name: string, value: string, days: number = 7) {
  if (typeof document === 'undefined') return;
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

function removeCookie(name: string) {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
}

const useAuthStore = create<AuthState>((set) => ({
  user: null,
  company: null,
  token: typeof window !== 'undefined' ? localStorage.getItem('nexozap_token') : null,
  isAuthenticated: false,
  isLoading: false,

  login: async (email: string, password: string) => {
    set({ isLoading: true });
    try {
      const response = await api.post('/auth/login', { email, password });
      const { token, user, company } = response.data;

      localStorage.setItem('nexozap_token', token);
      setCookie('nexozap_token', token);
      set({ user, company, token, isAuthenticated: true, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  register: async (email: string, password: string, name: string, companyName: string) => {
    set({ isLoading: true });
    try {
      const response = await api.post('/auth/register', {
        email,
        password,
        name,
        companyName,
      });
      const { token, user, company } = response.data;

      localStorage.setItem('nexozap_token', token);
      setCookie('nexozap_token', token);
      set({ user, company, token, isAuthenticated: true, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  logout: () => {
    localStorage.removeItem('nexozap_token');
    removeCookie('nexozap_token');
    set({ user: null, company: null, token: null, isAuthenticated: false });
  },

  loadUser: async () => {
    const token = localStorage.getItem('nexozap_token');
    if (!token) {
      set({ isAuthenticated: false });
      return;
    }

    set({ isLoading: true });
    try {
      const response = await api.get('/auth/profile');
      const { user, company } = response.data;

      setCookie('nexozap_token', token);
      set({ user, company, token, isAuthenticated: true, isLoading: false });
    } catch {
      localStorage.removeItem('nexozap_token');
      removeCookie('nexozap_token');
      set({ user: null, company: null, token: null, isAuthenticated: false, isLoading: false });
    }
  },
}));

export default useAuthStore;
