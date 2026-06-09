
import { useRunCode } from "@/hooks/useRunCode"
import useAnalysis from "@/hooks/useAnalysis"
import useTab from "@/hooks/useTabs"
import useFileSystem from "@/hooks/useFileSystem"
import useWindowDimensions from "@/hooks/useWindowDimensions"
import TABS from "@/utils/tabs"
import toast from "react-hot-toast"
import { PiCaretDownBold } from "react-icons/pi"
import { LuCopy } from "react-icons/lu"

// ── Pipeline & Verdict Configuration ──

const PIPELINE_STEPS = [
    { key: "queued", label: "Queue", icon: "📋" },
    { key: "compiling", label: "Compile", icon: "⚙️" },
    { key: "running", label: "Run", icon: "▶" },
    { key: "done", label: "Result", icon: "✓" },
]

const STAGE_INDEX = { idle: -1, queued: 0, compiling: 1, running: 2, done: 3 }

const VERDICT_CONFIG = {
    AC: { label: "✓ Accepted", className: "verdict-ac" },
    WA: { label: "✗ Wrong Answer", className: "verdict-wa" },
    TLE: { label: "⏱ Time Limit Exceeded", className: "verdict-tle" },
    MLE: { label: "💾 Memory Limit Exceeded", className: "verdict-mle" },
    CE: { label: "⚠ Compilation Error", className: "verdict-ce" },
    RE: { label: "💥 Runtime Error", className: "verdict-re" },
}

