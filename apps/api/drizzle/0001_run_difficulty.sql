DROP INDEX "one_ranked_daily_per_player";--> statement-breakpoint
DROP INDEX "leaderboard_idx";--> statement-breakpoint
DROP INDEX "practice_board_idx";--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "difficulty" text DEFAULT 'normal' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "one_ranked_daily_per_player" ON "runs" USING btree ("player_id","daily_date","difficulty") WHERE "runs"."mode" = 'daily_ranked';--> statement-breakpoint
CREATE INDEX "leaderboard_idx" ON "runs" USING btree ("daily_date","difficulty","resolved" DESC NULLS LAST,"budget_burned_bp","mitigated_at_tick") WHERE "runs"."mode" = 'daily_ranked' and "runs"."flagged" = false;--> statement-breakpoint
CREATE INDEX "practice_board_idx" ON "runs" USING btree ("scenario_id","difficulty","player_id","resolved" DESC NULLS LAST,"budget_burned_bp","mitigated_at_tick","created_at") WHERE "runs"."mode" = 'practice' and "runs"."flagged" = false;--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_difficulty_check" CHECK ("runs"."difficulty" in ('normal', 'hard'));