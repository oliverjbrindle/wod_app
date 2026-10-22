import { test } from "node:test";
import assert from "node:assert/strict";
import { logSet, liftHistory } from "../src/data.js";
const exercise = () => ({
  id: "squat",
  name: "Back squat",
  sets: 3,
  reps: 5,
  weight: "80",
  unit: "kg",
  done: [],
});
const workout = (e) => ({
  date: "2026-10-22",
  title: "Strength",
  exercises: [e],
});
test("only completed sets enter history, using actual weight and a frozen prescription", () => {
  const e = exercise();
  assert.equal(liftHistory([workout(e)]).length, 0);
  logSet(e, 0, "82.5");
  e.weight = "90";
  e.reps = 3;
  const entry = liftHistory([workout(e)])[0].entries[0];
  assert.equal(entry.weight, "82.5");
  assert.equal(entry.reps, 5);
  assert.equal(entry.estimated, false);
});
test("undo removes log and re-completion records a new snapshot", () => {
  const e = exercise();
  logSet(e, 0);
  logSet(e, 0);
  assert.equal(liftHistory([workout(e)]).length, 0);
  logSet(e, 0, "85");
  assert.equal(e.logs.length, 1);
  assert.equal(e.logs[0].weight, "85");
});
test("legacy sets remain visible and names normalize while units stay separate", () => {
  const e = exercise();
  e.done = [0];
  const second = {
    ...exercise(),
    name: " back   SQUAT ",
    unit: "lb",
    weight: "185",
    done: [],
  };
  logSet(second, 0);
  const lifts = liftHistory([
    workout(e),
    { ...workout(second), date: "2026-10-23" },
  ]);
  assert.equal(lifts.length, 1);
  assert.equal(lifts[0].entries[0].unit, "lb");
  assert.equal(lifts[0].entries[1].estimated, true);
});
