import { useState } from 'react'
import useAppContext from '@/hooks/useAppContext'
import toast from 'react-hot-toast'

function AuthComponent() {
  const { currentUser, setCurrentUser } = useAppContext()
  const [isLogin, setIsLogin] = useState(true)
  const [form, setForm] = useState({ username: '', email: '', password: '' })
  const API_BASE = import.meta.env.VITE_BACKEND_URL || ''

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const submit = async (e) => {
    e.preventDefault()
    try {
      const url = `${API_BASE}/api/auth/${isLogin ? 'login' : 'signup'}`
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      // parse response safely (avoid parsing HTML 404 pages)
      let data = null
      const ct = res.headers.get('content-type') || ''
      if (ct.includes('application/json')) {
        data = await res.json()
      } else {
        const text = await res.text()
        data = { error: text }
      }

      if (!res.ok) {
        toast.error(data.error || res.statusText || 'Auth failed')
        return
      }
      // store token and username in app context and localStorage
      setCurrentUser({ ...currentUser, id: data.user.id || data.user._id, username: data.user.username, token: data.token, email: data.user.email })
      localStorage.setItem('token', data.token)
      toast.success(isLogin ? 'Logged in' : 'Signed up')
    } catch (err) {
      console.error(err)
      toast.error('Network error')
    }
  }


  return (
    <div className="flex w-full max-w-[420px] flex-col items-center justify-center gap-4 p-4 sm:p-8 text-black">
      <h2 className="text-2xl font-semibold">{isLogin ? 'Login' : 'Sign up'}</h2>
      <form onSubmit={submit} className="flex w-full flex-col gap-3">
        {!isLogin && (
          <input name="email" placeholder="Email" value={form.email} onChange={handleChange} className="rounded-md p-2 text-black" />
        )}
        <input name="username" placeholder="Username" value={form.username} onChange={handleChange} className="rounded-md p-2 text-black" />
        <input name="password" type="password" placeholder="Password" value={form.password} onChange={handleChange} className="rounded-md p-2 text-black" />
        <button className="mt-2 rounded bg-primary px-4 py-2 text-black font-semibold" type="submit">{isLogin ? 'Login' : 'Sign up'}</button>
      </form>
      <button className="mt-2 underline" onClick={() => setIsLogin(!isLogin)}>
        {isLogin ? 'Create an account' : 'Have an account? Login'}
      </button>
    </div>
  )

}

export default AuthComponent
