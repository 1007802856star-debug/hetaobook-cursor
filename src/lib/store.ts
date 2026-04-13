import { create } from 'zustand'

interface AppState {
  selectedAssignmentId: string | null
  activeTab: string
  gradingInProgress: boolean
  assignmentVersion: number
  setSelectedAssignmentId: (id: string | null) => void
  setActiveTab: (tab: string) => void
  setGradingInProgress: (inProgress: boolean) => void
  bumpAssignmentVersion: () => void
}

export const useAppStore = create<AppState>((set) => ({
  selectedAssignmentId: null,
  activeTab: 'assignments',
  gradingInProgress: false,
  assignmentVersion: 0,
  setSelectedAssignmentId: (id) => set({ selectedAssignmentId: id }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  setGradingInProgress: (inProgress) => set({ gradingInProgress: inProgress }),
  bumpAssignmentVersion: () => set((state) => ({ assignmentVersion: state.assignmentVersion + 1 })),
}))
