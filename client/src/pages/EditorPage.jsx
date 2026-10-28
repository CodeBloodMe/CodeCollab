import React , {useState , useEffect , useRef} from "react";
import { Link, useParams , useNavigate } from "react-router-dom";
import Client from "../components/Client";
import Editor from "../components/Editor";
import { socket } from "../socket.js";
import {toast} from 'react-hot-toast';
import axios from "axios";

const EditorPage = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();

  const username = localStorage.getItem("username") || "Anonymous";
  const [clients, setClients] = useState([
    {
      socketId: "local",
      username,
    },
  ]);
  const [language , setLanguage] = useState("javascript");
  const [executionResult, setExecutionResult] = useState({
    stdout: "",
    stderr: "",
    exitCode: null,
  });
  const [isRunning, setIsRunning] = useState(false);

  const codeRef = useRef("");

  useEffect(()=>{
    console.log("Connecting to socket server...")

    socket.connect();

    socket.emit("join",{
      roomId,
      username,
    })

    socket.on("joined" , ({clients, username, socketId}) => {
      setClients(clients);

      console.log(`${username} joined the room. Socket ID: ${socketId}`);
    });

    return () => {
      console.log("Disconnecting from socket server...")
      socket.off("joined");
      socket.disconnect();
    }
  }, []);
  const copyRoomId = async() => {
    try{
      await navigator.clipboard.writeText(roomId)
      toast.success('Room ID copied to clipboard')
      // console.log("Room ID copied to clipboard:", roomId)
    }
    catch(err){
      toast.error('Failed to copy room ID')
      //console.error("Failed to copy room ID:", err)
    }
  }

  const leaveRoom = () => {
    localStorage.removeItem('username')
    navigate('/')
  }

  const handleRunCode = async () => {
  try {
    setIsRunning(true);

    setExecutionResult({
      stdout: "",
      stderr: "Running code...",
      exitCode: null,
    });

    const response = await axios.post(
      `${import.meta.env.VITE_BACKEND_URL}/run`,
      {
        code: codeRef.current,
      }
    );

    setExecutionResult(response.data);

  } catch (err) {

    toast.error("Error running code");

    setExecutionResult({
      stdout: "",
      stderr: "Failed to connect to server.",
      exitCode: 1,
    });

  } finally {

    setIsRunning(false);

  }
};
  const languages = [ "javascript", "python", "java", "cpp" ];

  return (
    <div className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,#164e63_0,#0f172a_34%,#07111f_72%)] px-5 py-6 text-slate-100 sm:px-8 lg:px-12">
        <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-7xl flex-col">
          <header className="flex flex-wrap items-center justify-between gap-4 py-2">
            <Link to="/" className="flex items-center gap-3 text-left" >
              <span className="grid size-10 place-items-center rounded-lg bg-cyan-400 font-mono text-lg font-black text-slate-950 shadow-lg shadow-cyan-400/20">
                CC
              </span>
              <span>
                <span className="block text-base font-semibold tracking-wide text-white">CodeCollab</span>
                <span className="block text-xs font-medium text-cyan-200/80">Realtime coding rooms</span>
              </span>
              <span className="hidden rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300 shadow-sm backdrop-blur sm:inline-flex">
                Secure shared editor
              </span>
            </Link>
            <div className="flex items-center gap-4">
              <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300 shadow-sm backdrop-blur">
                Live Session
              </span>
              <button 
                onClick={handleRunCode}
                disabled={isRunning}
                className = "px-4 py-2 rounded-full bg-cyan-300 font-bold text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:bg-cyan-200 focus:outline-none focus:ring-4 focus:ring-cyan-300/30 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                  {isRunning ? "Running..." : "Run Code"}
              </button>
              <button onClick={copyRoomId} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300 shadow-sm backdrop-blur">
                Copy ROOM-ID
              </button>
              <button onClick={leaveRoom} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300 shadow-sm backdrop-blur">
                Leave Room
              </button>
            </div>  
          </header>
          <main className="grid flex-1 gap-4 py-5 lg:grid-cols-[260px_1fr_300px]">

  {/* Left Sidebar */}
  <aside className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-sm backdrop-blur">

    {/* Workspace Info */}
    <div className="mb-5">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
        Workspace
      </p>

      <h1 className="mt-2 text-2xl font-black text-white">
        Pair Editor
      </h1>

      <p className="mt-2 text-sm leading-6 text-slate-400">
        Share context, write together, and keep everyone in the same flow.
      </p>
    </div>

    {/* Connected Users */}
    <div className="rounded-xl border border-white/10 bg-white/5 p-3">

      <p className="text-sm font-semibold text-slate-200">
        Connected
      </p>

      <div className="mt-3 space-y-3">

        {clients.map((client, index) => (
          <Client key={client.socketId} username={client.username} isCurrentUser={client.socketId === socket.id} />
        ))}

      </div>

    </div>

    <div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-3"> 
        <button onClick = {copyRoomId} className="w-full rounded-xl bg-cyan-300 px-6 font-bold text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:bg-cyan-200 focus:outline-none focus:ring-4 focus:ring-cyan-300/30">
          Copy ROOM-ID
        </button>
    </div>

  </aside>

  {/* Editor Section */}
<section className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/80 shadow-2xl shadow-slate-950/50">

  {/* Editor Toolbar */}
  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-white/5 px-4 py-3">

    {/* Left Side */}
    <div className="flex items-center gap-3">

      <div className="flex gap-2">
        <span className="size-3 rounded-full bg-rose-400" />
        <span className="size-3 rounded-full bg-amber-300" />
        <span className="size-3 rounded-full bg-emerald-300" />
      </div>

      <span className="font-mono text-sm text-slate-400">
        main.js
      </span>

    </div>

    {/* Right Side */}
    <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">

      <select 
        value={language}
        onChange={(e) => setLanguage(e.target.value)}
        className="rounded-md bg-white/5 px-2 py-1 text-sm text-slate-300 shadow-sm backdrop-blur focus:outline-none focus:ring-2 focus:ring-cyan-300 focus:ring-offset-2 focus:ring-offset-slate-900"
      >
        {languages.map((lang) => (
          <option key={lang} value={lang} className="bg-slate-900 text-white">
            {lang}
          </option>
        ))}
      </select>

      <span className="rounded-md bg-white/5 px-2 py-1">
        Auto Sync
      </span>

    </div>

  </div>

  {/* Editor Body */}
  <div className="min-h-[550px] p-5">

    <Editor 
        language={language}
        roomId={roomId}
        codeRef={codeRef}
    />

  </div>

</section>

  {/* Activity Panel */}
<aside className="grid gap-4">

  {/* Session Card */}
  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-sm backdrop-blur">

    <p className="text-sm font-semibold text-slate-200">
      Session
    </p>

    <div className="mt-4 grid grid-cols-2 gap-3">

      <div className="rounded-xl bg-white/5 p-3">
        <span className="block text-2xl font-black text-white">
          {clients.length}
        </span>

        <span className="text-xs text-slate-500">
          Online
        </span>
      </div>

      <div className="rounded-xl bg-white/5 p-3">
        <span className="block text-2xl font-black text-white">
          Live
        </span>

        <span className="text-xs text-slate-500">
          Status
        </span>
      </div>

    </div>

  </div>

  {/* Activity Feed */}
  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-sm backdrop-blur">

    <p className="text-sm font-semibold text-slate-200">
      Activity
    </p>

    <div className="mt-4 space-y-4">

      <div className="flex gap-3">

        <span className="mt-1 size-2 rounded-full bg-cyan-300" />

        <div>
          <p className="text-sm text-slate-300">
            <span className="font-semibold text-white">
              {username}
            </span>{" "}
            created this room
          </p>

          <p className="text-xs text-slate-500">
            just now
          </p>
        </div>

      </div>

    </div>

  </div>

</aside>

</main>
<div className="mt-4 bg-black rounded-lg p-4 border border-gray-700">
  <div className="flex items-center justify-between mb-3">
    <h3 className="text-white font-semibold">
      Terminal
    </h3>

    {executionResult.exitCode === 0 && (
      <span className="text-green-400 text-sm">
        ✓ Success
      </span>
    )}

    {executionResult.exitCode === 1 && (
      <span className="text-red-400 text-sm">
        ✗ Runtime Error
      </span>
    )}

    {executionResult.exitCode === null && isRunning && (
      <span className="text-yellow-400 text-sm">
        Running...
      </span>
    )}
  </div>

  <pre
  className={`whitespace-pre-wrap font-mono text-sm ${
    executionResult.exitCode === 1
      ? "text-red-400"
      : "text-green-400"
  }`}
>
  {executionResult.stdout ||
    executionResult.stderr ||
    "Run your code to see the output..."}
</pre>
</div>
    </div>

    </div>
  );
};

export default EditorPage;