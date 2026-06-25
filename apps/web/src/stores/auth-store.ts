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
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string, companyName: string) => Promise<void>;
  logout: () => Promise<void>;
  loadUser: () => Promise<void>;
}

const useAuthStore = create<AuthState>((set) => ({
  user: null,
  company: null,
  isAuthenticated: false,
  isLoading: true,

  login: async (email: string, password: string) => {
    set({ isLoading: true });
    try {
      const response = await api.post('/auth/login', { email, password });
      const { user, company } = response.data;

      set({ user, company, isAuthenticated: true, isLoading: false });
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
      const { user, company } = response.data;

      set({ user, company, isAuthenticated: true, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  logout: async () => {
    await api.post('/auth/logout').catch(() => undefined);
    set({ user: null, company: null, isAuthenticated: false });
  },

  loadUser: async () => {
    set({ isLoading: true });
    try {
      const response = await api.get('/auth/profile');
      const { user, company } = response.data;

      set({ user, company, isAuthenticated: true, isLoading: false });
    } catch {
      set({ user: null, company: null, isAuthenticated: false, isLoading: false });
    }
  },
}));

export default useAuthStore;
