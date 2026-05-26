import { createContext, useEffect, useState } from "react"
import PropTypes from "prop-types"
import useFileSystem from "@/hooks/useFileSystem"
import useSocket from "@/hooks/useSocket"
import useAppContext from "@/hooks/useAppContext"
import axiosInstance from "@/api/"
import ACTIONS from "@/utils/actions"
import toast from "react-hot-toast"
import langMap from "lang-map"

const RunCodeContext = createContext()

const RunCodeContextProvider = ({ children }) => {
    const { currentFile } = useFileSystem()
    const { socket } = useSocket()
    const { currentUser } = useAppContext()
    const [input, setInput] = useState("")
    const [output, setOutput] = useState("")
    const [isRunning, setIsRunning] = useState(false)
    const [supportedLanguages, setSupportedLanguages] = useState([])
    const [selectedLanguage, setSelectedLanguage] = useState("")

    // ── Execution pipeline state ──
    const [submissionId, setSubmissionId] = useState(null)
    const [executionStage, setExecutionStage] = useState("idle") // idle | queued | compiling | running | done
    const [verdict, setVerdict] = useState(null)
    const [executionTime, setExecutionTime] = useState(null)

    // Fetch supported languages from Piston API (retained for dropdown labels only)
    useEffect(() => {
        const fetchSupportedLanguages = async () => {
            try {
                const languages = await axiosInstance.get("/runtimes")
                setSupportedLanguages(languages.data)
            } catch (error) {
                console.error(error.response?.data)
                toast.error("Failed to fetch supported languages")
            }
        }
        fetchSupportedLanguages()
    }, [])

    // Auto-detect language from file extension (unchanged)
    useEffect(() => {
        if (supportedLanguages.length === 0 || !currentFile?.name) return

        const extension = currentFile.name.split(".").pop()
        const languageName = langMap.languages(extension)
        const language = supportedLanguages.find(
            (lang) =>
                lang.aliases.includes(extension) ||
                languageName.includes(lang.language.toLowerCase()),
        )

        if (language) setSelectedLanguage(language)
        else setSelectedLanguage("")
    }, [currentFile?.name, supportedLanguages])

    // ── Socket listeners for the execution pipeline ──
    useEffect(() => {
        if (!socket) return

        const handleExecutionStatus = (data) => {
            setSubmissionId(data.submissionId)
            setExecutionStage(data.stage)
        }

        const handleExecutionResult = (data) => {
            setSubmissionId(data.submissionId)
            setExecutionStage("done")
            setVerdict(data.verdict)
            setExecutionTime(data.executionTimeMs ?? null)

            // Route output: stderr for error verdicts, stdout for success
            if (data.stderr && data.verdict !== "AC") {
                setOutput(data.stderr)
            } else {
                setOutput(data.stdout || "")
            }

            setIsRunning(false)
            toast.dismiss()

            // Verdict-specific toast notifications
            switch (data.verdict) {
                case "AC":
                    toast.success(`✓ Accepted (${data.executionTimeMs}ms)`)
                    break
                case "WA":
                    toast.error("✗ Wrong Answer")
                    break
                case "CE":
                    toast.error("⚠ Compilation Error")
                    break
                case "TLE":
                    toast.error("⏱ Time Limit Exceeded")
                    break
                case "MLE":
                    toast.error("💾 Memory Limit Exceeded")
                    break
                case "RE":
                    toast.error("💥 Runtime Error")
                    break
                default:
                    toast.error(`Verdict: ${data.verdict}`)
            }
        }

        socket.on(ACTIONS.CODE_EXECUTION_STATUS, handleExecutionStatus)
        socket.on(ACTIONS.CODE_EXECUTION_RESULT, handleExecutionResult)

        return () => {
            socket.off(ACTIONS.CODE_EXECUTION_STATUS, handleExecutionStatus)
            socket.off(ACTIONS.CODE_EXECUTION_RESULT, handleExecutionResult)
        }
    }, [socket])

    // ── Run code via Kafka pipeline (non-blocking) ──
    const runCode = () => {
        if (!selectedLanguage) {
            return toast.error("Please select a language to run the code")
        }
        if (!currentFile) {
            return toast.error("Please open a file to run the code")
        }
        if (!socket) {
            return toast.error("Socket connection unavailable")
        }

        // Reset state for new execution
        setIsRunning(true)
        setOutput("")
        setVerdict(null)
        setExecutionTime(null)
        setExecutionStage("queued")

        const { language } = selectedLanguage

        // Emit to socket — completely non-blocking, no await needed
        socket.emit(ACTIONS.RUN_CODE, {
            code: currentFile.content,
            language,
            input,
            roomId: currentUser?.roomId || null,
        })
    }

    return (
        <RunCodeContext.Provider
            value={{
                setInput,
                output,
                isRunning,
                supportedLanguages,
                selectedLanguage,
                setSelectedLanguage,
                runCode,
                submissionId,
                executionStage,
                verdict,
                executionTime,
            }}
        >
            {children}
        </RunCodeContext.Provider>
    )
}

RunCodeContextProvider.propTypes = {
    children: PropTypes.node.isRequired,
}

export { RunCodeContextProvider }
export default RunCodeContext
