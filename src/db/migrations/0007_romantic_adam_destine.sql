ALTER TABLE "organizations" ADD COLUMN "join_policy" text DEFAULT 'invite_only' NOT NULL;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "description" text;