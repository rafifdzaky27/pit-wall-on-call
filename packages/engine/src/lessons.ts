import type { LessonDef, RunResult, ScenarioDef, State } from "./types";

export function pickLesson<S extends State>(scenario: ScenarioDef<S>, result: RunResult): LessonDef {
  const lesson = scenario.lessons.find((l) => l.when(result));
  if (!lesson) throw new Error(`${scenario.id}: no lesson matches this run; make the last lesson a catch-all`);
  return lesson;
}
