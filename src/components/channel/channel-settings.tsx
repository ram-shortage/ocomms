"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { updateChannelDescription, archiveChannel, unarchiveChannel } from "@/lib/actions/channel";

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
    slug: string;
    description: string | null;
    isPrivate: boolean;
    isArchived: boolean;
  };
  members: ChannelMember[];
  workspaceSlug: string;
}

export function ChannelSettings({ channel, members, workspaceSlug }: ChannelSettingsProps) {
  const router = useRouter();
  const [description, setDescription] = useState(channel.description || "");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [archiving, setArchiving] = useState(false);
  const [archiveError, setArchiveError] = useState("");

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

  const handleArchive = async () => {
    setArchiving(true);
    setArchiveError("");
    try {
      await archiveChannel(channel.id);
      router.push(`/${workspaceSlug}`);
      router.refresh();
    } catch (err) {
      setArchiveError(err instanceof Error ? err.message : "Failed to archive channel");
      setArchiving(false);
    }
  };

  const handleUnarchive = async () => {
    setArchiving(true);
    setArchiveError("");
    try {
      await unarchiveChannel(channel.id);
      router.refresh();
    } catch (err) {
      setArchiveError(err instanceof Error ? err.message : "Failed to unarchive channel");
    } finally {
      setArchiving(false);
    }
  };

  // Check if this is the default channel (cannot be archived)
  const isDefaultChannel = channel.slug === "general";

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
                  <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded">
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

      {/* Archive section */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Channel Archive</h2>
        <div className="space-y-4">
          {channel.isArchived ? (
            <>
              <p className="text-sm text-muted-foreground">
                This channel is archived. Messages are read-only. Unarchive to allow new messages.
              </p>
              <Button
                variant="outline"
                onClick={handleUnarchive}
                disabled={archiving}
              >
                <ArchiveRestore className="h-4 w-4 mr-2" />
                {archiving ? "Unarchiving..." : "Unarchive Channel"}
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Archiving a channel makes it read-only. Members can view messages but cannot send new ones.
                The channel will be moved to the Archived section in the sidebar.
              </p>
              {isDefaultChannel ? (
                <p className="text-sm text-amber-600">
                  The default channel (#general) cannot be archived.
                </p>
              ) : (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" disabled={archiving}>
                      <Archive className="h-4 w-4 mr-2" />
                      Archive Channel
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Archive #{channel.name}?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will make the channel read-only. Members will still be able to view
                        messages, but no one will be able to send new messages. You can unarchive
                        the channel later to restore normal operation.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleArchive} disabled={archiving}>
                        {archiving ? "Archiving..." : "Archive Channel"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </>
          )}
          {archiveError && (
            <p className="text-sm text-red-600">{archiveError}</p>
          )}
        </div>
      </section>
    </div>
  );
}
