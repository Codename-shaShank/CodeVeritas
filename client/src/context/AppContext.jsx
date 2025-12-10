import STATE from "@/utils/states"
import UserStatus from "@/utils/status"
import PropTypes from "prop-types"
import { createContext, useState, useEffect } from "react"
const AppContext = createContext()

function AppContextProvider({ children }) {
    const [users, setUsers] = useState([])
    const [status, setStatus] = useState(UserStatus.INITIAL)
    const [currentUser, setCurrentUser] = useState(() => ({
        username: "",
        roomId: "",
        token: typeof window !== 'undefined' ? localStorage.getItem('token') : null,
        email: "",
    }))
    const [roomQuestion, setRoomQuestion] = useState(null)
    const [roomQuestions, setRoomQuestions] = useState([])
    const [roomSubmissions, setRoomSubmissions] = useState([])
    const [roomGeneratedCodes, setRoomGeneratedCodes] = useState([])
    const [mlAgentAvailable, setMlAgentAvailable] = useState(true) // assume available initially
    // For drawing state
    const [state, setState] = useState(STATE.CODING)
    const [drawingData, setDrawingData] = useState(null)

    // Health check function exposed to components
    const checkMlStatus = async () => {
        try {
            const API_BASE = import.meta.env.VITE_BACKEND_URL || ''
            const res = await fetch(`${API_BASE}/api/health/ml-agent`)
            const data = await res.json()
            const isAvailable = res.ok && data.ok
            setMlAgentAvailable(isAvailable)
            return isAvailable
        } catch (err) {
            setMlAgentAvailable(false)
            return false
        }
    }

    // Check only on mount
    useEffect(() => {
        checkMlStatus()
    }, [])

    return (
        <AppContext.Provider
            value={{
                users,
                setUsers,
                currentUser,
                setCurrentUser,
                roomQuestion,
                setRoomQuestion,
                roomQuestions,
                setRoomQuestions,
                roomSubmissions,
                setRoomSubmissions,
                roomGeneratedCodes,
                setRoomGeneratedCodes,
                mlAgentAvailable,
                setMlAgentAvailable,
                checkMlStatus,
                status,
                setStatus,
                state,
                setState,
                drawingData,
                setDrawingData,
            }}
        >
            {children}
        </AppContext.Provider>
    )
}

AppContextProvider.propTypes = {
    children: PropTypes.node.isRequired,
}

export { AppContextProvider }
export default AppContext
