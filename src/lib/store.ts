import { create } from 'zustand'

interface AppState {
  selectedAssignmentId: string | null
  activeTab: string
  gradingInProgress: boolean
  setSelectedAssignmentId: (id: string | null) => void
  setActiveTab: (tab: string) => void
  setGradingInProgress: (inProgress: boolean) => void
}

export const useAppStore = create<AppState>((set) => ({
  selectedAssignmentId: null,
  activeTab: 'assignments',
  gradingInProgress: false,
  setSelectedAssignmentId: (id) => set({ selectedAssignmentId: id }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  setGradingInProgress: (inProgress) => set({ gradingInProgress: inProgress }),
}))
