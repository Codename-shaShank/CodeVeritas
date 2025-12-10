import useAppContext from "@/hooks/useAppContext"
import useSocket from "@/hooks/useSocket"
import ACTIONS from "@/utils/actions"
import UserStatus from "@/utils/status"
import { useEffect, useRef, useState } from "react"
import toast from "react-hot-toast"
import { useLocation, useNavigate } from "react-router-dom"
import { v4 as uuidv4 } from "uuid"

function FormComponent() {
    const location = useLocation()
    const { currentUser, setCurrentUser, status, setStatus } = useAppContext()
    const { socket } = useSocket()
    const usernameRef = useRef(null)
    const navigate = useNavigate()

    const createNewRoomId = () => {
        // create a local room id placeholder; actual room creation happens on server
        setCurrentUser({ ...currentUser, roomId: uuidv4() })
        toast.success('Created a new Room Id')
        usernameRef.current.focus()
    }

    const [mode, setMode] = useState('join') // 'join' or 'create'
    const [createdRoom, setCreatedRoom] = useState(null)

    const createRoom = (e) => {
        e?.preventDefault()
        if (!currentUser.token) {
            toast.error('Please login first')
            return
        }
        // verify token with backend before attempting to create
        (async () => {
            try {
                const API_BASE = import.meta.env.VITE_BACKEND_URL || ''
                const verifyRes = await fetch(`${API_BASE}/api/auth/verify`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token: currentUser.token })
                })
                if (!verifyRes.ok) {
                    toast.error('Authentication expired. Please login again.')
                    setStatus(UserStatus.INITIAL)
                    return
                }
                // proceed to create room
                socket.once(ACTIONS.ROOM_CREATED, ({ roomId, password }) => {
                    // store created room so admin can see credentials
                    setCreatedRoom({ roomId, password })
                    // IMPORTANT: Set isAdmin: true here so EditorPage knows to render AdminPanel
                    setCurrentUser({ ...currentUser, roomId, password, isAdmin: true })
                    toast.dismiss()
                    toast.success('Room created — share credentials with candidates')
                })
                socket.emit(ACTIONS.CREATE_ROOM, { token: currentUser.token })
                toast.loading('Creating room...')
            } catch (err) {
                console.error('Create-room verify failed', err)
                toast.error('Failed to verify authentication')
            }
        })()
    }

    const validateForm = () => {
        if (currentUser.username.length === 0) {
            toast.error("Enter your username")
            return false
        } else if (currentUser.roomId.length === 0) {
            toast.error("Enter a room id")
            return false
        } else if (currentUser.roomId.length < 5) {
            toast.error("ROOM Id must be at least 5 characters long")
            return false
        } else if (currentUser.username.length < 3) {
            toast.error("Username must be at least 3 characters long")
            return false
        }
        return true
    }

    const joinRoom = (e) => {
        e.preventDefault()
        if (status === UserStatus.ATTEMPTING_JOIN) return
        if (!validateForm()) return
        if (!currentUser.token) {
            toast.error('Please login first')
            return
        }
        // verify token first
        ; (async () => {
            try {
                const API_BASE = import.meta.env.VITE_BACKEND_URL || ''
                const verifyRes = await fetch(`${API_BASE}/api/auth/verify`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token: currentUser.token })
                })
                if (!verifyRes.ok) {
                    toast.error('Authentication expired. Please login again.')
                    setStatus(UserStatus.INITIAL)
                    return
                }
                toast.loading('Joining room...')
                setStatus(UserStatus.ATTEMPTING_JOIN)
                // require password for room join (server expects token + password)
                socket.emit(ACTIONS.JOIN_ROOM, { token: currentUser.token, roomId: currentUser.roomId, password: currentUser.password || '' })
            } catch (err) {
                console.error('Join verify failed', err)
                toast.error('Failed to verify authentication')
            }
        })()
    }

    const handleInputChanges = (e) => {
        const name = e.target.name
        const value = e.target.value
        setCurrentUser({ ...currentUser, [name]: value })
    }

    useEffect(() => {
        if (currentUser.roomId.length > 0) return
        if (location.state?.roomId) {
            setCurrentUser({ ...currentUser, roomId: location.state.roomId })
            if (currentUser.username.length === 0) {
                toast.success("Enter your username")
            }
        }
    }, [currentUser, location.state?.roomId, setCurrentUser])

    useEffect(() => {
        if (status === UserStatus.DISCONNECTED && !socket.connected) {
            socket.connect()
            return
        }

        const isRedirect = sessionStorage.getItem("redirect") || false

        if (status === UserStatus.JOINED) {
            const username = currentUser.username
            // Only navigate if we haven't already
            if (!location.pathname.startsWith('/editor')) {
                sessionStorage.setItem("redirect", true)
                navigate(`/editor/${currentUser.roomId}`, {
                    state: {
                        username,
                    },
                })
            }
        } else if (isRedirect && status === UserStatus.DISCONNECTED) {
            // handle reload case or redirect back
            sessionStorage.removeItem("redirect")
        }
    }, [currentUser, location.state?.redirect, navigate, socket, status])

    return (
        <div className="flex w-full max-w-[500px] flex-col items-center justify-center gap-4 p-4 sm:w-[500px] sm:p-8">
            <h1 className="text-4xl sm:text-5xl">Code Connect</h1>
            <p className="mb-4 text-center md:mb-8">
                {"Code, Chat, Collaborate. It's All in Connect."}
            </p>
            <div className="flex w-full flex-col gap-4">
                <div className="flex gap-2">
                    <button className={`px-3 py-2 rounded ${mode === 'join' ? 'bg-primary text-black' : 'bg-transparent'}`} onClick={() => setMode('join')}>Join Room</button>
                    <button className={`px-3 py-2 rounded ${mode === 'create' ? 'bg-primary text-black' : 'bg-transparent'}`} onClick={() => setMode('create')}>Create Room</button>
                </div>
                {mode === 'join' ? (
                    <form onSubmit={joinRoom} className="flex w-full flex-col gap-4">
                        <input
                            type="text"
                            name="roomId"
                            placeholder="Room Id"
                            className="w-full rounded-md border border-gray-500 bg-darkHover px-3 py-3 focus:outline-none"
                            onChange={handleInputChanges}
                            value={currentUser.roomId}
                        />
                        <input
                            type="password"
                            name="password"
                            placeholder="Room Password"
                            className="w-full rounded-md border border-gray-500 bg-darkHover px-3 py-3 focus:outline-none"
                            onChange={handleInputChanges}
                            value={currentUser.password || ''}
                        />
                        <input
                            type="text"
                            name="username"
                            placeholder="Username"
                            className="w-full rounded-md border border-gray-500 bg-darkHover px-3 py-3 focus:outline-none"
                            onChange={handleInputChanges}
                            value={currentUser.username}
                            ref={usernameRef}
                        />
                        <button
                            type="submit"
                            className="mt-2 w-full rounded-md bg-primary px-8 py-3 text-lg font-semibold text-black"
                        >
                            Join
                        </button>
                    </form>
                ) : (
                    <form onSubmit={createRoom} className="flex w-full flex-col gap-4">
                        <input
                            type="text"
                            name="username"
                            placeholder="Admin Username"
                            className="w-full rounded-md border border-gray-500 bg-darkHover px-3 py-3 focus:outline-none"
                            onChange={handleInputChanges}
                            value={currentUser.username}
                            ref={usernameRef}
                        />
                        <button type="submit" className="mt-2 w-full rounded-md bg-primary px-8 py-3 text-lg font-semibold text-black">Create Room</button>
                    </form>
                )}
                {createdRoom && (
                    <div className="mt-4 w-full rounded-md border border-gray-600 bg-dark p-4">
                        <h3 className="mb-2 font-semibold">Room created</h3>
                        <div className="mb-2">Room Id: <code className="ml-2">{createdRoom.roomId}</code>
                            <button className="ml-2 underline" onClick={() => navigator.clipboard.writeText(createdRoom.roomId)}>Copy</button>
                        </div>
                        <div className="mb-3">Password: <code className="ml-2">{createdRoom.password}</code>
                            <button className="ml-2 underline" onClick={() => navigator.clipboard.writeText(createdRoom.password)}>Copy</button>
                        </div>
                        <div className="flex gap-2">
                            <button className="rounded bg-primary px-4 py-2 text-black" onClick={() => {
                                // navigate into editor as admin
                                setStatus(UserStatus.JOINED)
                                navigate(`/editor/${createdRoom.roomId}`, { state: { username: currentUser.username } })
                            }}>Enter Room</button>
                            <button className="rounded px-4 py-2 border" onClick={() => setCreatedRoom(null)}>Dismiss</button>
                        </div>
                    </div>
                )}
                <button
                    className="cursor-pointer select-none underline"
                    onClick={createNewRoomId}
                >
                    Generate Unique Room Id
                </button>
            </div>
        </div>
    )
}

export default FormComponent
