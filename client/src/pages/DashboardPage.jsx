import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../api/client";
import { toast } from "react-hot-toast";
import Navbar from "../components/Navbar";
import {
  FolderKanban,
  Plus,
  Play,
  Trash2,
  FileCode2,
  Lock,
  Globe,
  Clock,
  Code2,
  ArrowRight,
  Sparkles,
  Layers,
} from "lucide-react";

const DashboardPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // New Project Form
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [template, setTemplate] = useState("javascript");
  const [visibility, setVisibility] = useState("private");
  const [creating, setCreating] = useState(false);

  // Quick join room input
  const [quickRoomId, setQuickRoomId] = useState("");

  const fetchProjects = async () => {
    try {
      const res = await api.get("/api/projects");
      setProjects(res.data.projects || []);
    } catch (err) {
      console.error("Failed to load projects:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Please enter a project name.");
      return;
    }

    try {
      setCreating(true);
      const res = await api.post("/api/projects", {
        name: name.trim(),
        description: description.trim(),
        template,
        visibility,
      });

      toast.success("Project created!");
      setIsModalOpen(false);
      setName("");
      setDescription("");
      navigate(`/project/${res.data.project.id}`);
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to create project.");
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteProject = async (projectId, projectName) => {
    if (!window.confirm(`Are you sure you want to delete "${projectName}"?`)) {
      return;
    }

    try {
      await api.delete(`/api/projects/${projectId}`);
      toast.success("Project deleted.");
      setProjects((prev) => prev.filter((p) => p.id !== projectId));
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to delete project.");
    }
  };

  const handleQuickJoin = (e) => {
    e.preventDefault();
    if (!quickRoomId.trim()) return;
    const clean = quickRoomId.trim();
    if (clean.includes("/project/")) {
      const id = clean.split("/project/")[1].split("/")[0];
      navigate(`/project/${id}`);
    } else {
      navigate(`/editor/${clean}`);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Header Hero Banner */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-slate-850 border border-slate-800 shadow-xl">
          <div className="space-y-1">
            <h1 className="text-2xl font-black text-white flex items-center gap-2">
              <span>Welcome to</span>
              <span className="text-cyan-400">CodeForge</span>
            </h1>
            <p className="text-sm text-slate-400">
              Your real-time collaborative development workspaces and execution sandbox.
            </p>
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm shadow-lg shadow-cyan-500/20 transition"
          >
            <Plus className="size-4" />
            <span>New Project</span>
          </button>
        </div>

        {/* Quick Join Card */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-sm">
            <span className="font-semibold text-slate-200 block">
              Have a room ID or invite code?
            </span>
            <span className="text-xs text-slate-400">
              Jump straight into a live session with your team.
            </span>
          </div>

          <form onSubmit={handleQuickJoin} className="flex gap-2 w-full sm:w-auto">
            <input
              type="text"
              placeholder="Paste Room ID or URL..."
              value={quickRoomId}
              onChange={(e) => setQuickRoomId(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 outline-none focus:border-cyan-400 min-w-[220px]"
            />
            <button
              type="submit"
              className="px-4 py-1.5 bg-slate-800 hover:bg-slate-750 text-cyan-300 rounded-lg text-xs font-semibold border border-slate-700 transition"
            >
              Join
            </button>
          </form>
        </div>

        {/* Projects Grid */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="text-base font-bold text-slate-200 flex items-center gap-2">
              <FolderKanban className="size-4 text-cyan-400" />
              <span>Your Workspaces</span>
            </h2>
            <span className="text-xs text-slate-500 font-mono">
              {projects.length} project(s)
            </span>
          </div>

          {loading ? (
            <div className="py-12 text-center text-sm text-slate-500">
              Loading your workspaces...
            </div>
          ) : projects.length === 0 ? (
            <div className="py-16 text-center rounded-2xl border border-dashed border-slate-800 space-y-3">
              <div className="size-12 rounded-full bg-slate-900 flex items-center justify-center mx-auto text-cyan-400">
                <Code2 className="size-6" />
              </div>
              <p className="text-sm font-medium text-slate-300">
                You don't have any projects yet.
              </p>
              <button
                onClick={() => setIsModalOpen(true)}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold"
              >
                Create your first project
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.map((proj) => (
                <div
                  key={proj.id}
                  className="group p-5 rounded-xl bg-slate-900 border border-slate-800/80 hover:border-slate-700 transition flex flex-col justify-between space-y-4 shadow-sm hover:shadow-md"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold text-base text-slate-100 group-hover:text-cyan-300 transition truncate">
                        {proj.name}
                      </h3>
                      <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-750 flex items-center gap-1">
                        {proj.visibility === "private" ? (
                          <Lock className="size-2.5 text-amber-400" />
                        ) : (
                          <Globe className="size-2.5 text-cyan-400" />
                        )}
                        <span>{proj.visibility}</span>
                      </span>
                    </div>

                    <p className="text-xs text-slate-400 line-clamp-2 min-h-[32px]">
                      {proj.description || "Multi-file collaborative development workspace."}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-500">
                    <div className="flex items-center gap-2">
                      <FileCode2 className="size-3.5 text-slate-400" />
                      <span>{proj.file_count || 1} file(s)</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Link
                        to={`/project/${proj.id}`}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 border border-cyan-800/40 text-xs font-semibold transition"
                      >
                        <span>Open IDE</span>
                        <ArrowRight className="size-3" />
                      </Link>

                      <button
                        onClick={() => handleDeleteProject(proj.id, proj.name)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition"
                        title="Delete project"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* New Project Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-5">
            <div>
              <h2 className="text-lg font-bold text-slate-100">Create New Project</h2>
              <p className="text-xs text-slate-400">
                Choose a starter template and workspace configuration.
              </p>
            </div>

            <form onSubmit={handleCreateProject} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 block">
                  Project Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Distributed Consensus Engine"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 outline-none focus:border-cyan-400"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 block">
                  Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Briefly describe what this project does..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 outline-none focus:border-cyan-400 resize-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 block">
                  Language & Starter Template
                </label>
                <select
                  value={template}
                  onChange={(e) => setTemplate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 outline-none focus:border-cyan-400"
                >
                  <option value="javascript">JavaScript (Node.js 24 + Express)</option>
                  <option value="python">Python 3 (Data Structures & Algorithm Starter)</option>
                  <option value="cpp">C++ (G++ 15 Multi-file Solution)</option>
                  <option value="java">Java (OpenJDK 17 Class Runner)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 block">
                  Visibility
                </label>
                <select
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 outline-none focus:border-cyan-400"
                >
                  <option value="private">Private (Only invited members)</option>
                  <option value="public">Public (Anyone with link can view)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-5 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition"
                >
                  {creating ? "Creating..." : "Create Project"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardPage;

