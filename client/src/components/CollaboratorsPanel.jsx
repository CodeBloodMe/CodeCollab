import React, { useState } from "react";
import { Users, UserPlus, Copy, Check, MessageSquare, Send } from "lucide-react";
import { toast } from "react-hot-toast";

const CollaboratorsPanel = ({
  connectedClients = [],
  members = [],
  projectId,
  onInviteMember,
  messages = [],
  onSendMessage,
  currentUser,
}) => {
  const [activeSubTab, setActiveSubTab] = useState("users"); // "users" or "chat"
  const [inviteIdentifier, setInviteIdentifier] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [copied, setCopied] = useState(false);

  const handleCopyLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("Workspace invite link copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleInviteSubmit = (e) => {
    e.preventDefault();
    if (!inviteIdentifier.trim()) return;
    onInviteMember(inviteIdentifier.trim());
    setInviteIdentifier("");
  };

  const handleSendChat = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    onSendMessage(chatInput.trim());
    setChatInput("");
  };

  return (
    <div className="h-full flex flex-col bg-slate-900 border-l border-slate-800 text-slate-300 select-none">
      {/* Sub-tab Navigation */}
      <div className="h-10 border-b border-slate-800 flex items-center px-2 gap-1 bg-slate-950">
        <button
          onClick={() => setActiveSubTab("users")}
          className={`flex-1 py-1.5 rounded text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
            activeSubTab === "users"
              ? "bg-slate-800 text-cyan-300"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Users className="size-3.5" />
          <span>Presence ({connectedClients.length})</span>
        </button>
        <button
          onClick={() => setActiveSubTab("chat")}
          className={`flex-1 py-1.5 rounded text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
            activeSubTab === "chat"
              ? "bg-slate-800 text-cyan-300"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <MessageSquare className="size-3.5" />
          <span>Room Chat</span>
        </button>
      </div>

      {activeSubTab === "users" ? (
        <div className="flex-1 flex flex-col overflow-y-auto p-3 gap-4">
          {/* Active Collaborators */}
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center justify-between">
              <span>Active in Room</span>
              <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
            </div>

            <div className="space-y-1.5">
              {connectedClients.map((client) => {
                const isMe = client.username === (currentUser && currentUser.username);
                return (
                  <div
                    key={client.socketId}
                    className="flex items-center justify-between p-2 rounded-lg bg-slate-850 border border-slate-800/80 text-xs"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <div
                        className="size-6 rounded-full flex items-center justify-center text-[10px] font-bold text-slate-950 uppercase shadow"
                        style={{ backgroundColor: client.color || "#38bdf8" }}
                      >
                        {client.username ? client.username[0] : "U"}
                      </div>
                      <span className="font-medium text-slate-200 truncate">
                        {client.username} {isMe && "(You)"}
                      </span>
                    </div>

                    <span className="text-[10px] text-emerald-400 font-mono">
                      Connected
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Controlled Share Link */}
          <div className="pt-2 border-t border-slate-800">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 block">
              Share Workspace Link
            </span>
            <button
              onClick={handleCopyLink}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-750 border border-slate-700 text-xs font-semibold text-slate-200 transition"
            >
              {copied ? (
                <>
                  <Check className="size-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="size-3.5 text-slate-400" />
                  <span>Copy Session Invite URL</span>
                </>
              )}
            </button>
          </div>

          {/* Add Project Member */}
          <div className="pt-2 border-t border-slate-800">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 block">
              Add Member by Username
            </span>
            <form onSubmit={handleInviteSubmit} className="flex gap-1.5">
              <input
                type="text"
                placeholder="Username or email"
                value={inviteIdentifier}
                onChange={(e) => setInviteIdentifier(e.target.value)}
                className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 outline-none focus:border-cyan-400"
              />
              <button
                type="submit"
                className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold transition"
              >
                Add
              </button>
            </form>
          </div>
        </div>
      ) : (
        /* Project Room Chat */
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
            {messages.length === 0 ? (
              <div className="text-center text-xs text-slate-500 mt-8">
                No messages yet. Send a message to collaborators in this project.
              </div>
            ) : (
              messages.map((msg) => (
                <div key={msg.id} className="text-xs">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span
                      className="font-bold text-[11px]"
                      style={{ color: msg.color || "#38bdf8" }}
                    >
                      {msg.sender}
                    </span>
                    <span className="text-[9px] text-slate-500">{msg.timestamp}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-800/80 text-slate-200 border border-slate-750 break-words">
                    {msg.text}
                  </div>
                </div>
              ))
            )}
          </div>

          <form onSubmit={handleSendChat} className="p-2 border-t border-slate-800 flex gap-1.5 bg-slate-950">
            <input
              type="text"
              placeholder="Chat with collaborators..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 outline-none focus:border-cyan-400"
            />
            <button
              type="submit"
              className="p-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition"
            >
              <Send className="size-3.5" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default CollaboratorsPanel;

