import React, { useState } from "react";
import {
  FileCode2,
  FilePlus,
  Trash2,
  Check,
  X,
  FileText,
  Flame,
  Coffee,
  Braces,
  Hash,
} from "lucide-react";

function getFileIcon(filename) {
  const ext = filename.split(".").pop().toLowerCase();
  switch (ext) {
    case "js":
    case "jsx":
      return <span className="text-yellow-400 font-mono text-xs font-bold">JS</span>;
    case "ts":
    case "tsx":
      return <span className="text-blue-400 font-mono text-xs font-bold">TS</span>;
    case "py":
      return <span className="text-emerald-400 font-mono text-xs font-bold">PY</span>;
    case "cpp":
    case "cc":
    case "c":
      return <span className="text-purple-400 font-mono text-xs font-bold">C++</span>;
    case "java":
      return <Coffee className="size-3.5 text-amber-500" />;
    case "json":
      return <Braces className="size-3.5 text-orange-400" />;
    case "md":
      return <FileText className="size-3.5 text-slate-400" />;
    default:
      return <FileCode2 className="size-3.5 text-slate-400" />;
  }
}

const FileTree = ({
  files = [],
  activeFileId,
  onSelectFile,
  onCreateFile,
  onDeleteFile,
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [newFileName, setNewFileName] = useState("");

  const handleCreateSubmit = (e) => {
    e.preventDefault();
    if (!newFileName.trim()) return;
    onCreateFile(newFileName.trim());
    setNewFileName("");
    setIsCreating(false);
  };

  return (
    <div className="h-full flex flex-col bg-slate-900 border-r border-slate-800 select-none text-slate-300">
      {/* Header */}
      <div className="h-10 px-3 border-b border-slate-800 flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Files Explorer
        </span>
        <button
          onClick={() => setIsCreating(true)}
          className="p-1 text-slate-400 hover:text-cyan-400 transition rounded hover:bg-slate-800"
          title="New Source File"
        >
          <FilePlus className="size-4" />
        </button>
      </div>

      {/* Inline File Creator */}
      {isCreating && (
        <form
          onSubmit={handleCreateSubmit}
          className="p-2 border-b border-slate-800 flex items-center gap-1 bg-slate-950"
        >
          <input
            type="text"
            autoFocus
            placeholder="e.g. solution.py"
            value={newFileName}
            onChange={(e) => setNewFileName(e.target.value)}
            className="flex-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-100 outline-none focus:border-cyan-400 font-mono"
          />
          <button
            type="submit"
            className="p-1 text-emerald-400 hover:text-emerald-300"
            title="Create"
          >
            <Check className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => {
              setIsCreating(false);
              setNewFileName("");
            }}
            className="p-1 text-slate-500 hover:text-slate-400"
            title="Cancel"
          >
            <X className="size-3.5" />
          </button>
        </form>
      )}

      {/* File List */}
      <div className="flex-1 overflow-y-auto py-1">
        {files.length === 0 ? (
          <div className="p-4 text-center text-xs text-slate-500">
            No files in workspace. Click + to add one.
          </div>
        ) : (
          files.map((file) => {
            const isActive = file.id === activeFileId;
            return (
              <div
                key={file.id}
                onClick={() => onSelectFile(file)}
                className={`group flex items-center justify-between px-3 py-1.5 cursor-pointer text-xs transition border-l-2 ${
                  isActive
                    ? "bg-slate-800/80 text-white font-medium border-cyan-400"
                    : "border-transparent hover:bg-slate-800/40 text-slate-400 hover:text-slate-200"
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <div className="w-5 flex items-center justify-center">
                    {getFileIcon(file.name)}
                  </div>
                  <span className="truncate font-mono">{file.name}</span>
                  {file.is_entry_point && (
                    <span
                      title="Main Entrypoint File"
                      className="text-[9px] font-mono px-1 rounded bg-cyan-950 text-cyan-300 border border-cyan-800/50"
                    >
                      entry
                    </span>
                  )}
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm(`Delete ${file.name}?`)) {
                      onDeleteFile(file.id);
                    }
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-rose-400 transition rounded"
                  title="Delete File"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default FileTree;

