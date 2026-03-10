import { create } from 'zustand';

interface UIState {
    dropdownOpen: boolean;
    theme: string;
    sidebarOpen: boolean;
    setDropdownOpen: (open: boolean) => void;
    setTheme: (theme: string) => void;
    setSidebarOpen: (open: boolean) => void;
    toggleDropdown: () => void;
    toggleSidebar: () => void;
}

export const useUIStore = create<UIState>((set) => ({
    dropdownOpen: false,
    theme: 'dark',
    sidebarOpen: true,
    setDropdownOpen: (open) => set({ dropdownOpen: open }),
    setTheme: (theme) => set({ theme }),
    setSidebarOpen: (open) => set({ sidebarOpen: open }),
    toggleDropdown: () => set((state) => ({ dropdownOpen: !state.dropdownOpen })),
    toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
}));
