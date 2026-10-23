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
      ["Pull-ups", 3, 6],
      ["Running", 3, 1],
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

test("structured lift and cardio prescriptions use their own fields", () => {
  const exercises = parseExercises(
    "lift, Back squat, 5, 5, 80, kg\ncardio, Running, 3, time, 10, min, 2\ncardio, Row, 4, distance, 500, m, 4\ncardio, Bike, 2, calories, 20, kcal, 5\nlift, Pull-ups, 3, 6, 100, % of Bodyweight\nlift, Bench press, 3, 8, 75, % of Max",
  );
  assert.equal(exercises.length, 6);
  assert.equal(exercises[1].sets, 3);
  assert.equal(exercises[1].zone, 2);
  assert.equal(exercises[2].cardioUnit, "m");
  assert.equal(exercises[3].measurement, "calories");
  assert.equal(exercises[4].unit, "BW%");
  assert.equal(exercises[5].unit, "%");
});
test("cardio validates measurement units, sets, magnitude and zones", () => {
  for (const line of [
    "cardio, Run, 0, time, 30, min, 2",
    "cardio, Run, 1, time, -1, min, 2",
    "cardio, Run, 1, time, 30, km, 2",
    "cardio, Run, 1, time, 30, min, 6",
  ])
    assert.throws(() => parseExercises(line));
  assert.equal(parseExercises("cardio, Run, time, 30, min, 2")[0].sets, 1);
});
