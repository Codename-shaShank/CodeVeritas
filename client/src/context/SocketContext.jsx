import useAppContext from "@/hooks/useAppContext"
import ACTIONS from "@/utils/actions"
import UserStatus from "@/utils/status"
import PropTypes from "prop-types"
import { createContext, useCallback, useEffect, useMemo } from "react"
import toast from "react-hot-toast"
import { io } from "socket.io-client"

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000'

if (!import.meta.env.VITE_BACKEND_URL) {
    console.warn('VITE_BACKEND_URL not set — defaulting Socket BACKEND_URL to', BACKEND_URL)
}

const SocketContext = createContext()

const SocketProvider = ({ children }) => {
    const { setUsers, setStatus, setCurrentUser, drawingData, setDrawingData, setRoomQuestion, setRoomQuestions, setRoomSubmissions } =
        useAppContext()
    const socket = useMemo(
        () =>
            io(BACKEND_URL, {
                reconnectionAttempts: 2,
            }),
        [],
    )
    useEffect(() => {
        console.log('Connecting socket to', BACKEND_URL)
    }, [])

    const handleError = useCallback(
        (err) => {
            console.log("socket error", err)
            setStatus(UserStatus.CONNECTION_FAILED)
            toast.dismiss()
            toast.error("Failed to connect to the server")
        },
        [setStatus],
    )

    const handleUsernameExist = useCallback(() => {
        toast.dismiss()
        setStatus(UserStatus.INITIAL)
        toast.error(
            "The username you chose already exists in the room. Please choose a different username.",
        )
    }, [setStatus])

    const handleJoiningAccept = useCallback(
        (payload) => {
            // payload shape may be { user, users } (old) or { roomId, participants, admin, question, questions, isAdmin } (new)
            if (payload?.user && payload?.users) {
                setCurrentUser(payload.user)
                setUsers(payload.users)
            } else if (payload?.participants) {
                // set participants
                setUsers(payload.participants)
            }
            if (payload?.isAdmin !== undefined) {
                setCurrentUser((prev) => ({ ...prev, isAdmin: payload.isAdmin }))
            }
            if (payload?.question) {
                setRoomQuestion(payload.question)
            }
            if (payload?.questions && Array.isArray(payload.questions)) {
                setRoomQuestions(payload.questions)
            }
            toast.dismiss()
            setStatus(UserStatus.JOINED)
        },
        [setCurrentUser, setStatus, setUsers, setRoomQuestion, setRoomQuestions],
    )

    const handleUserLeft = useCallback(
        (payload) => {
            const user = payload?.user || (payload?.username ? { username: payload.username } : null)
            if (!user) return
            const username = user.username || 'Unknown'
            toast.success(`${username} left the room`)
            setUsers((prev) => {
                return prev.filter((u) => u.username !== user.username)
            })
        },
        [setUsers],
    )

    const handleRequestDrawing = useCallback(
        ({ socketId }) => {
            socket.emit(ACTIONS.SYNC_DRAWING, { socketId, drawingData })
        },
        [drawingData, socket],
    )

    const handleDrawingSync = useCallback(
        ({ drawingData }) => {
            setDrawingData(drawingData)
        },
        [setDrawingData],
    )

    useEffect(() => {
        socket.on("connect_error", handleError)
        socket.on("connect_failed", handleError)
        socket.on(ACTIONS.USERNAME_EXISTS, handleUsernameExist)
        socket.on(ACTIONS.JOIN_ACCEPTED, handleJoiningAccept)
        socket.on(ACTIONS.USER_DISCONNECTED, handleUserLeft)
        socket.on(ACTIONS.REQUEST_DRAWING, handleRequestDrawing)
        socket.on(ACTIONS.SYNC_DRAWING, handleDrawingSync)
        socket.on(ACTIONS.NEW_QUESTION, ({ question, currentQuestionId }) => {
            setRoomQuestion(question)
            // add to questions array
            setRoomQuestions((prev) => [...prev, question])
            toast('New question posted')
        })
        // when a candidate submits code, admin(s) receive this
        socket.on(ACTIONS.SUBMISSION_RECEIVED, ({ submission }) => {
            // append to room submissions list for admin
            setRoomSubmissions((prev) => [submission, ...prev])
            toast.success(`New submission from ${submission.username}`)
        })
        // server-side error events
        socket.on('error', (err) => {
            const message = err?.message || err || 'Server error'
            toast.dismiss()
            toast.error(message)
            setStatus(UserStatus.INITIAL)
        })
        // room closed event
        socket.on(ACTIONS.ROOM_CLOSED, ({ message }) => {
            toast.dismiss()
            toast('Room has been closed')
            setStatus(UserStatus.INITIAL)
            // redirect to home after a brief delay
            setTimeout(() => {
                window.location.href = '/'
            }, 1500)
        })

        return () => {
            socket.off("connect_error")
            socket.off("connect_failed")
            socket.off(ACTIONS.USERNAME_EXISTS)
            socket.off(ACTIONS.JOIN_ACCEPTED)
            socket.off(ACTIONS.USER_DISCONNECTED)
            socket.off(ACTIONS.REQUEST_DRAWING)
            socket.off(ACTIONS.SYNC_DRAWING)
            socket.off(ACTIONS.NEW_QUESTION)
            socket.off(ACTIONS.SUBMISSION_RECEIVED)
            socket.off(ACTIONS.ROOM_CLOSED)
            socket.off('error')
        }
    }, [
        handleDrawingSync,
        handleError,
        handleJoiningAccept,
        handleRequestDrawing,
        handleUserLeft,
        handleUsernameExist,
        setUsers,
        socket,
    ])

    return (
        <SocketContext.Provider
            value={{
                socket,
            }}
        >
            {children}
        </SocketContext.Provider>
    )
}

SocketProvider.propTypes = {
    children: PropTypes.node.isRequired,
}

export { SocketProvider }
export default SocketContext
