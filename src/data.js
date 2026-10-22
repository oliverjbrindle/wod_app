import ICAL from "ical.js";
export const localDate = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
export const uid = () => crypto.randomUUID();
// One event is one workout; each prescription line becomes a lift inside it.
export function parseExercises(description) {
  return description.split(/\r?\n/).flatMap((line) => {
    const match = line
      .trim()
      .replace(/^(?:[-*•]\s+|\d+[.)]\s+)/, "")
      .match(
        /^(.+?)\s*[:–-]?\s+(\d+)\s*[x×]\s*(\d+)\s*(?:@\s*(\d+(?:\.\d+)?)\s*(kg|lbs?|%|BW)?)?\s*$/i,
      );
    if (!match) return [];
    const sets = +match[2],
      reps = +match[3];
    if (sets < 1 || sets > 50 || reps < 1 || reps > 1000) return [];
    const unit = match[5]?.toLowerCase();
    return [
      {
        id: uid(),
        name: match[1].replace(/[:–-]$/, "").trim(),
        sets,
        reps,
        weight: match[4] || "",
        unit: unit?.startsWith("lb")
          ? "lb"
          : unit === "bw"
            ? "BW"
            : unit || "kg",
        done: [],
      },
    ];
  });
}

export function logSet(exercise, index, weight = exercise.weight) {
  if (exercise.done.includes(index)) {
    exercise.done = exercise.done.filter((n) => n !== index);
    exercise.logs = (exercise.logs || []).filter((log) => log.set !== index);
  } else {
    exercise.done.push(index);
    exercise.logs = [
      ...(exercise.logs || []).filter((log) => log.set !== index),
      {
        set: index,
        weight: String(weight),
        reps: exercise.reps,
        unit: exercise.unit,
        completedAt: new Date().toISOString(),
      },
    ];
  }
}

export function liftHistory(workouts) {
  const lifts = new Map();
  for (const workout of workouts)
    for (const exercise of workout.exercises) {
      if (!exercise.done.length) continue;
      const key = exercise.name.trim().replace(/\s+/g, " ").toLowerCase();
      if (!lifts.has(key))
        lifts.set(key, { key, name: exercise.name.trim(), entries: [] });
      for (const index of exercise.done) {
        const logged = exercise.logs?.find((log) => log.set === index);
        lifts
          .get(key)
          .entries.push({
            date: workout.date,
            title: workout.title,
            set: index + 1,
            weight: logged?.weight ?? exercise.weight,
            reps: logged?.reps ?? exercise.reps,
            unit:
              (logged?.unit ?? exercise.unit) === "lbs"
                ? "lb"
                : (logged?.unit ?? exercise.unit),
            estimated: !logged,
          });
      }
    }
  return [...lifts.values()]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((lift) => ({
      ...lift,
      entries: lift.entries.sort(
        (a, b) => b.date.localeCompare(a.date) || a.set - b.set,
      ),
    }));
}

export function importCalendar(text) {
  const root = new ICAL.Component(ICAL.parse(text));
  if (root.name !== "vcalendar")
    throw new Error("Please select a valid iCalendar (.ics) file.");
  for (const tz of root.getAllSubcomponents("vtimezone"))
    ICAL.TimezoneService.register(tz);
  const components = root.getAllSubcomponents("vevent");
  const events = components
    .filter((c) => !c.hasProperty("recurrence-id"))
    .map((c) => new ICAL.Event(c));
  for (const exception of components.filter((c) =>
    c.hasProperty("recurrence-id"),
  )) {
    const parent = events.find(
      (e) => e.uid === exception.getFirstPropertyValue("uid"),
    );
    if (parent) parent.relateException(new ICAL.Event(exception));
  }
  const workouts = [];
  let truncated = false;
  for (const event of events) {
    if (!event.startDate) continue;
    const iterator = event.iterator();
    let count = 0;
    while (count < 366 && workouts.length < 2000) {
      const next = iterator.next();
      if (!next) break;
      count++;
      const detail = event.getOccurrenceDetails(next);
      const occurrence = detail.item;
      if (occurrence.component.getFirstPropertyValue("status") === "CANCELLED")
        continue;
      const start = detail.startDate;
      // Preserve the event's calendar date, including all-day and TZID dates.
      const date = start.toString().slice(0, 10);
      const notes = occurrence.description || "";
      workouts.push({
        id: uid(),
        source: `${event.uid || event.summary}:${next.toString()}`,
        date,
        title: occurrence.summary || "Imported workout",
        notes,
        exercises: parseExercises(notes),
        finished: false,
      });
      if (!event.isRecurring()) break;
    }
    if (count === 366 || workouts.length === 2000) truncated = true;
  }
  return { workouts, truncated };
}
export function mergeWorkouts(existing, incoming) {
  const seen = new Set(existing.map((w) => w.source).filter(Boolean));
  return [
    ...existing,
    ...incoming.filter((w) => {
      if (seen.has(w.source)) return false;
      seen.add(w.source);
      return true;
    }),
  ];
}
export function progress(workout) {
  const total = workout.exercises.reduce((n, e) => n + e.sets, 0);
  const done = workout.exercises.reduce(
    (n, e) => n + e.done.filter((s) => s >= 0 && s < e.sets).length,
    0,
  );
  return { total, done, percent: total ? Math.round((done / total) * 100) : 0 };
}
