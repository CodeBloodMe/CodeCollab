import React, { useState } from "react";
import {
  History,
  GitCommit,
  RotateCcw,
  PlusCircle,
  FileDiff,
  Calendar,
  User,
  Check,
  X,
  Eye,
} from "lucide-react";
import { toast } from "react-hot-toast";

const VersionHistoryPanel = ({
  checkpoints = [],
  onCreateCheckpoint,
  onRestoreCheckpoint,
  onViewDiff,
  activeDiff,
  onCloseDiff,
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [message, setMessage] = useState("");

  const handleCreateSubmit = (e) => {
    e.preventDefault();
    if (!message.trim()) return;
    onCreateCheckpoint(message.trim());
    setMessage("");
    setIsCreating(false);
  };

  return (
    <div className="h-full flex flex-col bg-slate-900 border-l border-slate-800 text-slate-300 select-none">
      {/* Header */}
      <div className="h-10 px-3 border-b border-slate-800 flex items-center justify-between bg-slate-950">
        <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-300">
          <History className="size-4 text-cyan-400" />
          <span>Version Checkpoints</span>
        </div>

        <button
          onClick={() => setIsCreating(true)}
          className="flex items-center gap-1 px-2 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-xs font-semibold transition"
          title="Create New Checkpoint"
        >
          <PlusCircle className="size-3.5" />
          <span>Save Point</span>
        </button>
      </div>

      {/* Inline Checkpoint Creator */}
      {isCreating && (
        <form
          onSubmit={handleCreateSubmit}
          className="p-3 border-b border-slate-800 bg-slate-950/90 space-y-2"
        >
          <input
            type="text"
            autoFocus
            placeholder="Commit message (e.g. Added binary search)"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 outline-none focus:border-cyan-400"
          />
          <div className="flex justify-end gap-1.5">
            <button
              type="button"
              onClick={() => {
                setIsCreating(false);
                setMessage("");
              }}
              className="px-2.5 py-1 text-xs text-slate-400 hover:text-slate-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold transition"
            >
              Save Checkpoint
            </button>
          </div>
        </form>
      )}

      {/* Checkpoints Timeline */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {checkpoints.length === 0 ? (
          <div className="text-center text-xs text-slate-500 mt-6">
            No version checkpoints recorded yet. Click "Save Point" to capture a snapshot.
          </div>
        ) : (
          checkpoints.map((cp, idx) => (
            <div
              key={cp.id}
              className="p-3 rounded-xl bg-slate-850 border border-slate-800 text-xs space-y-2 relative hover:border-slate-750 transition"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-1.5 font-semibold text-slate-200 text-xs">
                  <GitCommit className="size-3.5 text-cyan-400 shrink-0" />
                  <span className="truncate">{cp.message}</span>
                </div>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 shrink-0">
                  #{cp.id}
                </span>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/60">
                <div className="flex items-center gap-1">
                  <User className="size-3 text-slate-500" />
                  <span>{cp.author_username || cp.author || "System"}</span>
                </div>

                <div className="flex items-center gap-1 text-[10px] text-slate-500">
                  <Calendar className="size-3" />
                  <span>{new Date(cp.created_at).toLocaleDateString()}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-1.5 pt-1">
                <button
                  onClick={() => onViewDiff(cp.id)}
                  className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white transition text-[11px]"
                  title="Inspect textual diff"
                >
                  <Eye className="size-3" />
                  <span>Diff</span>
                </button>

                <button
                  onClick={() => {
                    if (
                      window.confirm(
                        `Restore project to Checkpoint #${cp.id} ("${cp.message}")? A new recovery checkpoint will be recorded.`
                      )
                    ) {
                      onRestoreCheckpoint(cp.id);
                    }
                  }}
                  className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-rose-950/60 text-slate-300 hover:text-rose-300 border border-transparent hover:border-rose-800/40 transition text-[11px]"
                  title="Restore this version non-destructively"
                >
                  <RotateCcw className="size-3" />
                  <span>Restore</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Diff Inspector Modal */}
      {activeDiff && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-750 rounded-2xl w-full max-w-3xl max-h-[80vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div className="flex items-center gap-2">
                <FileDiff className="size-5 text-cyan-400" />
                <h3 className="font-bold text-sm text-slate-100">
                  Textual Diff Inspector — {activeDiff.file_name}
                </h3>
              </div>
              <button
                onClick={onCloseDiff}
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-4 font-mono text-xs bg-slate-950 leading-relaxed">
              {activeDiff.diff_lines && activeDiff.diff_lines.length > 0 ? (
                activeDiff.diff_lines.map((part, index) => {
                  const color = part.added
                    ? "bg-emerald-950/60 text-emerald-300 border-l-2 border-emerald-400"
                    : part.removed
                    ? "bg-rose-950/60 text-rose-300 border-l-2 border-rose-400 line-through"
                    : "text-slate-300";
                  return (
                    <div key={index} className={`px-2 py-0.5 whitespace-pre-wrap ${color}`}>
                      {part.value}
                    </div>
                  );
                })
              ) : (
                <pre className="text-slate-400">{activeDiff.patch || "No textual changes."}</pre>
              )}
            </div>

            <div className="p-3 border-t border-slate-800 flex justify-between items-center bg-slate-950 text-xs text-slate-400">
              <div>
                <span className="text-emerald-400 font-bold">
                  +{activeDiff.summary?.added_lines || 0}
                </span>{" "}
                /{" "}
                <span className="text-rose-400 font-bold">
                  -{activeDiff.summary?.removed_lines || 0}
                </span>{" "}
                lines changed
              </div>
              <button
                onClick={onCloseDiff}
                className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VersionHistoryPanel;