function RunTab() {
    const { tabHeight } = useWindowDimensions()
    const {
        setInput,
        output,
        isRunning,
        supportedLanguages,
        selectedLanguage,
        setSelectedLanguage,
        runCode,
        executionStage,
        verdict,
        executionTime,
    } = useRunCode()
    const { setAnalysisResult, setIsAnalyzing } = useAnalysis()
    const { setActiveTab } = useTab()
    const { currentFile } = useFileSystem()

    const currentStageIndex = STAGE_INDEX[executionStage] ?? -1

    const handleLanguageChange = (e) => {
        const lang = JSON.parse(e.target.value)
        setSelectedLanguage(lang)
    }

    const copyOutput = () => {
        if (!output) {
            toast.error("No output to copy")
            return
        }
        navigator.clipboard.writeText(output)
        toast.success("Output copied to clipboard")
    }

    // ── Dynamic Run Button ──
    const renderRunButton = () => {
        let label = "▶ Run Code"
        let extraClass = " bg-primary text-black hover:bg-primary/90"

        if (executionStage === "queued") {
            label = "◉ In Queue..."
            extraClass = " bg-amber-500 text-black animate-pulse"
        } else if (executionStage === "compiling") {
            label = "Compiling..."
            extraClass = " bg-sky-500 text-white"
        } else if (executionStage === "running") {
            label = "▶ Executing..."
            extraClass = " bg-cyan-400 text-black animate-pulse"
        }

        return (
            <button
                className={
                    "flex-1 rounded-md py-3 font-bold transition-all cursor-pointer " +
                    "disabled:cursor-not-allowed disabled:opacity-50 " +
                    "flex items-center justify-center gap-2" +
                    extraClass
                }
                onClick={runCode}
                disabled={isRunning || !selectedLanguage || !currentFile}
            >
                {executionStage === "compiling" && (
                    <svg
                        className="animate-spin h-4 w-4"
                        viewBox="0 0 24 24"
                        fill="none"
                    >
                        <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                        />
                        <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                    </svg>
                )}
                {label}
            </button>
        )
    }

    // ── Pipeline Progress Bar ──
    const renderPipeline = () => {
        if (executionStage === "idle") return null

        const elements = []

        PIPELINE_STEPS.forEach((step, index) => {
            let nodeState = "pending"
            if (index < currentStageIndex) nodeState = "completed"
            else if (index === currentStageIndex) nodeState = "active"

            // Connector between previous step and this step
            if (index > 0) {
                let connState = "pending"
                if (index < currentStageIndex) connState = "completed"
                else if (index === currentStageIndex) connState = "active"

                elements.push(
                    <div
                        key={`conn-${index}`}
                        className={`pipeline-connector ${connState}`}
                    />,
                )
            }

            elements.push(
                <div key={step.key} className="pipeline-step">
                    <div className={`pipeline-node ${nodeState}`}>
                        {nodeState === "completed" ? "✓" : step.icon}
                    </div>
                    <span className={`pipeline-label ${nodeState}`}>
                        {step.label}
                    </span>
                </div>,
            )
        })

        return <div className="execution-pipeline">{elements}</div>
    }

    // ── Verdict Badge ──
    const renderVerdictBadge = () => {
        if (!verdict || !VERDICT_CONFIG[verdict]) return null

        const config = VERDICT_CONFIG[verdict]
        return (
            <div className={`verdict-badge ${config.className}`}>
                <span>{config.label}</span>
                {executionTime != null && (
                    <span className="verdict-time">· {executionTime}ms</span>
                )}
            </div>
        )
    }

    // ═══════════════════════════════════════════════════════════
    // ══ Analyze with AI — PRESERVED UNCHANGED (DO NOT EDIT) ══
    // ═══════════════════════════════════════════════════════════

    const analyzeCode = async () => {
        if (!currentFile) {
            toast.error("Please open a file to analyze")
            return
        }

        if (!currentFile.content || currentFile.content.trim().length === 0) {
            toast.error("Please write some code to analyze")
            return
        }

        try {
            setIsAnalyzing(true)
            const loadingToast = toast.loading("Analyzing code with AI...")
            
            console.log("📤 Analyzing code:", currentFile.content)

            // Simulate API delay
            await new Promise(resolve => setTimeout(resolve, 2000))

            // Generate mock analysis data based on user's code
            const mockResponse = generateMockAnalysis(currentFile.content, currentFile.name)
            
            console.log("📥 Mock analysis response:", mockResponse)
            
            setAnalysisResult(mockResponse)
            setActiveTab(TABS.ANALYSIS)
            toast.dismiss(loadingToast)
            toast.success("Code analysis completed! (Using mock data)")
        } catch (error) {
            console.error("❌ Analysis failed:", error)
            toast.dismiss()
            toast.error("Analysis failed. Please try again.")
        } finally {
            setIsAnalyzing(false)
        }
    }

    // Function to generate mock analysis data
    const generateMockAnalysis = (userCode, fileName) => {
        const lines = userCode.split('\n')
        
        // Generate mock similar lines based on actual code structure
        const similarLines = {
            gemini_vs_user: generateSimilarLines(lines, 0.7), // 70% similarity
            chatgpt_vs_user: generateSimilarLines(lines, 0.6), // 60% similarity
            claude_vs_user: generateSimilarLines(lines, 0.8)  // 80% similarity
        }

        // Generate mock AI codes based on user's code
        const generatedCodes = {
            gemini: generateAICode(userCode, "gemini"),
            chatgpt: generateAICode(userCode, "chatgpt"),
            claude: generateAICode(userCode, "claude")
        }

        return {
            question: `Analyze the ${fileName} code`,
            user_code: userCode,
            generated_codes: generatedCodes,
            similar_lines: similarLines
        }
    }

    const generateSimilarLines = (userLines, similarityFactor) => {
        const matches = []
        const totalLines = userLines.length
        
        // Always include important structural lines
        const importantLines = userLines
            .map((line, index) => ({ line, index: index + 1 }))
            .filter(({ line }) => 
                line.includes('#include') || 
                line.includes('using namespace') ||
                line.includes('void ') ||
                line.includes('int main') ||
                line.includes('cout') ||
                line.includes('return')
            )
            .slice(0, 5) // Take up to 5 important lines

        importantLines.forEach(({ index }) => {
            matches.push({
                user_line_number: index,
                ai_line_number: index,
                line_content: userLines[index - 1]?.trim() || ''
            })
        })

        // Add more lines based on similarity factor
        for (let i = 0; i < totalLines; i++) {
            if (Math.random() < similarityFactor && 
                userLines[i].trim().length > 2 && 
                !matches.some(m => m.user_line_number === i + 1)) {
                matches.push({
                    user_line_number: i + 1,
                    ai_line_number: i + 1,
                    line_content: userLines[i].trim()
                })
            }
        }

        return matches.sort((a, b) => a.user_line_number - b.user_line_number)
    }

    const generateAICode = (userCode, aiModel) => {
        const lines = userCode.split('\n')
        
        switch (aiModel) {
            case "gemini":
                return lines.map(line => {
                    if (line.includes('if') && line.includes('else')) {
                        return line.replace('else', '').replace('{', '').trim()
                    }
                    if (line.includes('return')) {
                        return `    ${line.trim()}`
                    }
                    return line
                }).join('\n')

            case "chatgpt":
                return lines.map(line => {
                    if (line.includes('//')) {
                        return `# ${line.replace('//', '').trim()}`
                    }
                    if (line.includes('{')) {
                        return line.replace('{', ':').replace('}', '')
                    }
                    return line
                }).join('\n')

            case "claude":
                return lines.map((line, index) => {
                    if (index === 0) {
                        return `${line}:\n    try:`
                    }
                    if (line.includes('return')) {
                        return `        ${line.trim()}`
                    }
                    if (line.trim().length > 0 && !line.includes('}') && !line.includes('{')) {
                        return `    ${line.trim()}`
                    }
                    return line
                }).join('\n') + '\n    except Exception as e:\n        return f"Error: {e}"'

            default:
                return userCode
        }
    }

    // ═══════════════════════════════════════════════════════════
    // ══ END Analyze with AI section                          ══
    // ═══════════════════════════════════════════════════════════

    return (
        <div
            className="flex flex-col items-center gap-4 p-4"
            style={{ height: tabHeight }}
        >
            <h1 className="tab-title">Run &amp; Analyze Code</h1>
            
            <div className="flex w-full flex-col gap-4 flex-grow">
                {/* Language Selection */}
                <div className="relative w-full">
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                        Language
                    </label>
                    <select
                        className="w-full rounded-md border border-transparent bg-darkHover px-4 py-3 text-white outline-none transition-colors focus:border-primary/50 cursor-pointer"
                        value={selectedLanguage ? JSON.stringify(selectedLanguage) : ""}
                        onChange={handleLanguageChange}
                    >
                        <option value="">Select a language</option>
                        {supportedLanguages
                            ?.sort((a, b) => (a.language > b.language ? 1 : -1))
                            .map((lang, i) => (
                                <option key={i} value={JSON.stringify(lang)}>
                                    {lang.language + (lang.version ? ` (${lang.version})` : "")}
                                </option>
                            ))}
                    </select>
                    <PiCaretDownBold
                        size={16}
                        className="absolute bottom-4 right-4 z-10 text-white"
                    />
                </div>

                {/* Input Area */}
                <div className="w-full">
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                        Input
                    </label>
                    <textarea
                        className="min-h-[120px] w-full resize-none rounded-md border border-transparent bg-darkHover p-3 text-white outline-none transition-colors focus:border-primary/50 placeholder:text-gray-500"
                        placeholder="Enter input for your program..."
                        onChange={(e) => setInput(e.target.value)}
                    />
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 w-full">
                    {renderRunButton()}

                    <button
                        className="flex-1 rounded-md bg-secondary py-3 font-bold text-white transition-all hover:bg-secondary/90 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                        onClick={analyzeCode}
                        disabled={!currentFile || !currentFile.content}
                    >
                        Analyze with AI
                    </button>
                </div>

                {/* ── Execution Pipeline Progress Bar ── */}
                {renderPipeline()}

                {/* ── Verdict Badge ── */}
                {renderVerdictBadge()}

                {/* Output Section */}
                <div className="flex-grow flex flex-col">
                    <div className="flex justify-between items-center mb-2">
                        <label className="text-sm font-medium text-gray-300">
                            Output
                        </label>
                        <button 
                            onClick={copyOutput} 
                            title="Copy Output"
                            disabled={!output}
                            className="text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <LuCopy size={18} />
                        </button>
                    </div>
                    <div
                        className={
                            "flex-grow rounded-md border p-3 overflow-auto transition-colors duration-300 " +
                            (verdict === "AC"
                                ? "border-emerald-500/30 bg-emerald-950/20"
                                : verdict && verdict !== "AC"
                                    ? "border-red-500/30 bg-red-950/20"
                                    : "border-transparent bg-darkHover")
                        }
                    >
                        <code className="text-sm">
                            <pre
                                className={`whitespace-pre-wrap font-mono ${
                                    output ? "text-white" : "text-gray-500"
                                }`}
                            >
                                {output || "Output will appear here after running your code..."}
                            </pre>
                        </code>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default RunTab