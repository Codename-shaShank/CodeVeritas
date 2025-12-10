import useAnalysis from "@/hooks/useAnalysis"
import useFileSystem from "@/hooks/useFileSystem"
import useWindowDimensions from "@/hooks/useWindowDimensions"
import { useState } from "react"
import { TbRobot } from "react-icons/tb"

function AnalysisTab() {
    const { analysisResult, isAnalyzing } = useAnalysis()
    const { tabHeight } = useWindowDimensions()
    const [activeAITab, setActiveAITab] = useState("gemini")

    // REMOVED ALL HIGHLIGHT LOGIC - Let Editor handle it

    if (isAnalyzing) {
        return (
            <div className="flex flex-col items-center justify-center p-4" style={{ height: tabHeight }}>
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
                <p className="text-white">Analyzing your code with AI...</p>
            </div>
        )
    }

    if (!analysisResult) {
        return (
            <div className="flex flex-col items-center justify-center p-4 text-center" style={{ height: tabHeight }}>
                <TbRobot size={48} className="text-gray-500 mb-4" />
                <h2 className="text-xl text-white mb-2">AI Code Analysis</h2>
                <p className="text-gray-400">Run your code first to see AI-powered analysis and comparisons</p>
            </div>
        )
    }

    const getAICode = (aiName) => {
        return analysisResult.generated_codes[aiName] || "No code generated"
    }

    const getSimilarLines = (aiName) => {
        return analysisResult.similar_lines[`${aiName}_vs_user`] || []
    }

    const aiModels = [
        { id: "gemini", name: "Gemini", color: "border-blue-500", bgColor: "bg-blue-500" },
        { id: "chatgpt", name: "ChatGPT", color: "border-green-500", bgColor: "bg-green-500" },
        { id: "claude", name: "Claude", color: "border-purple-500", bgColor: "bg-purple-500" }
    ]

    // Calculate total highlighted lines count
    const totalHighlightedLines = analysisResult.similar_lines ? 
        new Set(Object.values(analysisResult.similar_lines).flat().map(m => m.user_line_number)).size : 0

    return (
        <div className="flex flex-col p-4" style={{ height: tabHeight }}>
            <h1 className="tab-title mb-4">AI Code Analysis</h1>
            
            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-grow overflow-hidden">
                {/* User Code Panel */}
                <div className="bg-darkHover rounded-lg p-4 flex flex-col">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-lg font-semibold text-white flex items-center">
                            <span className="w-3 h-3 bg-primary rounded-full mr-2"></span>
                            Your Code
                        </h3>
                        <span className="text-xs px-2 py-1 bg-primary text-black rounded-full font-medium">
                            {totalHighlightedLines} lines highlighted
                        </span>
                    </div>
                    <div className="bg-dark rounded p-4 flex-grow overflow-auto">
                        <pre className="text-sm text-gray-200 whitespace-pre-wrap font-mono">
                            {analysisResult.user_code}
                        </pre>
                    </div>
                </div>

                {/* AI Code Panel */}
                <div className="bg-darkHover rounded-lg p-4 flex flex-col">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-lg font-semibold text-white flex items-center">
                            <span className="w-3 h-3 bg-secondary rounded-full mr-2"></span>
                            AI Generated Code
                        </h3>
                        <span className="text-xs text-gray-400">
                            Click tabs to compare
                        </span>
                    </div>
                    
                    {/* AI Model Tabs */}
                    <div className="flex space-x-1 mb-4 bg-dark rounded p-1">
                        {aiModels.map((model) => (
                            <button
                                key={model.id}
                                onClick={() => setActiveAITab(model.id)}
                                className={`flex-1 py-2 px-3 rounded text-sm font-medium transition-all ${
                                    activeAITab === model.id
                                        ? 'bg-primary text-black'
                                        : 'text-gray-300 hover:text-white hover:bg-darkHover'
                                }`}
                            >
                                {model.name}
                            </button>
                        ))}
                    </div>

                    {/* AI Code Display */}
                    <div className="bg-dark rounded p-4 flex-grow overflow-auto relative">
                        <div className={`absolute top-0 left-0 w-1 h-full ${aiModels.find(m => m.id === activeAITab)?.bgColor}`}></div>
                        <pre className="text-sm text-gray-200 whitespace-pre-wrap font-mono pl-4">
                            {getAICode(activeAITab)}
                        </pre>
                    </div>

                    {/* Similar Lines Info */}
                    <div className="mt-4 p-3 bg-dark rounded">
                        <h4 className="text-sm font-semibold text-white mb-3 flex items-center">
                            <span className={`w-2 h-2 rounded-full mr-2 ${aiModels.find(m => m.id === activeAITab)?.bgColor}`}></span>
                            Similar Lines Found: {getSimilarLines(activeAITab).length}
                        </h4>
                        <div className="text-xs text-gray-400 space-y-2 max-h-24 overflow-y-auto">
                            {getSimilarLines(activeAITab).length > 0 ? (
                                getSimilarLines(activeAITab).map((match, index) => (
                                    <div key={index} className="flex justify-between items-center p-2 bg-darkHover rounded">
                                        <span className="font-mono">
                                            Line {match.user_line_number} ↔ {match.ai_line_number}
                                        </span>
                                        <code className="text-primary bg-black px-2 py-1 rounded text-xs">
                                            {match.line_content.trim()}
                                        </code>
                                    </div>
                                ))
                            ) : (
                                <p className="text-gray-500 text-center py-2">No similar lines found</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Summary */}
            <div className="mt-4 p-4 bg-darkHover rounded-lg">
                <h3 className="text-lg font-semibold text-white mb-3">Analysis Summary</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    {aiModels.map((model) => {
                        const similarCount = getSimilarLines(model.id).length
                        return (
                            <div key={model.id} className="bg-dark rounded p-4 border-l-4" style={{ borderLeftColor: model.bgColor.replace('bg-', '') }}>
                                <div className="flex justify-between items-center mb-2">
                                    <span className="font-medium text-white">{model.name}</span>
                                    <span className={`text-xs px-2 py-1 rounded ${
                                        similarCount > 5 ? 'bg-green-500 text-white' :
                                        similarCount > 2 ? 'bg-yellow-500 text-black' :
                                        'bg-red-500 text-white'
                                    }`}>
                                        {similarCount} matches
                                    </span>
                                </div>
                                <p className="text-gray-400 text-xs">
                                    {similarCount > 5 ? "High similarity with your code" :
                                     similarCount > 2 ? "Moderate similarity detected" :
                                     "Low similarity with your code"}
                                </p>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}

export default AnalysisTab