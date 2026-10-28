import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  Code2,
  FolderKanban,
  Play,
  RotateCw,
  LogOut,
  User,
  Share2,
  CheckCircle2,
  Cloud,
  Layers,
  Activity,
} from "lucide-react";
import { albTelemetry } from "../api/client";
import AlbDiagnosticsModal from "./AlbDiagnosticsModal";

const Navbar = ({
  project,
  isRunning,
  onRunCode,
  connectedClients = [],
  saveStatus = "Saved",
  onOpenInvite,
  activeTab,
  setActiveRightTab,
}) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isAlbModalOpen, setIsAlbModalOpen] = useState(false);
  const [telemetry, setTelemetry] = useState(albTelemetry.getState());

  useEffect(() => {
    const unsub = albTelemetry.subscribe((state) => {
      setTelemetry(state);
    });
    return unsub;
  }, []);

  return (
    <>
      <header className="h-14 border-b border-slate-800 bg-slate-950 px-4 flex items-center justify-between select-none">
        {/* Left: Brand & Breadcrumbs */}
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="flex items-center gap-2 group transition hover:opacity-90"
          >
            <div className="size-8 rounded-lg bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 text-white font-black text-sm">
              CF
            </div>
            <span className="font-bold text-slate-100 text-sm tracking-wide hidden sm:inline">
              Code<span className="text-cyan-400">Forge</span>
            </span>
          </Link>

          {project && (
            <>
              <span className="text-slate-600 text-sm">/</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-200 truncate max-w-[180px] sm:max-w-[240px]">
                  {project.name}
                </span>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-slate-800/80 text-cyan-300 border border-slate-700/60">
                  {project.visibility}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Middle: Save indicator, ALB Node Pill, & Quick Run Action */}
        <div className="flex items-center gap-3">
          {/* AWS ALB Node Telemetry Pill */}
          <button
            onClick={() => setIsAlbModalOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-900/90 hover:bg-slate-800 border border-slate-700/70 text-[11px] font-mono text-cyan-300 transition shadow-sm"
            title="Click to open AWS ALB Round-Robin & Multi-AZ Diagnostics"
          >
            <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-slate-400 font-sans hidden sm:inline">ALB:</span>
            <span className="text-cyan-300 font-semibold truncate max-w-[110px] sm:max-w-[160px]">
              {telemetry.lastInstanceId || "ec2-server1"}
            </span>
            <span className="text-emerald-400/80 text-[10px] hidden md:inline">
              [{telemetry.lastAz || "us-east-1a"}]
            </span>
          </button>

          {project && (
            <>
              <div className="hidden lg:flex items-center gap-1.5 text-xs text-slate-400 mr-1">
                <Cloud className="size-3.5 text-emerald-400" />
                <span>{saveStatus}</span>
              </div>

              <button
                onClick={onRunCode}
                disabled={isRunning}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold shadow-md transition ${
                  isRunning
                    ? "bg-slate-800 text-slate-400 cursor-not-allowed"
                    : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20"
                }`}
              >
                {isRunning ? (
                  <>
                    <RotateCw className="size-3.5 animate-spin" />
                    <span>Executing...</span>
                  </>
                ) : (
                  <>
                    <Play className="size-3.5 fill-current" />
                    <span>Run Program</span>
                  </>
                )}
              </button>
            </>
          )}
        </div>

        {/* Right: Presence, Invite, and User Menu */}
        <div className="flex items-center gap-3">
          {project && (
            <div className="flex items-center gap-1.5">
              {/* Collaborator Avatars */}
              <div
                className="flex -space-x-1.5 cursor-pointer"
                title={`${connectedClients.length} online collaborator(s)`}
                onClick={() => setActiveRightTab && setActiveRightTab("collaborators")}
              >
                {connectedClients.slice(0, 4).map((client, idx) => (
                  <div
                    key={client.socketId || idx}
                    style={{ backgroundColor: client.color || "#38bdf8" }}
                    className="size-6 rounded-full border border-slate-900 flex items-center justify-center text-[10px] font-bold text-slate-950 uppercase shadow"
                    title={client.username}
                  >
                    {client.username ? client.username[0] : "?"}
                  </div>
                ))}
                {connectedClients.length > 4 && (
                  <div className="size-6 rounded-full bg-slate-800 border border-slate-900 flex items-center justify-center text-[9px] font-semibold text-slate-300">
                    +{connectedClients.length - 4}
                  </div>
                )}
              </div>

              <button
                onClick={onOpenInvite}
                className="hidden sm:flex items-center gap-1 text-xs text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-700/60 px-2.5 py-1.5 rounded-md transition"
                title="Share or invite collaborators"
              >
                <Share2 className="size-3.5" />
                <span>Share</span>
              </button>
            </div>
          )}

          {user ? (
            <div className="flex items-center gap-2 border-l border-slate-800 pl-3">
              <Link
                to="/dashboard"
                className="hidden sm:flex items-center gap-1.5 text-xs text-slate-300 hover:text-cyan-300 transition"
                title="Workspace Dashboard"
              >
                <FolderKanban className="size-3.5" />
                <span>Projects</span>
              </Link>

              <div
                className="size-7 rounded-full flex items-center justify-center text-xs font-bold text-slate-950 uppercase shadow"
                style={{ backgroundColor: user.avatar_color || "#38bdf8" }}
                title={`Logged in as ${user.username}`}
              >
                {user.username ? user.username[0] : "U"}
              </div>

              <button
                onClick={() => {
                  logout();
                  navigate("/login");
                }}
                className="text-slate-400 hover:text-rose-400 transition p-1"
                title="Log Out"
              >
                <LogOut className="size-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                to="/login"
                className="text-xs font-medium text-slate-300 hover:text-white px-2.5 py-1.5 rounded transition"
              >
                Log in
              </Link>
              <Link
                to="/register"
                className="text-xs font-semibold bg-cyan-500 hover:bg-cyan-400 text-slate-950 px-3 py-1.5 rounded transition shadow-sm"
              >
                Sign Up
              </Link>
            </div>
          )}
        </div>
      </header>

      {/* AWS ALB Diagnostics Modal */}
      <AlbDiagnosticsModal
        isOpen={isAlbModalOpen}
        onClose={() => setIsAlbModalOpen(false)}
      />
    </>
  );
};

export default Navbar;
