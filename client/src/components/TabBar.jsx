import React from "react";
import { X, Code2 } from "lucide-react";

const TabBar = ({
  openFiles = [],
  activeFileId,
  onSelectTab,
  onCloseTab,
}) => {
  if (openFiles.length === 0) {
    return null;
  }

  return (
    <div className="h-9 bg-slate-950 border-b border-slate-800 flex items-center overflow-x-auto select-none no-scrollbar">
      {openFiles.map((file) => {
        const isActive = file.id === activeFileId;
        return (
          <div
            key={file.id}
            onClick={() => onSelectTab(file)}
            className={`group h-full px-3.5 flex items-center gap-2 text-xs border-r border-slate-800 cursor-pointer transition font-mono border-t-2 ${
              isActive
                ? "bg-slate-900 text-white font-medium border-t-cyan-400"
                : "border-t-transparent bg-slate-950/60 text-slate-400 hover:bg-slate-900/60 hover:text-slate-200"
            }`}
          >
            <span className="truncate max-w-[140px]">{file.name}</span>
            {openFiles.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onCloseTab(file.id);
                }}
                className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition"
                title="Close Tab"
              >
                <X className="size-3" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default TabBar;

