"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Edit, Eye, Loader2 } from "lucide-react";
import { NoteViewer } from "./note-viewer";
import { ConflictDialog } from "./conflict-dialog";
import { debounce } from "@/lib/utils/debounce";
import { getSocket } from "@/lib/socket-client";
import { useSession } from "@/lib/auth-client";

interface ConflictData {
  serverContent: string;
  serverVersion: number;
  editedBy: string;
  editedByName: string;
}

interface NoteEditorProps {
  /** Type of note: channel or personal */
  noteType: "channel" | "personal";
  /** Channel ID (required for channel notes) */
  channelId?: string;
  /** Workspace/Organization ID (required for personal notes) */
  workspaceId?: string;
  /** Whether the editor is read-only */
  readOnly?: boolean;
}

/**
 * Note editor with edit/preview toggle, auto-save, and conflict detection.
 * Supports both channel notes (shared) and personal notes (private).
 */
export function NoteEditor({
  noteType,
  channelId,
  workspaceId,
  readOnly = false,
}: NoteEditorProps) {
  const { data: session } = useSession();
  const [mode, setMode] = useState<"edit" | "preview">("preview");
  const [content, setContent] = useState("");
  const [baseVersion, setBaseVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [conflict, setConflict] = useState<ConflictData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Track current content for conflict resolution
  const currentContentRef = useRef(content);
  currentContentRef.current = content;

  // Build API URL based on note type
  const getApiUrl = useCallback(() => {
    if (noteType === "channel") {
      return `/api/notes/channel?channelId=${channelId}`;
    }
    return `/api/notes/personal?workspaceId=${workspaceId}`;
  }, [noteType, channelId, workspaceId]);

  // Fetch note content on mount
  useEffect(() => {
    const fetchNote = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(getApiUrl());
        if (!response.ok) {
          throw new Error("Failed to fetch note");
        }

        const data = await response.json();
        setContent(data.content || "");
        setBaseVersion(data.version || 0);
      } catch (err) {
        console.error("Failed to fetch note:", err);
        setError("Failed to load note");
      } finally {
        setLoading(false);
      }
    };

    fetchNote();
  }, [getApiUrl]);

  // Save note to API
  const saveNote = useCallback(
    async (newContent: string, currentBaseVersion: number) => {
      setSaving(true);
      setError(null);

      try {
        const body =
          noteType === "channel"
            ? { channelId, content: newContent, baseVersion: currentBaseVersion }
            : { workspaceId, content: newContent, baseVersion: currentBaseVersion };

        const response = await fetch(
          noteType === "channel" ? "/api/notes/channel" : "/api/notes/personal",
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }
        );

        const data = await response.json();

        if (response.status === 409 && data.conflict) {
          // Version conflict detected
          setConflict(data.conflict);
          return;
        }

        if (!response.ok) {
          throw new Error(data.error || "Failed to save note");
        }

        // Success - update base version
        setBaseVersion(data.newVersion);
        setHasChanges(false);

        // Broadcast update to other users via socket
        const socket = getSocket();
        socket.emit("note:broadcast", {
          channelId: noteType === "channel" ? channelId : undefined,
          workspaceId: noteType === "personal" ? workspaceId : undefined,
          version: data.newVersion,
          userName: session?.user?.name || "Someone",
        });
      } catch (err) {
        console.error("Failed to save note:", err);
        setError("Failed to save note");
      } finally {
        setSaving(false);
      }
    },
    [noteType, channelId, workspaceId, session?.user?.name]
  );

  // Debounced auto-save (2 second delay)
  const debouncedSave = useCallback(
    debounce((newContent: string, currentBaseVersion: number) => {
      saveNote(newContent, currentBaseVersion);
    }, 2000),
    [saveNote]
  );

  // Handle content change
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setContent(newContent);
    setHasChanges(true);
    debouncedSave(newContent, baseVersion);
  };

  // Handle "Keep your version" - retry save with new base version
  const handleKeepYours = async () => {
    if (!conflict) return;

    const myContent = currentContentRef.current;
    setConflict(null);
    setBaseVersion(conflict.serverVersion);
    await saveNote(myContent, conflict.serverVersion);
  };

  // Handle "Keep their version" - reset to server content
  const handleKeepTheirs = () => {
    if (!conflict) return;

    setContent(conflict.serverContent);
    setBaseVersion(conflict.serverVersion);
    setHasChanges(false);
    setConflict(null);
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        Loading note...
      </div>
    );
  }

  // Error state
  if (error && !content && baseVersion === 0) {
    return (
      <div className="flex items-center justify-center h-full text-destructive">
        {error}
      </div>
    );
  }

  // Preview mode (or read-only)
  if (readOnly || mode === "preview") {
    return (
      <div className="flex flex-col h-full">
        {/* Header with edit button */}
        {!readOnly && (
          <div className="flex items-center justify-between p-2 border-b border-border">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMode("edit")}
              className="text-muted-foreground"
            >
              <Edit className="h-4 w-4 mr-1" />
              Edit
            </Button>
            {error && (
              <span className="text-sm text-destructive">{error}</span>
            )}
          </div>
        )}
        {/* Markdown preview */}
        <div className="flex-1 overflow-auto p-4 bg-card">
          <NoteViewer content={content} />
        </div>
      </div>
    );
  }

  // Edit mode
  return (
    <div className="flex flex-col h-full">
      {/* Header with preview button and status */}
      <div className="flex items-center justify-between p-2 border-b border-border">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setMode("preview")}
          className="text-muted-foreground"
        >
          <Eye className="h-4 w-4 mr-1" />
          Preview
        </Button>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {saving && (
            <>
              <Loader2 className="h-3 w-3 animate-spin" />
              Saving...
            </>
          )}
          {hasChanges && !saving && "Unsaved changes"}
          {error && <span className="text-destructive">{error}</span>}
        </div>
      </div>

      {/* Textarea editor */}
      <Textarea
        value={content}
        onChange={handleChange}
        placeholder="Write your note in Markdown..."
        className="flex-1 font-mono text-sm resize-none rounded-none border-0 focus-visible:ring-0 bg-card"
      />

      {/* Conflict dialog */}
      <ConflictDialog
        open={!!conflict}
        onClose={() => setConflict(null)}
        editedByName={conflict?.editedByName || "Another user"}
        onKeepYours={handleKeepYours}
        onKeepTheirs={handleKeepTheirs}
      />
    </div>
  );
}
