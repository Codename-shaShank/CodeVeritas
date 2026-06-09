import useAppContext from "@/hooks/useAppContext"
import useFileSystem from "@/hooks/useFileSystem"
import useWindowDimensions from "@/hooks/useWindowDimensions"
import STATES from "@/utils/states"
import DrawingEditor from "../drawing/DrawingEditor"
import Editor from "./Editor"

function EditorComponent() {
    
    const { currentFile } = useFileSystem()
    const { tabHeight } = useWindowDimensions()
    const { state } = useAppContext()

    return (
        <div
            className="absolute left-0 top-0 w-full max-w-full flex-grow overflow-x-hidden md:static"
            style={{ height: tabHeight }}
        >
            {state === STATES.DRAWING ? (
                <DrawingEditor />
            ) : currentFile !== null ? (
                <Editor />
            ) : (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                    <span className="text-4xl opacity-30">📄</span>
                    <h1 className="text-xl text-white">
                        No file is currently open.
                    </h1>
                    <p className="text-sm text-gray-500">Open a file from the sidebar to start coding</p>
                </div>
            )}
        </div>
    )
}

export default EditorComponent
