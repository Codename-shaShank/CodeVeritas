import useFileSystem from "@/hooks/useFileSystem"
import PropTypes from "prop-types"
import { useState } from "react"
import toast from "react-hot-toast"
import { FaCheck } from "react-icons/fa6"
import { IoClose } from "react-icons/io5"

function FileEditor({ editingFileId, setEditingFileId, name }) {
    const [fileName, setFileName] = useState(name || "")
    const { renameFile, openFile } = useFileSystem()

    const handleOnChange = (e) => {
        setFileName(e.target.value)
    }

    const handleConfirm = (e) => {
        e.preventDefault()

        if (fileName === "") {
            toast.error("File name cannot be empty")
        } else if (fileName.length > 25) {
            toast.error("File name cannot be longer than 25 characters")
        } else if (fileName === name) {
            toast.error("File name cannot be the same as before")
        } else {
            const isRenamed = renameFile(editingFileId, fileName)
            openFile(editingFileId)
            if (!isRenamed) {
                toast.error("File with same name already exists")
            } else {
                setEditingFileId(null)
            }
        }
    }

    const handleCancel = () => {
        setEditingFileId(null)
    }

    return (
        <div className="rounded-md">
            <form
                onSubmit={handleConfirm}
                className="mb-2 flex w-full gap-4 rounded-md bg-darkHover p-2"
            >
                <input
                    type="text"
                    className="w-[80%] flex-grow rounded-md bg-dark border border-gray-600 px-2 py-1 text-base text-white outline-none transition-colors focus:border-primary/50"
                    autoFocus
                    value={fileName}
                    onChange={handleOnChange}
                />
                <span className="flex gap-4">
                    <button onClick={handleConfirm} type="submit" className="rounded p-1.5 text-primary transition-colors hover:bg-primary/20 cursor-pointer">
                        <FaCheck size={18} />
                    </button>
                    <button onClick={handleCancel} type="reset" className="rounded p-1.5 text-gray-400 transition-colors hover:bg-red-900/30 hover:text-danger cursor-pointer">
                        <IoClose size={22} />
                    </button>
                </span>
            </form>
        </div>
    )
}

FileEditor.propTypes = {
    editingFileId: PropTypes.string.isRequired,
    setEditingFileId: PropTypes.func.isRequired,
    name: PropTypes.string.isRequired,
}

export default FileEditor
