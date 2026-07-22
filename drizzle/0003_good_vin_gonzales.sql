ALTER TABLE "allergens" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "allergens" ADD COLUMN "sort_order" integer;--> statement-breakpoint
WITH "ordered_allergens" AS (
	SELECT "id", row_number() OVER (ORDER BY "id")::integer AS "initial_order"
	FROM "allergens"
)
UPDATE "allergens"
SET "sort_order" = "ordered_allergens"."initial_order"
FROM "ordered_allergens"
WHERE "allergens"."id" = "ordered_allergens"."id";--> statement-breakpoint
ALTER TABLE "allergens" ALTER COLUMN "sort_order" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "tags" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "tags" ADD COLUMN "sort_order" integer;--> statement-breakpoint
WITH "ordered_tags" AS (
	SELECT "id", row_number() OVER (ORDER BY "id")::integer AS "initial_order"
	FROM "tags"
)
UPDATE "tags"
SET "sort_order" = "ordered_tags"."initial_order"
FROM "ordered_tags"
WHERE "tags"."id" = "ordered_tags"."id";--> statement-breakpoint
ALTER TABLE "tags" ALTER COLUMN "sort_order" SET NOT NULL;