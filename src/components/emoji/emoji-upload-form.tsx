"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, Loader2 } from "lucide-react";

interface EmojiUploadFormProps {
  workspaceId: string;
  onUploadComplete: () => void;
}

export function EmojiUploadForm({ workspaceId, onUploadComplete }: EmojiUploadFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      // Create preview URL
      setPreview(URL.createObjectURL(selectedFile));
      // Auto-generate name from filename (without extension)
      const baseName = selectedFile.name.replace(/\.[^/.]+$/, "")
        .replace(/[^a-zA-Z0-9_-]/g, "_");
      setName(baseName);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !name) return;

    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("name", name);
    formData.append("workspaceId", workspaceId);

    try {
      const res = await fetch("/api/upload/emoji", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Upload failed");
        return;
      }

      // Reset form
      setFile(null);
      setName("");
      setPreview(null);
      // Reset file input
      const fileInput = document.getElementById("emoji-file") as HTMLInputElement;
      if (fileInput) fileInput.value = "";
      onUploadComplete();
    } catch {
      setError("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex gap-4 items-start">
        {/* File input */}
        <div className="flex-1">
          <Label htmlFor="emoji-file">Image (PNG, JPG, GIF, SVG - max 128KB)</Label>
          <Input
            id="emoji-file"
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
            onChange={handleFileChange}
            className="mt-1"
          />
        </div>

        {/* Preview */}
        {preview && (
          <div className="w-16 h-16 border rounded flex items-center justify-center bg-muted">
            <img src={preview} alt="Preview" className="max-w-full max-h-full object-contain" />
          </div>
        )}
      </div>

      {/* Name input */}
      <div>
        <Label htmlFor="emoji-name">Shortcode (letters, numbers, _, -)</Label>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-muted-foreground">:</span>
          <Input
            id="emoji-name"
            value={name}
            onChange={(e) => setName(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ""))}
            placeholder="emoji_name"
            maxLength={64}
            className="flex-1"
          />
          <span className="text-muted-foreground">:</span>
        </div>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <Button type="submit" disabled={!file || !name || uploading}>
        {uploading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Uploading...
          </>
        ) : (
          <>
            <Upload className="mr-2 h-4 w-4" />
            Upload Emoji
          </>
        )}
      </Button>
    </form>
  );
}
