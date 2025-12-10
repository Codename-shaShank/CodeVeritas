import useAppContext from '@/hooks/useAppContext'
import useSocket from '@/hooks/useSocket'

function LogoutButton() {
  const { setCurrentUser, setStatus } = useAppContext()
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
    setStatus('INITIAL')
    // navigate to home without router hook
    window.location.href = '/'
  }

  return (
    <button onClick={logout} className="fixed top-4 right-4 z-50 rounded bg-red-600 hover:bg-red-700 text-white px-3 py-1 text-sm">Logout</button>
  )
}

export default LogoutButton
