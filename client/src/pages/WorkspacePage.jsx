import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../api/client";
import { socket } from "../socket.js";
import { toast } from "react-hot-toast";

import Navbar from "../components/Navbar";
import FileTree from "../components/FileTree";
import TabBar from "../components/TabBar";
import Editor from "../components/Editor";
import TerminalPanel from "../components/TerminalPanel";
import CollaboratorsPanel from "../components/CollaboratorsPanel";
import VersionHistoryPanel from "../components/VersionHistoryPanel";

import {
  Users,
  History,
  Terminal,
  Columns,
  Maximize2,
  Minimize2,
  FolderTree,
} from "lucide-react";

const WorkspacePage = () => {
  const { projectId, roomId: legacyRoomId } = useParams();
  const currentRoomId = projectId || legacyRoomId || "default-session";
  const navigate = useNavigate();
  const { user, guestLogin } = useAuth();

  const username = user?.username || localStorage.getItem("username") || "Anonymous";
  const userColor = user?.avatar_color || "#38bdf8";

  // Project and Files state
  const [project, setProject] = useState(null);
  const [files, setFiles] = useState([]);
  const [openFiles, setOpenFiles] = useState([]);
  const [activeFileId, setActiveFileId] = useState(null);
  const [checkpoints, setCheckpoints] = useState([]);
  const [testCases, setTestCases] = useState([]);

  // Right sidebar and bottom panel toggles
  const [activeRightTab, setActiveRightTab] = useState("collaborators"); // "collaborators" | "history" | null
  const [isBottomOpen, setIsBottomOpen] = useState(true);
  const [isFileTreeOpen, setIsFileTreeOpen] = useState(true);

  // Execution & Collaborator state
  const [connectedClients, setConnectedClients] = useState([]);
  const [messages, setMessages] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [saveStatus, setSaveStatus] = useState("Saved");
  const [customStdin, setCustomStdin] = useState("");
  const [activeDiff, setActiveDiff] = useState(null);
  const [executionResult, setExecutionResult] = useState({
    stdout: "",
    stderr: "",
    exitCode: null,
    durationMs: null,
  });

  const codeRef = useRef("");

  // 1. Load project data from API if in project mode
  useEffect(() => {
    if (!projectId) {
      // In legacy standalone room mode, create virtual default file
      const defaultFile = {
        id: "scratchpad",
        name: "main.js",
        path: "/",
        language: "javascript",
        content: `// CodeForge Realtime Collaboration Room: ${legacyRoomId}\nconsole.log("Welcome to CodeForge!");\n`,
        is_entry_point: true,
      };
      setFiles([defaultFile]);
      setOpenFiles([defaultFile]);
      setActiveFileId("scratchpad");
      return;
    }

    const loadProject = async () => {
      // Auto-provision guest user if visiting via direct link without account
      if (!user && !localStorage.getItem("codeforge_token")) {
        try {
          await guestLogin();
        } catch {
          // Continue loading
        }
      }

      try {
        const res = await api.get(`/api/projects/${projectId}`);
        const data = res.data;
        setProject(data.project);
        setFiles(data.files || []);
        setCheckpoints(data.checkpoints || []);
        setTestCases(data.test_cases || []);

        if (data.files && data.files.length > 0) {
          const entry = data.files.find((f) => f.is_entry_point) || data.files[0];
          setOpenFiles([entry]);
          setActiveFileId(entry.id);
        }
      } catch (err) {
        console.error("Failed to load project:", err);
        toast.error(err.response?.data?.error || "Could not load project workspace.");
      }
    };

    loadProject();
  }, [projectId, legacyRoomId]);

  // 2. Setup Socket.IO presence and project chat
  useEffect(() => {
    socket.connect();

    socket.emit("join", {
      roomId: currentRoomId,
      username,
      color: userColor,
    });

    socket.on("joined", ({ clients }) => {
      setConnectedClients(clients || []);
    });

    socket.on("chat-message", (msg) => {
      setMessages((prev) => [...prev, msg]);
    });

    socket.on("collaborator-file-change", ({ username: cUser, fileId }) => {
      // Notify file switch
    });

    return () => {
      socket.off("joined");
      socket.off("chat-message");
      socket.off("collaborator-file-change");
      socket.disconnect();
    };
  }, [currentRoomId, username, userColor]);

  const activeFile = files.find((f) => f.id === activeFileId) || openFiles[0] || null;

  // File management
  const handleSelectFile = (file) => {
    if (!openFiles.some((f) => f.id === file.id)) {
      setOpenFiles((prev) => [...prev, file]);
    }
    setActiveFileId(file.id);
    socket.emit("active-file-change", { roomId: currentRoomId, fileId: file.id });
  };

  const handleCloseTab = (fileIdToClose) => {
    const remaining = openFiles.filter((f) => f.id !== fileIdToClose);
    setOpenFiles(remaining);
    if (activeFileId === fileIdToClose && remaining.length > 0) {
      setActiveFileId(remaining[remaining.length - 1].id);
    }
  };

  const handleCreateFile = async (name) => {
    if (!projectId) {
      const newFile = {
        id: `file_${Date.now()}`,
        name,
        path: "/",
        language: name.endsWith(".py") ? "python" : name.endsWith(".cpp") ? "cpp" : "javascript",
        content: "",
      };
      setFiles((prev) => [...prev, newFile]);
      handleSelectFile(newFile);
      toast.success(`Created ${name}`);
      return;
    }

    try {
      const res = await api.post(`/api/projects/${projectId}/files`, { name });
      const newFile = res.data.file;
      setFiles((prev) => [...prev, newFile]);
      handleSelectFile(newFile);
      toast.success(`Created ${name}`);
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to create file.");
    }
  };

  const handleDeleteFile = async (fileId) => {
    if (!projectId) {
      setFiles((prev) => prev.filter((f) => f.id !== fileId));
      handleCloseTab(fileId);
      return;
    }

    try {
      await api.delete(`/api/projects/${projectId}/files/${fileId}`);
      setFiles((prev) => prev.filter((f) => f.id !== fileId));
      handleCloseTab(fileId);
      toast.success("File deleted.");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to delete file.");
    }
  };

  // Execution
  const handleRunCode = async (evaluateAllTests = false) => {
    if (!activeFile) {
      toast.error("No active file selected.");
      return;
    }

    try {
      setIsRunning(true);
      setIsBottomOpen(true);
      setExecutionResult({
        stdout: "",
        stderr: "Dispatching to isolated execution container...",
        exitCode: null,
        durationMs: null,
      });

      const endpoint = projectId
        ? `/api/execute/projects/${projectId}/execute`
        : `/api/execute`;

      const response = await api.post(endpoint, {
        code: codeRef.current,
        language: activeFile.language,
        stdin: customStdin,
        includeProjectTestCases: evaluateAllTests,
        testCases: evaluateAllTests ? testCases : [],
      });

      setExecutionResult(response.data);
      if (response.data.exitCode === 0) {
        toast.success("Execution completed successfully.");
      } else {
        toast.error(`Exited with code ${response.data.exitCode}`);
      }
    } catch (err) {
      console.error("Execution error:", err);
      toast.error("Execution failed.");
      setExecutionResult({
        stdout: "",
        stderr: err.response?.data?.stderr || err.message || "Failed to communicate with execution service.",
        exitCode: 1,
        durationMs: 0,
      });
    } finally {
      setIsRunning(false);
    }
  };

  // Checkpoints & Version History
  const handleCreateCheckpoint = async (msg) => {
    if (!projectId) {
      toast.error("Checkpoints require a persistent project.");
      return;
    }

    try {
      const res = await api.post(`/api/projects/${projectId}/checkpoints`, { message: msg });
      setCheckpoints((prev) => [res.data.checkpoint, ...prev]);
      toast.success("Version checkpoint recorded!");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to save checkpoint.");
    }
  };

  const handleRestoreCheckpoint = async (checkpointId) => {
    try {
      const res = await api.post(`/api/projects/${projectId}/checkpoints/${checkpointId}/restore`);
      setCheckpoints((prev) => [res.data.new_checkpoint, ...prev]);
      setFiles(res.data.files);
      toast.success("Project restored to earlier version!");
      // Reload current file
      const match = res.data.files.find((f) => f.id === activeFileId);
      if (match) {
        codeRef.current = match.content;
      }
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to restore checkpoint.");
    }
  };

  const handleViewDiff = async (checkpointId) => {
    if (!activeFile) return;
    try {
      const res = await api.post(`/api/projects/${projectId}/checkpoints/diff`, {
        fileId: activeFile.id,
        checkpointIdA: checkpointId,
      });
      setActiveDiff(res.data);
    } catch (err) {
      toast.error("Could not generate textual diff.");
    }
  };

  // Test cases
  const handleCreateTestCase = async (tcData) => {
    if (!projectId) return;
    try {
      const res = await api.post(`/api/projects/${projectId}/test-cases`, tcData);
      setTestCases((prev) => [...prev, res.data.test_case]);
      toast.success("Test case saved.");
    } catch (err) {
      toast.error("Failed to add test case.");
    }
  };

  const handleDeleteTestCase = async (tcId) => {
    if (!projectId) return;
    try {
      await api.delete(`/api/projects/${projectId}/test-cases/${tcId}`);
      setTestCases((prev) => prev.filter((t) => t.id !== tcId));
      toast.success("Test case removed.");
    } catch (err) {
      toast.error("Failed to delete test case.");
    }
  };

  // Chat message send
  const handleSendMessage = (text) => {
    socket.emit("chat-message", {
      roomId: currentRoomId,
      message: text,
      username,
      color: userColor,
    });
  };

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-slate-950 font-sans">
      {/* Top Navbar */}
      <Navbar
        project={project}
        isRunning={isRunning}
        onRunCode={() => handleRunCode(false)}
        connectedClients={connectedClients}
        saveStatus={saveStatus}
        onOpenInvite={() => setActiveRightTab("collaborators")}
        setActiveRightTab={setActiveRightTab}
      />

      {/* Main Workspace Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: File Explorer (Collapsible) */}
        {isFileTreeOpen && (
          <aside className="w-56 shrink-0 h-full">
            <FileTree
              files={files}
              activeFileId={activeFileId}
              onSelectFile={handleSelectFile}
              onCreateFile={handleCreateFile}
              onDeleteFile={handleDeleteFile}
            />
          </aside>
        )}

        {/* Center: Editor + Bottom Terminal */}
        <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
          {/* Tab Bar */}
          <div className="flex items-center justify-between bg-slate-950 border-b border-slate-800 pr-2">
            <div className="flex items-center flex-1 overflow-hidden">
              <button
                onClick={() => setIsFileTreeOpen(!isFileTreeOpen)}
                className="h-9 px-2.5 text-slate-400 hover:text-white border-r border-slate-800 transition"
                title="Toggle File Tree"
              >
                <FolderTree className="size-4" />
              </button>
              <TabBar
                openFiles={openFiles}
                activeFileId={activeFileId}
                onSelectTab={handleSelectFile}
                onCloseTab={handleCloseTab}
              />
            </div>

            {/* Right sidebar quick toggles */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setActiveRightTab(activeRightTab === "collaborators" ? null : "collaborators")}
                className={`p-1.5 rounded transition ${
                  activeRightTab === "collaborators"
                    ? "bg-slate-800 text-cyan-400"
                    : "text-slate-400 hover:text-slate-200"
                }`}
                title="Collaborators & Chat"
              >
                <Users className="size-4" />
              </button>
              <button
                onClick={() => setActiveRightTab(activeRightTab === "history" ? null : "history")}
                className={`p-1.5 rounded transition ${
                  activeRightTab === "history"
                    ? "bg-slate-800 text-cyan-400"
                    : "text-slate-400 hover:text-slate-200"
                }`}
                title="Version History & Checkpoints"
              >
                <History className="size-4" />
              </button>
            </div>
          </div>

          {/* Central CodeMirror Editor */}
          <div className="flex-1 overflow-hidden relative">
            {activeFile ? (
              <Editor
                key={`${currentRoomId}-${activeFile.id}`}
                roomId={currentRoomId}
                fileId={activeFile.id}
                language={activeFile.language}
                codeRef={codeRef}
                username={username}
                userColor={userColor}
              />
            ) : (
              <div className="h-full flex items-center justify-center text-slate-600 text-sm">
                No file open. Select a file from the explorer on the left.
              </div>
            )}
          </div>

          {/* Bottom Terminal & Test Runner Panel */}
          {isBottomOpen && (
            <div className="h-64 shrink-0 overflow-hidden">
              <TerminalPanel
                executionResult={executionResult}
                isRunning={isRunning}
                onRunCode={() => handleRunCode(false)}
                testCases={testCases}
                onCreateTestCase={handleCreateTestCase}
                onDeleteTestCase={handleDeleteTestCase}
                onRunTestCases={() => handleRunCode(true)}
                customStdin={customStdin}
                setCustomStdin={setCustomStdin}
              />
            </div>
          )}
        </div>

        {/* Right Side Panel: Collaborators or Version History */}
        {activeRightTab && (
          <aside className="w-72 shrink-0 h-full border-l border-slate-800">
            {activeRightTab === "collaborators" ? (
              <CollaboratorsPanel
                connectedClients={connectedClients}
                projectId={currentRoomId}
                onInviteMember={() => toast.success("Invite link ready")}
                messages={messages}
                onSendMessage={handleSendMessage}
                currentUser={user}
              />
            ) : (
              <VersionHistoryPanel
                checkpoints={checkpoints}
                onCreateCheckpoint={handleCreateCheckpoint}
                onRestoreCheckpoint={handleRestoreCheckpoint}
                onViewDiff={handleViewDiff}
                activeDiff={activeDiff}
                onCloseDiff={() => setActiveDiff(null)}
              />
            )}
          </aside>
        )}
      </div>
    </div>
  );
};

export default WorkspacePage;

