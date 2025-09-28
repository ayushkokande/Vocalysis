import { createContext, useContext, useState } from 'react'

const StudioDataContext = createContext(null)

export function StudioDataProvider({ children }) {
  const [analysis, setAnalysis] = useState(null)
  const [analysisGoal, setAnalysisGoal] = useState(null)
  return (
    <StudioDataContext.Provider value={{ analysis, setAnalysis, analysisGoal, setAnalysisGoal }}>
      {children}
    </StudioDataContext.Provider>
  )
}

export function useStudioData() {
  const context = useContext(StudioDataContext)
  if (!context) {
    throw new Error('useStudioData must be used within a StudioDataProvider')
  }
  return context
}
