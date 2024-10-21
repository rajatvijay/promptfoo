import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { fetchUserEmail } from '@app/utils/api';

interface GlobalState {
  userEmail: string | null;
  setUserEmail: (email: string | null) => void;
  initializeUserEmail: () => Promise<void>;
}

export const useGlobalStore = create<GlobalState>()(
  persist(
    (set, get) => ({
      userEmail: null,
      setUserEmail: (email) => set({ userEmail: email }),
      initializeUserEmail: async () => {
        if (!get().userEmail) {
          const email = await fetchUserEmail();
          set({ userEmail: email });
        }
      },
    }),
    {
      name: 'global-store',
    },
  ),
);

// If you want to set it after creation, you can export this function:
export const initializeGlobalStore = (initialEmail: string | null) => {
  useGlobalStore.getState().setUserEmail(initialEmail);
};
