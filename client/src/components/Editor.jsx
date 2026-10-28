import React, { useEffect, useMemo, useRef, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { cpp } from "@codemirror/lang-cpp";
import { java } from "@codemirror/lang-java";
import { dracula } from "@uiw/codemirror-theme-dracula";
import * as Y from "yjs";
import { SocketIOProvider } from "y-socket.io";
import { yCollab } from "y-codemirror.next";

const Editor = ({
  language = "javascript",
  roomId,
  fileId,
  codeRef,
  onCodeChange,
  username = "Anonymous",
  userColor = "#38bdf8",
}) => {
  const providerRef = useRef(null);
  const ytextRef = useRef(null);
  const [sharedExtension, setSharedExtension] = useState(null);

  // Compute document room name: scoped per project and file, or bare roomId
  const docRoomId = useMemo(() => {
    if (fileId && roomId) {
      return `${roomId}:${fileId}`;
    }
    return roomId || "default-workspace";
  }, [roomId, fileId]);

  useEffect(() => {
    if (!docRoomId) return undefined;

    const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";
    console.log(`[CodeForge Editor] Initializing Yjs for document: "${docRoomId}"`);

    const ydoc = new Y.Doc();
    const ytext = ydoc.getText("codemirror");
    const provider = new SocketIOProvider(backendUrl, docRoomId, ydoc, {
      autoConnect: true,
    });

    // Set collaborator awareness details (cursor name and color)
    provider.awareness.setLocalStateField("user", {
      name: username,
      color: userColor,
    });

    providerRef.current = provider;
    ytextRef.current = ytext;

    const updateCode = () => {
      const currentString = ytext.toString();
      if (codeRef) {
        codeRef.current = currentString;
      }
      if (onCodeChange) {
        onCodeChange(currentString);
      }
    };

    ytext.observe(updateCode);
    updateCode();

    // Attach yCollab extension with cursor and selection awareness
    setSharedExtension(yCollab(ytext, provider.awareness));

    return () => {
      console.log(`[CodeForge Editor] Cleaning up document: "${docRoomId}"`);
      ytext.unobserve(updateCode);
      provider.destroy();
      ydoc.destroy();
      providerRef.current = null;
      ytextRef.current = null;
      setSharedExtension(null);
    };
  }, [docRoomId, username, userColor]);

  const languageExtensions = {
    javascript: javascript(),
    python: python(),
    java: java(),
    cpp: cpp(),
  };

  const extensions = useMemo(() => {
    return [
      languageExtensions[language] || javascript(),
      sharedExtension,
    ].filter(Boolean);
  }, [language, sharedExtension]);

  return (
    <div className="h-full w-full overflow-hidden bg-[#282a36]">
      <CodeMirror
        height="100%"
        theme={dracula}
        extensions={extensions}
        basicSetup={{
          lineNumbers: true,
          highlightActiveLineGutter: true,
          highlightSpecialChars: true,
          history: true,
          foldGutter: true,
          drawSelection: true,
          dropCursor: true,
          allowMultipleSelections: true,
          indentOnInput: true,
          syntaxHighlighting: true,
          bracketMatching: true,
          closeBrackets: true,
          autocompletion: true,
          rectangularSelection: true,
          crosshairCursor: true,
          highlightActiveLine: true,
          highlightSelectionMatches: true,
          closeBracketsKeymap: true,
          defaultKeymap: true,
          searchKeymap: true,
          historyKeymap: true,
          foldKeymap: true,
          completionKeymap: true,
          lintKeymap: true,
        }}
      />
    </div>
  );
};

export default Editor;
