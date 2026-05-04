import { createJSONStorage, persist } from "zustand/middleware";

import { create } from "zustand";

// Types for individual dialog state
interface DialogState {
  currentStepIndex: number;
  data: Record<string, unknown>;
  isProcessing: boolean;
  config?: Record<string, unknown>; // Store dynamic config changes
  wasExplicitlyClosed?: boolean; // Track if user explicitly closed the dialog
}

// Types for the multi-page dialog store
export interface MultiPageDialogState {
  // Per-dialog states (keyed by persistence key)
  dialogs: Record<string, DialogState>;

  // Actions
  initDialog: (
    persistenceKey: string,
    initialData?: Record<string, unknown>,
  ) => void;
  clearDialog: (persistenceKey: string) => void;
  setStep: (persistenceKey: string, stepIndex: number) => void;
  updateData: (
    persistenceKey: string,
    updates: Record<string, unknown>,
  ) => void;
  setProcessing: (persistenceKey: string, processing: boolean) => void;
  updateConfig: (
    persistenceKey: string,
    configUpdates: Record<string, unknown>,
  ) => void;
  setExplicitlyClosed: (persistenceKey: string, closed: boolean) => void;

  // Getters
  getDialogState: (persistenceKey: string) => DialogState;
}

// Default dialog state
const defaultDialogState: DialogState = {
  currentStepIndex: 0,
  data: {},
  isProcessing: false,
  wasExplicitlyClosed: false,
};

// Create the store with persistence
export const useMultiPageDialogStore = create<MultiPageDialogState>()(
  persist(
    (set, get) => ({
      // Initial state
      dialogs: {},

      // Initialize dialog state if it doesn't exist
      initDialog: (persistenceKey: string, initialData = {}) => {
        set((state) => {
          // Don't reinitialize if dialog already exists
          if (state.dialogs[persistenceKey]) {
            return state;
          }

          return {
            dialogs: {
              ...state.dialogs,
              [persistenceKey]: {
                ...defaultDialogState,
                data: { ...initialData },
              },
            },
          };
        });
      },

      clearDialog: (persistenceKey: string) => {
        set((state) => {
          const newDialogs = { ...state.dialogs };
          delete newDialogs[persistenceKey];
          return {
            dialogs: newDialogs,
          };
        });
      },

      setStep: (persistenceKey: string, stepIndex: number) => {
        set((state) => {
          const dialog = state.dialogs[persistenceKey];
          if (!dialog) return state;

          return {
            dialogs: {
              ...state.dialogs,
              [persistenceKey]: {
                ...dialog,
                currentStepIndex: stepIndex,
              },
            },
          };
        });
      },

      updateData: (
        persistenceKey: string,
        updates: Record<string, unknown>,
      ) => {
        set((state) => {
          const dialog = state.dialogs[persistenceKey];
          if (!dialog) return state;

          return {
            dialogs: {
              ...state.dialogs,
              [persistenceKey]: {
                ...dialog,
                data: { ...dialog.data, ...updates },
              },
            },
          };
        });
      },

      setProcessing: (persistenceKey: string, processing: boolean) => {
        set((state) => {
          const dialog = state.dialogs[persistenceKey];
          if (!dialog) return state;

          return {
            dialogs: {
              ...state.dialogs,
              [persistenceKey]: {
                ...dialog,
                isProcessing: processing,
              },
            },
          };
        });
      },

      updateConfig: (
        persistenceKey: string,
        configUpdates: Record<string, unknown>,
      ) => {
        set((state) => {
          const dialog = state.dialogs[persistenceKey];
          if (!dialog) return state;

          return {
            dialogs: {
              ...state.dialogs,
              [persistenceKey]: {
                ...dialog,
                config: { ...dialog.config, ...configUpdates },
              },
            },
          };
        });
      },

      setExplicitlyClosed: (persistenceKey: string, closed: boolean) => {
        set((state) => {
          const dialog = state.dialogs[persistenceKey];
          if (!dialog) return state;

          return {
            dialogs: {
              ...state.dialogs,
              [persistenceKey]: {
                ...dialog,
                wasExplicitlyClosed: closed,
              },
            },
          };
        });
      },

      // Getters
      getDialogState: (persistenceKey: string) => {
        const state = get();
        return state.dialogs[persistenceKey] ?? defaultDialogState;
      },
    }),
    {
      name: "multi-page-dialog-storage",
      storage: createJSONStorage(() => localStorage),
      // Only persist the dialog data
      partialize: (state) => ({
        dialogs: state.dialogs,
      }),
    },
  ),
);
