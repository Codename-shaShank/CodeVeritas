// import useAppContext from "@/hooks/useAppContext"
// import useSetting from "@/hooks/useSetting"
// import useSocket from "@/hooks/useSocket"
// import ACTIONS from "@/utils/actions"
// import initialFile from "@/utils/initialFile"
// import { saveAs } from "file-saver"
// import JSZip from "jszip"
// import langMap from "lang-map"
// import PropTypes from "prop-types"
// import { createContext, useCallback, useEffect, useState } from "react"
// import { toast } from "react-hot-toast"
// import { v4 as uuidv4 } from "uuid"

// const FileContext = createContext()

// function FileContextProvider({ children }) {
//     const { socket } = useSocket()
//     const { setLanguage } = useSetting()
//     const [files, setFiles] = useState([initialFile])
//     const [currentFile, setCurrentFile] = useState(initialFile)
//     const { setUsers, drawingData } = useAppContext()

//     const createFile = (name) => {
//         // Check if file with same name already exists
//         let num = 1
//         let fileExists = files.some((file) => file.name === name)

//         while (fileExists) {
//             name = `${name} (${num++})`
//             fileExists = files.some((file) => file.name === name)
//             if (!fileExists) break
//         }

//         const id = uuidv4()
//         const file = {
//             id,
//             name,
//             content: "",
//         }
//         setFiles((prev) => [...prev, file])

//         // File created event sent to server
//         socket.emit(ACTIONS.FILE_CREATED, { file })
//         return id
//     }

//     const updateFile = (id, content) => {
//         setFiles((prev) =>
//             prev.map((file) => {
//                 if (file.id === id) {
//                     file.content = content
//                 }
//                 return file
//             }),
//         )
//         // File updated event sent to server
//     }

//     const openFile = (id) => {
//         // Save current file
//         if (currentFile) {
//             updateFile(currentFile.id, currentFile.content)
//         }
//         const file = files.find((file) => file.id === id)
//         setCurrentFile(file)
//     }

//     const renameFile = (id, newName) => {
//         // Check if file with same name already exists
//         const fileExists = files.some((file) => file.name === newName)

//         if (fileExists) {
//             return false
//         }

//         setFiles((prev) =>
//             prev.map((file) => {
//                 if (file.id === id) {
//                     file.name = newName
//                 }
//                 return file
//             }),
//         )

//         // File renamed event sent to server
//         const file = { id, name: newName }
//         socket.emit(ACTIONS.FILE_RENAMED, { file })

//         return true
//     }

//     const deleteFile = (id) => {
//         setFiles((prev) => prev.filter((file) => file.id !== id))
//         if (currentFile.id === id) {
//             setCurrentFile(null)
//         }
//         // File deleted event sent to server
//         socket.emit(ACTIONS.FILE_DELETED, { id })
//     }

//     const downloadCurrentFile = () => {
//         const blob = new Blob([currentFile.content], {
//             type: "text/plain;charset=utf-8",
//         })
//         saveAs(blob, currentFile.name)
//     }

//     const downloadAllFiles = () => {
//         const zip = new JSZip()
//         files.forEach((file) => {
//             const blobFile = new Blob([file.content], {
//                 type: "text/plain;charset=utf-8",
//             })
//             zip.file(file.name, blobFile)
//         })
//         zip.generateAsync({ type: "blob" }).then(function (content) {
//             saveAs(content, "Code-Connect-Files.zip")
//         })
//     }

//     const handleUserJoined = useCallback(
//         ({ user }) => {
//             toast.success(`${user.username} joined the room`)
//             // send the code and drawing data to the server
//             socket.emit(ACTIONS.SYNC_FILES, {
//                 files,
//                 currentFile,
//                 socketId: user.socketId,
//             })
//             socket.emit(ACTIONS.SYNC_DRAWING, {
//                 drawingData,
//                 socketId: user.socketId,
//             })

