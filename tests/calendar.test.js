import { test } from "node:test";
import assert from "node:assert/strict";
import {
  importCalendar,
  mergeWorkouts,
  progress,
  parseExercises,
} from "../src/data.js";
const calendar = (body) =>
  `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//FORM tests//EN\r\n${body}\r\nEND:VCALENDAR`;
const event = (extra = "") =>
  `BEGIN:VEVENT\r\nUID:training-1\r\nDTSTART;VALUE=DATE:20261022\r\nSUMMARY:Leg day\r\nDESCRIPTION:Back squat 5x5 @ 80kg\\nRest two minutes\r\n${extra}END:VEVENT`;
test("imports calendar date and structured exercises while retaining notes", () => {
  const { workouts } = importCalendar(calendar(event()));
  assert.equal(workouts.length, 1);
  assert.equal(workouts[0].date, "2026-10-22");
  assert.equal(workouts[0].exercises[0].name, "Back squat");
  assert.equal(workouts[0].exercises[0].weight, "80");
  assert.match(workouts[0].notes, /Rest two minutes/);
});
test("expands recurrence and excludes EXDATE", () => {
  const { workouts } = importCalendar(
    calendar(
      event("RRULE:FREQ=DAILY;COUNT=3\r\nEXDATE;VALUE=DATE:20261023\r\n"),
    ),
  );
  assert.deepEqual(
    workouts.map((w) => w.date),
    ["2026-10-22", "2026-10-24"],
  );
});
test("deduplicates reimport and preserves completed sets", () => {
  const first = importCalendar(calendar(event())).workouts;
  first[0].exercises[0].done = [0];
  const merged = mergeWorkouts(
    first,
    importCalendar(calendar(event())).workouts,
  );
  assert.equal(merged.length, 1);
  assert.equal(progress(merged[0]).done, 1);
});
test("handles folded lines and escaped content as text", () => {
  const { workouts } = importCalendar(
    calendar(event().replace("Leg day", "Leg day with a very long\r\n  name")),
  );
  assert.equal(workouts[0].title, "Leg day with a very long name");
});
test("caps unbounded recurring imports", () => {
  const result = importCalendar(calendar(event("RRULE:FREQ=WEEKLY\r\n")));
  assert.equal(result.workouts.length, 366);
  assert.equal(result.truncated, true);
});
test("rejects non calendar input", () =>
  assert.throws(() => importCalendar("not an ics")));
test("recognizes bodyweight prescriptions without inventing weights", () => {
  assert.equal(parseExercises("Push-ups 3x12")[0].weight, "");
  assert.equal(parseExercises("Warm up for 10 minutes").length, 0);
});
test("recurrence exceptions replace original event", () => {
  const exception = `BEGIN:VEVENT\r\nUID:training-1\r\nRECURRENCE-ID;VALUE=DATE:20261023\r\nDTSTART;VALUE=DATE:20261024\r\nSUMMARY:Moved workout\r\nEND:VEVENT`;
  const { workouts } = importCalendar(
    calendar(event("RRULE:FREQ=DAILY;COUNT=2\r\n") + "\r\n" + exception),
  );
  assert.deepEqual(
    workouts.map((w) => w.date),
    ["2026-10-22", "2026-10-24"],
  );
  assert.equal(workouts[1].title, "Moved workout");
});

test("complete workout template imports all lifts into a single session", async () => {
  const { readFile } = await import("node:fs/promises");
  const result = importCalendar(
    await readFile(
      new URL("../public/workout-template.ics", import.meta.url),
      "utf8",
    ),
  );
  assert.equal(result.workouts.length, 1);
  assert.equal(result.workouts[0].title, "Full body strength");
  assert.equal(result.workouts[0].exercises.length, 4);
  assert.deepEqual(
    result.workouts[0].exercises.map((e) => [e.name, e.sets, e.reps]),
    [
      ["Back squat", 5, 5],
      ["Bench press", 3, 8],
      ["Romanian deadlift", 3, 10],
      ["Pull-ups", 3, 6],
    ],
  );
});
test("supports bullets and rejects out-of-range prescriptions", () => {
  assert.equal(
    parseExercises("- Back squat: 5x5 @ 80kg")[0].name,
    "Back squat",
  );
  assert.equal(parseExercises("1. Bench press 3x8 @ 135lbs")[0].unit, "lb");
  assert.equal(parseExercises("Squat 500x5").length, 0);
});
