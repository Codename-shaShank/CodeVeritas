import useAppContext from '@/hooks/useAppContext'
import useSocket from '@/hooks/useSocket'
import ACTIONS from '@/utils/actions'
import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import axios from 'axios'
import AdminSubmissions from './AdminSubmissions'

function AdminPanel() {
  const { currentUser, roomQuestions, setRoomSubmissions, setRoomGeneratedCodes } = useAppContext()
  const { socket } = useSocket()
  const [questionText, setQuestionText] = useState('')
  const [languageHint, setLanguageHint] = useState('')
  const [endingRoom, setEndingRoom] = useState(false)

  const submitQuestion = (e) => {
    e?.preventDefault()
    if (!questionText.trim()) return toast.error('Enter a question')
    socket.emit(ACTIONS.SUBMIT_QUESTION, { token: currentUser.token, roomId: currentUser.roomId, questionText, languageHint })
    toast.success('Question submitted')
    // clear form
    setQuestionText('')
    setLanguageHint('')
  }

  const endRoom = () => {
    if (!window.confirm('Are you sure you want to end the room? All participants will be disconnected.')) return
    setEndingRoom(true)
    socket.emit(ACTIONS.END_ROOM, { token: currentUser.token, roomId: currentUser.roomId })
    toast.loading('Ending room...')
  }

  useEffect(() => {
    // fetch existing room submissions when admin opens panel
    const fetchSubmissions = async () => {
      try {
        if (!currentUser?.roomId) return
        const url = `${import.meta.env.VITE_BACKEND_URL}/api/rooms/${currentUser.roomId}`
        const res = await axios.get(url)
        const data = res.data
        if (data && data.submissions) {
          setRoomSubmissions(data.submissions.map(s => ({ ...s, id: s._id })))
          // store generated codes for admin UI to know which languages have generated references
          if (typeof setRoomGeneratedCodes === 'function') {
            setRoomGeneratedCodes(data.generatedCodes || [])
          }
        }
      } catch (err) {
        console.error('Failed to load submissions', err)
      }
    }
    fetchSubmissions()
  }, [currentUser?.roomId, setRoomSubmissions])

  return (
    <div className="p-4">
      <h2 className="text-xl font-semibold mb-2">Admin Panel</h2>
      <div className="mb-4">
        <label className="text-sm text-gray-400">Enter question (will be broadcast to candidates)</label>
        <textarea value={questionText} onChange={(e) => setQuestionText(e.target.value)} className="w-full p-2 rounded bg-darkHover" rows={4}></textarea>
        <input placeholder="Language hint (optional)" value={languageHint} onChange={(e) => setLanguageHint(e.target.value)} className="mt-2 w-full p-2 rounded bg-darkHover" />
        <div className="mt-2 flex gap-2">
          <button onClick={submitQuestion} className="bg-primary px-3 py-2 rounded text-black">Submit Question</button>
          <button onClick={endRoom} disabled={endingRoom} className="bg-red-600 hover:bg-red-700 disabled:bg-gray-600 px-3 py-2 rounded text-white font-semibold">End Room</button>
        </div>
      </div>

      {/* Posted Questions */}
      {roomQuestions && roomQuestions.length > 0 && (
        <div className="mb-4">
          <h3 className="font-semibold mb-2">Posted Questions ({roomQuestions.length})</h3>
          <div className="space-y-2">
            {roomQuestions.map((q, idx) => (
              <div key={q._id || idx} className="p-2 bg-darkHover rounded">
                <div className="font-medium">Q{idx + 1}: {q.text}</div>
                {q.languageHint && <div className="text-xs text-gray-400">Language: {q.languageHint}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h3 className="font-semibold">Participants</h3>
        <p className="text-sm text-gray-400">Open the sidebar to view participants and submissions.</p>
      </div>
      <AdminSubmissions />
    </div>
  )
}

export default AdminPanel
