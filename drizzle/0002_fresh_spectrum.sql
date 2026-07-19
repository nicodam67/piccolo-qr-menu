CREATE TABLE "admin_login_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email_normalized" varchar(320) NOT NULL,
	"ip_address" varchar(64) NOT NULL,
	"failed_attempts" integer DEFAULT 0 NOT NULL,
	"window_started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"blocked_until" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_login_attempts_email_lowercase_check" CHECK ("admin_login_attempts"."email_normalized" = lower("admin_login_attempts"."email_normalized")),
	CONSTRAINT "admin_login_attempts_failed_count_check" CHECK ("admin_login_attempts"."failed_attempts" >= 0)
);
--> statement-breakpoint
ALTER TABLE "admins" ADD COLUMN "session_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "admin_login_attempts_email_ip_uidx" ON "admin_login_attempts" USING btree ("email_normalized","ip_address");--> statement-breakpoint
CREATE INDEX "admin_login_attempts_blocked_until_idx" ON "admin_login_attempts" USING btree ("blocked_until");--> statement-breakpoint
CREATE UNIQUE INDEX "admins_email_lower_uidx" ON "admins" USING btree (lower("email"));--> statement-breakpoint
ALTER TABLE "admins" ADD CONSTRAINT "admins_email_lowercase_check" CHECK ("admins"."email" = lower("admins"."email"));--> statement-breakpoint
ALTER TABLE "admins" ADD CONSTRAINT "admins_session_version_check" CHECK ("admins"."session_version" >= 1);