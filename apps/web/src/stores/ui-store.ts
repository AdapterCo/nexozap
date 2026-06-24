import { create } from 'zustand';

interface UIState {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  activeModal: string | null;
  openModal: (name: string) => void;
  closeModal: () => void;
}

const useUIStore = create<UIState>((set) => ({
  sidebarCollapsed: false,
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  activeModal: null,
  openModal: (name: string) => set({ activeModal: name }),
  closeModal: () => set({ activeModal: null }),
}));

export default useUIStore;
