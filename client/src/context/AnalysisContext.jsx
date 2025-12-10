// context/AnalysisContext.js
import { createContext, useState } from "react"
import PropTypes from "prop-types"

const AnalysisContext = createContext()

function AnalysisContextProvider({ children }) {
    const [analysisResult, setAnalysisResult] = useState(null)
    const [isAnalyzing, setIsAnalyzing] = useState(false)

    return (
        <AnalysisContext.Provider
            value={{
                analysisResult,
                setAnalysisResult,
                isAnalyzing,
                setIsAnalyzing
            }}
        >
            {children}
        </AnalysisContext.Provider>
    )
}

AnalysisContextProvider.propTypes = {
    children: PropTypes.node.isRequired,
}

export { AnalysisContextProvider }
export default AnalysisContext