// pages/EditorPage.jsx
import SplitterComponent from "@/components/SplitterComponent"
import ConnectionStatusPage from "@/components/connection/ConnectionStatusPage"
import EditorComponent from "@/components/editor/EditorComponent"
import AdminPanel from "@/components/editor/AdminPanel"
import Sidebar from "@/components/sidebar/Sidebar"
import useAppContext from "@/hooks/useAppContext"
import useFullScreen from "@/hooks/useFullScreen"
import useSocket from "@/hooks/useSocket"
import useUserActivity from "@/hooks/useUserActivity"
import ACTIONS from "@/utils/actions"
import UserStatus from "@/utils/status"
import { useEffect } from "react"
import { useLocation, useNavigate, useParams } from "react-router-dom"

function EditorPage() {
    // Listen user online/offline status
    useUserActivity()
    // Enable fullscreen mode
    useFullScreen()
    const navigate = useNavigate()
    const { roomId } = useParams()
    const { status, setCurrentUser, currentUser } = useAppContext()
    const { socket } = useSocket()
    const location = useLocation()

    useEffect(() => {
        // If we have a current user with a room ID matching the URL, we might be good
        if (currentUser.username && currentUser.roomId === roomId) return

        // If reloading, we lose state. Try to recover from local storage or prompt re-join
        const storedToken = localStorage.getItem('token')

        // If we have no user state but we have a roomId param, we are likely reloading or navigating directly
        // We shouldn't kick them out immediately, but we need to re-establish identity
        if (!currentUser.username) {
            const locationStateUsername = location.state?.username
            if (locationStateUsername) {
                // We came from the form, re-hydrate
                const user = { username: locationStateUsername, roomId }
                setCurrentUser(prev => ({ ...prev, ...user }))
                socket.emit(ACTIONS.JOIN_ROOM, { token: storedToken, roomId, password: currentUser.password || '' })
            } else {
                // Direct access or reload without state -> redirect to home to join properly
                // But preserve the roomId so they can easily join back
                navigate("/", {
                    state: { roomId },
                })
            }
        }
    }, [
        currentUser.username,
        currentUser.roomId,
        currentUser.password,
        location.state?.username,
        navigate,
        roomId,
        setCurrentUser,
        socket,
    ])

    if (status === UserStatus.CONNECTION_FAILED) {
        return <ConnectionStatusPage />
    }

    return (
        <SplitterComponent>
            <Sidebar />
            {currentUser?.isAdmin ? <AdminPanel /> : <EditorComponent />}
        </SplitterComponent>
    )
}

export default EditorPage