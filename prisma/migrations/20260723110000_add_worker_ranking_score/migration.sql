ALTER TABLE "worker_profiles" ADD COLUMN "rankingScore" DECIMAL(3,2) NOT NULL DEFAULT 0;

-- Backfill: workers with enough reviews get their real average as ranking score.
UPDATE "worker_profiles" SET "rankingScore" = "averageRating" WHERE "totalReviews" >= 3;

DROP INDEX IF EXISTS "worker_profiles_averageRating_idx";

CREATE INDEX "worker_profiles_rankingScore_idx" ON "worker_profiles"("rankingScore");
