CREATE TABLE "players" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_hash" text NOT NULL,
	"handle" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "players_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" uuid NOT NULL,
	"client_run_id" uuid NOT NULL,
	"scenario_id" text NOT NULL,
	"mode" text NOT NULL,
	"daily_date" date,
	"seed" bigint NOT NULL,
	"engine_version" text NOT NULL,
	"actions" jsonb NOT NULL,
	"budget_burned_bp" integer NOT NULL,
	"mitigated_at_tick" integer,
	"end_tick" integer NOT NULL,
	"resolved" boolean NOT NULL,
	"flagged" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "runs_mode_check" CHECK ("runs"."mode" in ('daily_ranked', 'practice'))
);
--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "runs_player_client_run_key" ON "runs" USING btree ("player_id","client_run_id");--> statement-breakpoint
CREATE UNIQUE INDEX "one_ranked_daily_per_player" ON "runs" USING btree ("player_id","daily_date") WHERE "runs"."mode" = 'daily_ranked';--> statement-breakpoint
CREATE INDEX "leaderboard_idx" ON "runs" USING btree ("daily_date","resolved" DESC NULLS LAST,"budget_burned_bp","mitigated_at_tick") WHERE "runs"."mode" = 'daily_ranked' and "runs"."flagged" = false;--> statement-breakpoint
CREATE INDEX "practice_board_idx" ON "runs" USING btree ("scenario_id","player_id","resolved" DESC NULLS LAST,"budget_burned_bp","mitigated_at_tick","created_at") WHERE "runs"."mode" = 'practice' and "runs"."flagged" = false;