//             setUsers((pre) => {
//                 return [...pre, user]
//             })
//         },
//         [currentFile, drawingData, files, setUsers, socket],
//     )

//     const handleFilesSync = useCallback(({ files, currentFile }) => {
//         setFiles(files)
//         setCurrentFile(currentFile)
//     }, [])

//     const handleFileRenamed = useCallback(({ file }) => {
//         setFiles((prev) =>
//             prev.map((f) => {
//                 if (f.id === file.id) {
//                     f.name = file.name
//                 }
//                 return f
//             }),
//         )
//     }, [])

//     const handleFileDeleted = useCallback(
//         ({ id }) => {
//             setFiles((prev) => prev.filter((file) => file.id !== id))
//             if (currentFile.id === id) {
//                 setCurrentFile(null)
//             }
//         },
//         [currentFile?.id],
//     )

//     const handleFileCreated = useCallback(({ file }) => {
//         setFiles((prev) => [...prev, file])
//     }, [])

//     const handleFileUpdated = useCallback(
//         ({ file }) => {
//             setFiles((prev) =>
//                 prev.map((f) => {
//                     if (f.id === file.id) {
//                         f.content = file.content
//                     }
//                     return f
//                 }),
//             )
//             if (currentFile.id === file.id) {
//                 setCurrentFile(file)
//             }
//         },
//         [currentFile?.id],
//     )

//     useEffect(() => {
//         if (currentFile === null) return
//         // Get file extension on file open and set language when file is opened
//         const language = langMap.languages(currentFile.name.split(".").pop())
//         setLanguage(language[0])
//     }, [currentFile, setLanguage])

//     useEffect(() => {
//         socket.once(ACTIONS.SYNC_FILES, handleFilesSync)
//         socket.on(ACTIONS.USER_JOINED, handleUserJoined)
//         socket.on(ACTIONS.FILE_CREATED, handleFileCreated)
//         socket.on(ACTIONS.FILE_UPDATED, handleFileUpdated)
//         socket.on(ACTIONS.FILE_RENAMED, handleFileRenamed)
//         socket.on(ACTIONS.FILE_DELETED, handleFileDeleted)

//         return () => {
//             socket.off(ACTIONS.USER_JOINED)
//             socket.off(ACTIONS.FILE_CREATED)
//             socket.off(ACTIONS.FILE_UPDATED)
//             socket.off(ACTIONS.FILE_RENAMED)
//             socket.off(ACTIONS.FILE_DELETED)
//         }
//     }, [
//         handleFileCreated,
//         handleFileDeleted,
//         handleFileRenamed,
//         handleFilesSync,
//         handleFileUpdated,
//         handleUserJoined,
//         socket,
//     ])

//     return (
//         <FileContext.Provider
//             value={{
//                 files,
//                 setFiles,
//                 currentFile,
//                 setCurrentFile,
//                 createFile,
//                 updateFile,
//                 openFile,
//                 renameFile,
//                 deleteFile,
//                 downloadCurrentFile,
//                 downloadAllFiles,
//             }}
//         >
//             {children}
//         </FileContext.Provider>
//     )
// }

// FileContextProvider.propTypes = {
//     children: PropTypes.node.isRequired,
// }

// export { FileContextProvider }
// export default FileContext

import useAppContext from "@/hooks/useAppContext"
import useSetting from "@/hooks/useSetting"
import useSocket from "@/hooks/useSocket"
import ACTIONS from "@/utils/actions"
import initialFile from "@/utils/initialFile"
import { saveAs } from "file-saver"
import JSZip from "jszip"
import langMap from "lang-map"
import PropTypes from "prop-types"
import { createContext, useCallback, useEffect, useState } from "react"
import toast from "react-hot-toast"
import { v4 as uuidv4 } from "uuid"
// import "../../index.css";

const FileContext = createContext()

