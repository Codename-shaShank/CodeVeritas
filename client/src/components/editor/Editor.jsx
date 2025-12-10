import useAppContext from "@/hooks/useAppContext"
import toast from 'react-hot-toast'
import useFileSystem from "@/hooks/useFileSystem"
import usePageEvents from "@/hooks/usePageEvents"
import useSetting from "@/hooks/useSetting"
import useSocket from "@/hooks/useSocket"
import useWindowDimensions from "@/hooks/useWindowDimensions"
import { editorThemes } from "@/resources/Themes"
import ACTIONS from "@/utils/actions"
import placeholder from "@/utils/editorPlaceholder"
import { color } from "@uiw/codemirror-extensions-color"
import { hyperLink } from "@uiw/codemirror-extensions-hyper-link"
import { loadLanguage } from "@uiw/codemirror-extensions-langs"
import CodeMirror from "@uiw/react-codemirror"
import { useState, useEffect, useRef, useCallback } from "react"
import { cursorTooltipBaseTheme, tooltipField } from "./tooltip"
import { EditorView } from "@codemirror/view"

// Available languages for the dropdown
const LANGUAGE_OPTIONS = [
    { value: "cpp", label: "C++" },
    { value: "python", label: "Python" },
    { value: "java", label: "Java" },
    { value: "javascript", label: "JavaScript" },
    { value: "typescript", label: "TypeScript" },
    { value: "c", label: "C" },
    { value: "csharp", label: "C#" },
    { value: "go", label: "Go" },
    { value: "rust", label: "Rust" },
    { value: "php", label: "PHP" },
    { value: "ruby", label: "Ruby" },
    { value: "swift", label: "Swift" },
    { value: "kotlin", label: "Kotlin" },
]

