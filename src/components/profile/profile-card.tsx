import Image from "next/image";

interface ProfileCardProps {
  displayName?: string | null;
  email: string;
  avatarPath?: string | null;
  bio?: string | null;
  role?: string;
}

export function ProfileCard({
  displayName,
  email,
  avatarPath,
  bio,
  role,
}: ProfileCardProps) {
  return (
    <div className="bg-card border rounded-lg p-6">
      <div className="flex items-start space-x-4">
        <div className="relative w-20 h-20 rounded-full overflow-hidden bg-muted flex-shrink-0">
          {avatarPath ? (
            <Image
              src={avatarPath}
              alt={displayName || email}
              fill
              className="object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              <svg
                className="w-10 h-10"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
              </svg>
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-semibold truncate">
            {displayName || email}
          </h2>
          <p className="text-sm text-muted-foreground">{email}</p>
          {role && (
            <span className="inline-block mt-1 px-2 py-0.5 text-xs bg-muted rounded capitalize">
              {role}
            </span>
          )}
          {bio && <p className="mt-3 text-foreground">{bio}</p>}
        </div>
      </div>
    </div>
  );
}
