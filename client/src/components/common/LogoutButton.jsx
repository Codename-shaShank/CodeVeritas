import useAppContext from '@/hooks/useAppContext'
import useSocket from '@/hooks/useSocket'

function LogoutButton() {
  const { currentUser, isAuthenticated, setCurrentUser, setIsAuthenticated, setStatus } = useAppContext()
  const { socket } = useSocket()

  const logout = () => {
    try {
      localStorage.removeItem('token')
      // disconnect socket to clean up
      if (socket && socket.connected) {
        socket.disconnect()
      }
    } catch (err) {
      // ignore
    }
    setCurrentUser({ username: '', roomId: '', token: null, email: '' })
    setIsAuthenticated(false)
    setStatus('INITIAL')
    // navigate to home without router hook
    window.location.href = '/'
  }

  // Only show logout when user is authenticated
  if (!isAuthenticated || !currentUser?.token) return null

  return (
    <button onClick={logout} className="fixed top-4 right-4 sm:right-20 z-50 rounded-md shadow-md bg-red-600 hover:bg-red-700 hover:shadow-lg text-white px-4 py-1.5 text-sm font-medium transition-all cursor-pointer">Logout</button>
  )
}

export default LogoutButton