function FileContextProvider({ children }) {
    const { socket } = useSocket()
    const { setLanguage } = useSetting()
    const [files, setFiles] = useState([initialFile])
    const [currentFile, setCurrentFile] = useState(initialFile)
    const { setUsers, drawingData } = useAppContext()
    const [similarLines, setSimilarLines] = useState([]);
const updateSimilarLines = (lines) => {
    setSimilarLines(lines);
};
    
    // Add state for highlighted lines
// In your FileContext.js - temporarily change to:
// In your FileContext.js - update the initial state with AI lines
const [highlightedLines, setHighlightedLines] = useState([1, 2, 3, 4, 7, 10, 11, 12, 13, 14, 15, 16, 17, 21, 22, 23, 24, 25, 26]);    // Function to highlight specific lines
// In your FileContext.jsx, make sure highlightLines and clearHighlights are memoized
const highlightLines = useCallback((lines) => {
    console.log('Highlighting lines:', lines);
    setHighlightedLines(lines);
}, []);

const clearHighlights = useCallback(() => {
    console.log('Clearing all highlights');
    setHighlightedLines([]);
}, []);

    // Function to add a single line highlight
    const addLineHighlight = (lineNumber) => {
        console.log('Adding line highlight:', lineNumber);
        setHighlightedLines(prev => 
            prev.includes(lineNumber) ? prev : [...prev, lineNumber]
        )
    }

    // Function to remove a specific line highlight
    const removeLineHighlight = (lineNumber) => {
        console.log('Removing line highlight:', lineNumber);
        setHighlightedLines(prev => prev.filter(line => line !== lineNumber))
    }

    const createFile = (name) => {
        // Check if file with same name already exists
        let num = 1
        let fileExists = files.some((file) => file.name === name)

        while (fileExists) {
            name = `${name} (${num++})`
            fileExists = files.some((file) => file.name === name)
            if (!fileExists) break
        }

        const id = uuidv4()
        const file = {
            id,
            name,
            content: "",
        }
        setFiles((prev) => [...prev, file])

        // File created event sent to server
        socket.emit(ACTIONS.FILE_CREATED, { file })
        return id
    }

    const updateFile = (id, content) => {
        setFiles((prev) =>
            prev.map((file) => {
                if (file.id === id) {
                    file.content = content
                }
                return file
            }),
        )
        // File updated event sent to server
    }

    const openFile = (id) => {
        // Save current file
        if (currentFile) {
            updateFile(currentFile.id, currentFile.content)
        }
        const file = files.find((file) => file.id === id)
        setCurrentFile(file)
        // Clear highlights when switching files
        clearHighlights()
    }

    const renameFile = (id, newName) => {
        // Check if file with same name already exists
        const fileExists = files.some((file) => file.name === newName)

        if (fileExists) {
            return false
        }

        setFiles((prev) =>
            prev.map((file) => {
                if (file.id === id) {
                    file.name = newName
                }
                return file
            }),
        )

        // File renamed event sent to server
        const file = { id, name: newName }
        socket.emit(ACTIONS.FILE_RENAMED, { file })

        return true
    }

    const deleteFile = (id) => {
        setFiles((prev) => prev.filter((file) => file.id !== id))
        if (currentFile.id === id) {
            setCurrentFile(null)
        }
        // File deleted event sent to server
        socket.emit(ACTIONS.FILE_DELETED, { id })
    }

    const downloadCurrentFile = () => {
        const blob = new Blob([currentFile.content], {
            type: "text/plain;charset=utf-8",
        })
        saveAs(blob, currentFile.name)
    }

    const downloadAllFiles = () => {
        const zip = new JSZip()
        files.forEach((file) => {
            const blobFile = new Blob([file.content], {
                type: "text/plain;charset=utf-8",
            })
            zip.file(file.name, blobFile)
        })
        zip.generateAsync({ type: "blob" }).then(function (content) {
            saveAs(content, "Code-Connect-Files.zip")
        })
    }

    const handleUserJoined = useCallback(
        (payload) => {
            // payload may be { user } or { username }
            const user = payload?.user || (payload?.username ? { username: payload.username, socketId: payload.socketId } : null)
            if (!user) {
                console.warn('handleUserJoined: missing user payload', payload)
                return
            }
            const username = user.username || 'Unknown'
            toast.success(`${username} joined the room`)
            // send the code and drawing data to the server if we have a socketId
            if (user.socketId) {
                socket.emit(ACTIONS.SYNC_FILES, {
                    files,
                    currentFile,
                    socketId: user.socketId,
                })
                socket.emit(ACTIONS.SYNC_DRAWING, {
                    drawingData,
                    socketId: user.socketId,
                })
            }

            setUsers((pre) => {
                return [...pre, user]
            })
        },
        [currentFile, drawingData, files, setUsers, socket],
    )

    const handleFilesSync = useCallback(({ files, currentFile }) => {
        setFiles(files)
        setCurrentFile(currentFile)
    }, [])

    const handleFileRenamed = useCallback(({ file }) => {
        setFiles((prev) =>
            prev.map((f) => {
                if (f.id === file.id) {
                    f.name = file.name
                }
                return f
            }),
        )
    }, [])

    const handleFileDeleted = useCallback(
        ({ id }) => {
            setFiles((prev) => prev.filter((file) => file.id !== id))
            if (currentFile.id === id) {
                setCurrentFile(null)
            }
        },
        [currentFile?.id],
    )

    const handleFileCreated = useCallback(({ file }) => {
        setFiles((prev) => [...prev, file])
    }, [])

    const handleFileUpdated = useCallback(
        ({ file }) => {
            setFiles((prev) =>
                prev.map((f) => {
                    if (f.id === file.id) {
                        f.content = file.content
                    }
                    return f
                }),
            )
            if (currentFile.id === file.id) {
                setCurrentFile(file)
            }
        },
        [currentFile?.id],
    )

    useEffect(() => {
        if (currentFile === null) return
        // Get file extension on file open and set language when file is opened
        const language = langMap.languages(currentFile.name.split(".").pop())
        setLanguage(language[0])
    }, [currentFile, setLanguage])

    useEffect(() => {
        socket.once(ACTIONS.SYNC_FILES, handleFilesSync)
        socket.on(ACTIONS.USER_JOINED, handleUserJoined)
        socket.on(ACTIONS.FILE_CREATED, handleFileCreated)
        socket.on(ACTIONS.FILE_UPDATED, handleFileUpdated)
        socket.on(ACTIONS.FILE_RENAMED, handleFileRenamed)
        socket.on(ACTIONS.FILE_DELETED, handleFileDeleted)

        return () => {
            socket.off(ACTIONS.USER_JOINED)
            socket.off(ACTIONS.FILE_CREATED)
            socket.off(ACTIONS.FILE_UPDATED)
            socket.off(ACTIONS.FILE_RENAMED)
            socket.off(ACTIONS.FILE_DELETED)
        }
    }, [
        handleFileCreated,
        handleFileDeleted,
        handleFileRenamed,
        handleFilesSync,
        handleFileUpdated,
        handleUserJoined,
        socket,
    ])

    return (
        <FileContext.Provider
            value={{
                files,
                setFiles,
                currentFile,
                setCurrentFile,
                createFile,
                updateFile,
                openFile,
                renameFile,
                deleteFile,
                downloadCurrentFile,
                downloadAllFiles,
                // Add line highlighting functions and state
                highlightedLines,
                highlightLines,
                clearHighlights,
                addLineHighlight,
                removeLineHighlight,
                 similarLines,
            updateSimilarLines,
            }}
        >
            {children}
        </FileContext.Provider>
    )
}

FileContextProvider.propTypes = {
    children: PropTypes.node.isRequired,
}

export { FileContextProvider }
export default FileContext