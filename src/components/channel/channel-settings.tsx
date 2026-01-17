"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { updateChannelDescription } from "@/lib/actions/channel";

interface ChannelMember {
  id: string;
  name: string;
  email: string;
  image: string | null;
  role: string;
}

interface ChannelSettingsProps {
  channel: {
    id: string;
    name: string;
    description: string | null;
    isPrivate: boolean;
  };
  members: ChannelMember[];
}

export function ChannelSettings({ channel, members }: ChannelSettingsProps) {
  const router = useRouter();
  const [description, setDescription] = useState(channel.description || "");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSaveDescription = async () => {
    setSaving(true);
    setError("");
    setSuccess(false);

    try {
      await updateChannelDescription(channel.id, description);
      setSuccess(true);
      router.refresh();
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update description");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Description section */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Description</h2>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="description">Channel Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what this channel is about..."
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              The description helps members understand the purpose of this channel.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={handleSaveDescription}
              disabled={saving || description === (channel.description || "")}
            >
              {saving ? "Saving..." : "Save Description"}
            </Button>
            {success && (
              <span className="text-sm text-green-600">Description updated!</span>
            )}
            {error && (
              <span className="text-sm text-red-600">{error}</span>
            )}
          </div>
        </div>
      </section>

      {/* Members section */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Members</h2>
        <div className="border rounded-lg divide-y">
          {members.map((member) => (
            <div
              key={member.id}
              className="flex items-center gap-3 p-3"
            >
              <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium shrink-0">
                {member.image ? (
                  <img
                    src={member.image}
                    alt={member.name}
                    className="h-8 w-8 rounded-full object-cover"
                  />
                ) : (
                  member.name.charAt(0).toUpperCase()
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{member.name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {member.email}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {member.role === "admin" ? (
                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                    Admin
                  </span>
                ) : (
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                    Member
                  </span>
                )}
                {/* Role management placeholder - future feature */}
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Role management coming soon.
        </p>
      </section>
    </div>
  );
}
