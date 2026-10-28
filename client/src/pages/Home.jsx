import React from 'react'
import {v4 as uuidV4} from 'uuid'
import {useState} from 'react'
import {toast} from 'react-hot-toast'
import {useNavigate} from 'react-router-dom'

const Home = () => {
  const [roomId, setRoomId] = useState('')
  const [username, setUsername] = useState('')
  const navigate = useNavigate()
  const createNewRoom = (e) => {
    e.preventDefault()
    const id = uuidV4()
    setRoomId(id)
    toast.success('Created a new room')
    // console.log("new room created with id:", id)
    // navigate(`/editor/${id}`)
  }

  const joinRoom = () => {
    if (!roomId || !username) {
      toast.error('Please enter a room ID and username')
      // console.error("room id and username are required to join a room")
      return
    }
    localStorage.setItem('username', username)
    navigate(`/editor/${roomId}`)
  }
  return (
    <div className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,#164e63_0,#0f172a_34%,#07111f_72%)] px-5 py-6 text-slate-100 sm:px-8 lg:px-12">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-6xl flex-col">
        <header className="flex items-center justify-between py-2">
          <a href="/" className="flex items-center gap-3 text-left">
            <span className="grid size-10 place-items-center rounded-lg bg-cyan-400 font-mono text-lg font-black text-slate-950 shadow-lg shadow-cyan-400/20">
              CC
            </span>
            <span>
              <span className="block text-base font-semibold tracking-wide text-white">CodeCollab</span>
              <span className="block text-xs font-medium text-cyan-200/80">Realtime coding rooms</span>
            </span>
          </a>

          <span className="hidden rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300 shadow-sm backdrop-blur sm:inline-flex">
            Secure shared editor
          </span>
        </header>

        <main className="grid flex-1 items-center gap-10 py-10 lg:grid-cols-[1fr_0.9fr] lg:py-16">
          <section className="text-left">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-sm font-medium text-cyan-100">
              <span className="size-2 rounded-full bg-emerald-300 shadow-[0_0_16px_rgba(110,231,183,0.8)]" />
              Start a session in seconds
            </div>

            <h1 className="max-w-3xl text-4xl font-black leading-tight text-white sm:text-5xl lg:text-6xl">
              Build together in one focused coding room.
            </h1>

            <p className="mt-5 max-w-2xl text-base leading-8 text-slate-300 sm:text-lg">
              Drop into a shared workspace, review ideas live, and keep the conversation close to the code.
            </p>

            <div className="mt-8 w-full max-w-xl rounded-2xl border border-white/10 bg-white/[0.07] p-4 shadow-2xl shadow-slate-950/40 backdrop-blur sm:p-5">
              <label htmlFor="room-id" className="mb-3 block text-sm font-semibold text-slate-200">
                Paste invitation code
              </label>

              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  id="room-id"
                  type="text"
                  className="min-h-12 flex-1 rounded-xl border border-white/10 bg-slate-950/60 px-4 text-base text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300 focus:ring-4 focus:ring-cyan-300/10"
                  placeholder="Room ID"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                />
                <input
                  id="username"
                  type="text"
                  className="min-h-12 flex-1 rounded-xl border border-white/10 bg-slate-950/60 px-4 text-base text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300 focus:ring-4 focus:ring-cyan-300/10"
                  placeholder="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
                <button onClick={joinRoom} className="min-h-12 rounded-xl bg-cyan-300 px-6 font-bold text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:bg-cyan-200 focus:outline-none focus:ring-4 focus:ring-cyan-300/30">
                  Join Room
                </button>
              </div>

              <p className="mt-4 text-sm text-slate-400">
                No invite yet?{' '}
                <a onClick={createNewRoom} href="/" className="font-semibold text-cyan-200 underline decoration-cyan-200/30 underline-offset-4 transition hover:text-white">
                  Create a new room
                </a>
              </p>
            </div>
          </section>

          <section className="relative">
            <div className="absolute -inset-6 rounded-[2rem] bg-cyan-400/10 blur-3xl" />
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-slate-950/80 text-left shadow-2xl shadow-slate-950/60">
              <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.04] px-4 py-3">
                <div className="flex gap-2">
                  <span className="size-3 rounded-full bg-rose-400" />
                  <span className="size-3 rounded-full bg-amber-300" />
                  <span className="size-3 rounded-full bg-emerald-300" />
                </div>
                <span className="rounded-md bg-emerald-400/10 px-2 py-1 text-xs font-semibold text-emerald-200">
                  3 online
                </span>
              </div>

              <div className="space-y-4 p-5 font-mono text-sm leading-7 text-slate-300 sm:p-6">
                <p><span className="text-slate-600">01</span> <span className="text-fuchsia-300">const</span> room = <span className="text-cyan-200">'code-collab'</span></p>
                <p><span className="text-slate-600">02</span> <span className="text-fuchsia-300">function</span> pairProgram<span className="text-slate-500">()</span> {'{'}</p>
                <p><span className="text-slate-600">03</span> &nbsp;&nbsp;<span className="text-emerald-200">shareCursor</span><span className="text-slate-500">(</span>room<span className="text-slate-500">)</span></p>
                <p><span className="text-slate-600">04</span> &nbsp;&nbsp;<span className="text-emerald-200">syncIdeas</span><span className="text-slate-500">()</span></p>
                <p><span className="text-slate-600">05</span> {'}'}</p>
              </div>

              <div className="grid grid-cols-3 border-t border-white/10 text-center">
                <div className="p-4">
                  <span className="block text-lg font-bold text-white">Live</span>
                  <span className="text-xs text-slate-500">editing</span>
                </div>
                <div className="border-x border-white/10 p-4">
                  <span className="block text-lg font-bold text-white">Fast</span>
                  <span className="text-xs text-slate-500">rooms</span>
                </div>
                <div className="p-4">
                  <span className="block text-lg font-bold text-white">Clean</span>
                  <span className="text-xs text-slate-500">review</span>
                </div>
              </div>
            </div>
          </section>
        </main>
        <footer className="text-center text-sm text-slate-500">
          Made with ❤️ by Arshdeep Singh.
        </footer>
      </div>
    </div>
  )
}

export default Home
