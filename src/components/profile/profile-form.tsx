"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AvatarUpload } from "./avatar-upload";

interface ProfileFormProps {
  profile?: {
    displayName?: string | null;
    bio?: string | null;
    avatarPath?: string | null;
  } | null;
  userName?: string | null;
  onSave: (data: { displayName: string; bio: string }) => Promise<void>;
}

export function ProfileForm({ profile, userName, onSave }: ProfileFormProps) {
  const [displayName, setDisplayName] = useState(profile?.displayName || userName || "");
  const [bio, setBio] = useState(profile?.bio || "");
  const [avatarPath, setAvatarPath] = useState(profile?.avatarPath || null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccess(false);

    try {
      await onSave({ displayName, bio });
      setSuccess(true);
      router.refresh();
    } catch (err) {
      console.error("Failed to save profile:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <AvatarUpload
        currentAvatar={avatarPath}
        onUploadComplete={(path) => {
          setAvatarPath(path);
          router.refresh();
        }}
      />

      <div className="space-y-2">
        <Label htmlFor="displayName">Display Name</Label>
        <Input
          id="displayName"
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="How should we call you?"
          maxLength={100}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="bio">Bio</Label>
        <Textarea
          id="bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="Tell us about yourself..."
          rows={3}
        />
      </div>

      <div className="flex items-center gap-4">
        <Button type="submit" disabled={loading}>
          {loading ? "Saving..." : "Save Profile"}
        </Button>
        {success && (
          <span className="text-sm text-green-600">Profile saved!</span>
        )}
      </div>
    </form>
  );
}
