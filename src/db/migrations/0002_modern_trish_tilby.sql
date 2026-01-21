CREATE TYPE "public"."scheduled_message_status" AS ENUM('pending', 'processing', 'sent', 'cancelled', 'failed');--> statement-breakpoint
CREATE TYPE "public"."reminder_pattern" AS ENUM('daily', 'weekly');--> statement-breakpoint
CREATE TYPE "public"."reminder_status" AS ENUM('pending', 'fired', 'snoozed', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."bookmark_type" AS ENUM('message', 'file');--> statement-breakpoint
CREATE TABLE "channel_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_category_collapse_states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"category_id" uuid NOT NULL,
	"is_collapsed" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "channel_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel_id" uuid NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "personal_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scheduled_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"author_id" text NOT NULL,
	"content" text NOT NULL,
	"channel_id" uuid,
	"conversation_id" uuid,
	"scheduled_for" timestamp with time zone NOT NULL,
	"status" "scheduled_message_status" DEFAULT 'pending' NOT NULL,
	"job_id" text,
	"message_id" uuid,
	"error" text,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reminders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"message_id" uuid NOT NULL,
	"note" text,
	"remind_at" timestamp with time zone NOT NULL,
	"status" "reminder_status" DEFAULT 'pending' NOT NULL,
	"recurring_pattern" "reminder_pattern",
	"job_id" text,
	"last_fired_at" timestamp with time zone,
	"snoozed_until" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bookmarks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"type" "bookmark_type" NOT NULL,
	"message_id" uuid,
	"file_id" uuid,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_statuses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"emoji" text,
	"text" text,
	"expires_at" timestamp with time zone,
	"dnd_enabled" boolean DEFAULT false NOT NULL,
	"job_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_statuses_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "link_previews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"url" text NOT NULL,
	"title" varchar(500),
	"description" text,
	"image_url" text,
	"site_name" varchar(200),
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "link_previews_url_unique" UNIQUE("url")
);
--> statement-breakpoint
CREATE TABLE "message_link_previews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid NOT NULL,
	"link_preview_id" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"hidden" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "custom_emojis" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" text NOT NULL,
	"name" varchar(64) NOT NULL,
	"filename" varchar(255) NOT NULL,
	"path" varchar(500) NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"size_bytes" integer NOT NULL,
	"is_animated" boolean DEFAULT false NOT NULL,
	"uploaded_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "channels" ADD COLUMN "is_archived" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "channels" ADD COLUMN "archived_at" timestamp;--> statement-breakpoint
ALTER TABLE "channels" ADD COLUMN "archived_by" text;--> statement-breakpoint
ALTER TABLE "channels" ADD COLUMN "category_id" uuid;--> statement-breakpoint
ALTER TABLE "channels" ADD COLUMN "sort_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "channel_categories" ADD CONSTRAINT "channel_categories_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_categories" ADD CONSTRAINT "channel_categories_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_category_collapse_states" ADD CONSTRAINT "user_category_collapse_states_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_category_collapse_states" ADD CONSTRAINT "user_category_collapse_states_category_id_channel_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."channel_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_notes" ADD CONSTRAINT "channel_notes_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_notes" ADD CONSTRAINT "channel_notes_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_notes" ADD CONSTRAINT "personal_notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_notes" ADD CONSTRAINT "personal_notes_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_messages" ADD CONSTRAINT "scheduled_messages_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_messages" ADD CONSTRAINT "scheduled_messages_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_messages" ADD CONSTRAINT "scheduled_messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_messages" ADD CONSTRAINT "scheduled_messages_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_file_id_file_attachments_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."file_attachments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_statuses" ADD CONSTRAINT "user_statuses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_link_previews" ADD CONSTRAINT "message_link_previews_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_link_previews" ADD CONSTRAINT "message_link_previews_link_preview_id_link_previews_id_fk" FOREIGN KEY ("link_preview_id") REFERENCES "public"."link_previews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_emojis" ADD CONSTRAINT "custom_emojis_workspace_id_organizations_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_emojis" ADD CONSTRAINT "custom_emojis_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "channel_categories_org_idx" ON "channel_categories" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_category_collapse_unique_idx" ON "user_category_collapse_states" USING btree ("user_id","category_id");--> statement-breakpoint
CREATE UNIQUE INDEX "channel_notes_channel_idx" ON "channel_notes" USING btree ("channel_id");--> statement-breakpoint
CREATE UNIQUE INDEX "personal_notes_user_org_idx" ON "personal_notes" USING btree ("user_id","organization_id");--> statement-breakpoint
CREATE INDEX "scheduled_messages_author_status_idx" ON "scheduled_messages" USING btree ("author_id","status");--> statement-breakpoint
CREATE INDEX "scheduled_messages_scheduled_for_idx" ON "scheduled_messages" USING btree ("scheduled_for");--> statement-breakpoint
CREATE INDEX "reminders_user_status_idx" ON "reminders" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "reminders_remind_at_idx" ON "reminders" USING btree ("remind_at");--> statement-breakpoint
CREATE UNIQUE INDEX "bookmarks_user_message_unique_idx" ON "bookmarks" USING btree ("user_id","message_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bookmarks_user_file_unique_idx" ON "bookmarks" USING btree ("user_id","file_id");--> statement-breakpoint
CREATE INDEX "bookmarks_user_idx" ON "bookmarks" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "bookmarks_user_created_idx" ON "bookmarks" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "user_statuses_user_unique_idx" ON "user_statuses" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_statuses_expires_at_idx" ON "user_statuses" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "link_previews_expires_idx" ON "link_previews" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "message_link_previews_message_idx" ON "message_link_previews" USING btree ("message_id");--> statement-breakpoint
CREATE UNIQUE INDEX "message_link_previews_unique" ON "message_link_previews" USING btree ("message_id","link_preview_id");--> statement-breakpoint
CREATE UNIQUE INDEX "custom_emojis_workspace_name_unique" ON "custom_emojis" USING btree ("workspace_id","name");--> statement-breakpoint
CREATE INDEX "custom_emojis_workspace_idx" ON "custom_emojis" USING btree ("workspace_id");--> statement-breakpoint
ALTER TABLE "channels" ADD CONSTRAINT "channels_archived_by_users_id_fk" FOREIGN KEY ("archived_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channels" ADD CONSTRAINT "channels_category_id_channel_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."channel_categories"("id") ON DELETE set null ON UPDATE no action;