function Editor() {
    const { users, currentUser, roomQuestions } = useAppContext()
    const { currentFile, setCurrentFile } = useFileSystem()
    const { theme, fontSize } = useSetting()
    const { socket } = useSocket()
    const { tabHeight } = useWindowDimensions()
    const [timeOut, setTimeOut] = useState(null)

    // AI State
    const [selectedLanguage, setSelectedLanguage] = useState("cpp")
    const [selectedQuestionId, setSelectedQuestionId] = useState(null)

    const codeRef = useRef(currentFile.content)
    const editorViewRef = useRef(null)
    const isEditorReadyRef = useRef(false)

    useEffect(() => { codeRef.current = currentFile.content }, [currentFile.content])

    const filteredUsers = users.filter((u) => u.username !== currentUser.username)

    const onCodeChange = useCallback((code, view) => {
        const file = { ...currentFile, content: code }
        setCurrentFile(file)
        socket.emit(ACTIONS.FILE_UPDATED, { file })
        const cursorPosition = view.state?.selection?.main?.head
        socket.emit(ACTIONS.TYPING_START, { cursorPosition })
        clearTimeout(timeOut)
        const newTimeOut = setTimeout(() => socket.emit(ACTIONS.TYPING_PAUSE), 1000)
        setTimeOut(newTimeOut)
    }, [currentFile, socket, timeOut])

    usePageEvents()

    // Safe highlight extension
    const getExtensions = useCallback(() => {
        const extensions = [
            color,
            hyperLink,
            tooltipField(filteredUsers),
            cursorTooltipBaseTheme,
        ]
        const langExt = selectedLanguage !== 'c++' ? loadLanguage(selectedLanguage.toLowerCase()) : loadLanguage('cpp')
        if (langExt) extensions.push(langExt)

        return extensions;
    }, [filteredUsers, selectedLanguage])

    // Get editor reference safely
    const handleEditorCreate = useCallback((view) => {
        editorViewRef.current = view;
        isEditorReadyRef.current = true;
    }, []);

    // Handle language change
    const handleLanguageChange = useCallback((e) => {
        setSelectedLanguage(e.target.value);
    }, [])

    return (
        <div className="flex flex-col w-full h-full">
            {/* Top Section: Question display + Language Selector + Submit Code Button */}
            <div className="bg-darkHover border-b border-gray-700 shrink-0 p-3">
                <div className="flex items-center gap-3 mb-3">
                    {/* Language Selector */}
                    <div className="flex flex-col">
                        <label className="text-xs text-gray-400 mb-1">Language</label>
                        <select
                            value={selectedLanguage}
                            onChange={handleLanguageChange}
                            className="bg-dark border border-gray-600 text-white text-sm rounded px-3 py-2 outline-none focus:border-primary min-w-[120px]"
                        >
                            {LANGUAGE_OPTIONS.map((lang) => (
                                <option key={lang.value} value={lang.value}>
                                    {lang.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Question Display with Selector */}
                    <div className="flex-1 flex flex-col">
                        <label className="text-xs text-gray-400 mb-1">Question</label>
                        <div className="flex gap-2 items-center">
                            {roomQuestions && roomQuestions.length > 0 ? (
                                <>
                                    {!selectedQuestionId ? (
                                        <select
                                            value={selectedQuestionId || ''}
                                            onChange={(e) => setSelectedQuestionId(e.target.value)}
                                            className="flex-1 p-2 bg-darkHover text-white rounded text-sm border border-gray-700 focus:outline-none focus:border-primary"
                                        >
                                            <option value="">-- Select a question --</option>
                                            {roomQuestions.map((q, idx) => (
                                                <option key={q._id} value={q._id}>
                                                    Q{idx + 1}: {q.text.substring(0, 50)}{q.text.length > 50 ? '...' : ''}
                                                </option>
                                            ))}
                                        </select>
                                    ) : (
                                        <div className="flex-1 flex items-center justify-between p-2 bg-dark/50 text-gray-200 rounded text-sm border-l-4 border-primary/50">
                                            <span>
                                                <span className="text-primary font-bold mr-2">Q{roomQuestions.findIndex(q => q._id === selectedQuestionId) + 1}:</span>
                                                {roomQuestions.find(q => q._id === selectedQuestionId)?.text}
                                            </span>
                                            <button
                                                onClick={() => setSelectedQuestionId(null)}
                                                className="text-xs text-gray-400 hover:text-white underline ml-2 whitespace-nowrap"
                                            >
                                                Change
                                            </button>
                                        </div>
                                    )}

                                    <button
                                        onClick={() => {
                                            // submit current code as candidate submission
                                            if (!selectedQuestionId) {
                                                toast.error('Please select a question')
                                                return
                                            }
                                            if (!codeRef.current || !codeRef.current.trim()) {
                                                toast.error('Please write code before submitting')
                                                return
                                            }
                                            socket.emit(ACTIONS.SUBMIT_CODE, { token: currentUser.token, roomId: currentUser.roomId, language: selectedLanguage, code: codeRef.current, questionId: selectedQuestionId })
                                            toast.success('Code submitted')
                                        }}
                                        className={`px-4 py-2 rounded text-sm font-medium transition-all min-w-[140px] bg-primary text-black hover:bg-primary/90`}
                                    >
                                        Submit Code
                                    </button>
                                </>
                            ) : (
                                <div className="flex-1 p-2 bg-dark text-gray-400 rounded text-sm">
                                    No questions yet. Wait for admin to post.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex flex-1 min-h-0 editor-main-container">
                {/* Editor Container */}
                <div className="flex-1 min-w-0 w-full">
                    <CodeMirror
                        placeholder={placeholder(currentFile.name)}
                        mode={selectedLanguage.toLowerCase()}
                        theme={editorThemes[theme]}
                        onChange={onCodeChange}
                        onCreateEditor={handleEditorCreate}
                        value={currentFile.content}
                        extensions={getExtensions()}
                        height="100%"
                        style={{
                            fontSize: fontSize + "px",
                        }}
                    />
                </div>
            </div>
        </div>
    )
}

export default Editor