import { useState } from 'react'
import useAppContext from '@/hooks/useAppContext'
import toast from 'react-hot-toast'

function AuthComponent() {
  const { setCurrentUser, setIsAuthenticated } = useAppContext()
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
      setCurrentUser({
        id: data.user.id || data.user._id,
        username: data.user.username,
        token: data.token,
        email: data.user.email,
        roomId: '',
        password: '',
        isAdmin: false,
      })
      localStorage.setItem('token', data.token)
      setIsAuthenticated(true)
      toast.success(isLogin ? 'Logged in' : 'Signed up')
    } catch (err) {
      console.error(err)
      toast.error('Network error')
    }
  }


  return (
    <div className="w-full max-w-[440px] rounded-[28px] border border-slate-200 bg-white/95 p-6 text-slate-900 shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur sm:p-8">
      <div className="mb-6">
        <p className="text-sm font-medium uppercase tracking-[0.22em] text-emerald-600">Code Connect</p>
        <h2 className="mt-2 text-3xl font-semibold text-slate-900">{isLogin ? 'Login' : 'Sign up'}</h2>
        <p className="mt-2 text-sm text-slate-500">
          {isLogin ? 'Welcome back. Sign in to create or join a room.' : 'Create your account to start collaborating.'}
        </p>
      </div>
      <form onSubmit={submit} className="flex w-full flex-col gap-3">
        {!isLogin && (
          <input name="email" placeholder="Email" value={form.email} onChange={handleChange} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100" />
        )}
        <input name="username" placeholder="Username" value={form.username} onChange={handleChange} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100" />
        <input name="password" type="password" placeholder="Password" value={form.password} onChange={handleChange} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100" />
        <button className="mt-2 rounded-xl bg-emerald-500 px-4 py-3 font-semibold text-white transition-all hover:bg-emerald-600 hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-emerald-200 cursor-pointer" type="submit">{isLogin ? 'Login' : 'Sign up'}</button>
      </form>
      <button className="mt-4 text-sm font-medium text-slate-500 underline decoration-slate-300 underline-offset-4 transition-colors hover:text-emerald-600 focus:text-emerald-600 focus:outline-none cursor-pointer" onClick={() => setIsLogin(!isLogin)}>
        {isLogin ? 'Create an account' : 'Have an account? Login'}
      </button>
    </div>
  )

}

export default AuthComponent
