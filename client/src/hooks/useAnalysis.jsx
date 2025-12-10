// hooks/useAnalysis.js
import AnalysisContext from "@/context/AnalysisContext"
import { useContext } from "react"

function useAnalysis() {
    return useContext(AnalysisContext)
}

export default useAnalysis