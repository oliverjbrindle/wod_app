import "./style.css";
import {
  localDate,
  uid,
  importCalendar,
  mergeWorkouts,
  progress,
  logSet,
  liftHistory,
  isCardio,
  unitLabel,
  cardioUnits,
  migrateExercises,
} from "./data.js";
const KEY = "form.workouts.v1";
let state = { workouts: [], active: null };
let storageError = "";
try {
  const saved = JSON.parse(localStorage.getItem(KEY) || "null");
  if (saved) {
    validateBackup(saved);
    state = migrateExercises(saved);
  }
} catch {
  storageError =
    "Saved data could not be read. Export a backup before making changes.";
}
let selected = localDate(),
  month = new Date(`${selected}T12:00:00`),
  view = "calendar",
  filter = "all",
  historyLift = "";
const app = document.querySelector("#app");
const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const nice = (date, options = { month: "long", day: "numeric" }) =>
  new Date(`${date}T12:00:00`).toLocaleDateString(undefined, options);
function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    storageError = "";
    return true;
  } catch {
    storageError =
      "Device storage is full or unavailable. Changes are only in memory. Export a backup now.";
    return false;
  }
}
function toast(message) {
  const t = document.querySelector("#toast");
  t.textContent = message;
  t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (t.hidden = true), 6500);
}
function render() {
  const upcoming = state.workouts.filter(
    (w) => w.date >= localDate() && !w.finished,
  ).length;
  app.innerHTML = `<aside class="sidebar"><a class="brand" href="#">stack<span class="brand-mark"> days</span></a><div class="workspace-label">YOUR TRAINING SPACE</div><nav><button data-view="calendar" class="${view === "calendar" ? "selected" : ""}"><span>▦</span> Workout calendar</button><button data-view="active" class="${view === "active" ? "selected" : ""}"><span>◉</span> Active workout ${state.active ? '<i class="live-dot"></i>' : ""}</button><button data-view="history" class="${view === "history" ? "selected" : ""}"><span aria-hidden="true"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 4v16h16M7 15l4-5 4 2 5-7"/></svg></span> Lift history</button><button data-view="settings" class="${view === "settings" ? "selected" : ""}"><span>⚙</span> App & data</button></nav><div class="sidebar-bottom"><span class="privacy-icon">⌁</span><strong>Just you. Your progress.</strong><p>Stored on your device.<br>No account. No distractions.</p><span class="local-badge">● LOCAL FIRST</span></div></aside><main><header><span>TRAIN WITH INTENTION</span><div class="header-right"><span class="status-dot"></span> ${navigator.onLine ? "On-device storage" : "Offline · on-device storage"}<div class="avatar">YOU</div></div></header>${storageError ? `<div class="warning" role="alert">${esc(storageError)}</div>` : ""}<div class="page">${view === "calendar" ? calendar(upcoming) : view === "active" ? active() : view === "history" ? history() : settings()}</div><footer>STACK DAYS <span>Small steps. Stronger every day.</span><span>YOUR TRAINING, IN FOCUS.</span></footer></main><div id="toast" role="status" hidden></div><dialog id="editor"></dialog><input type="file" id="ics-file" accept=".ics,text/calendar" hidden><input type="file" id="backup-file" accept=".json,application/json" hidden>`;
  bind();
}
function calendar(upcoming) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1),
    offset = (first.getDay() + 6) % 7,
    last = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const days = Array.from(
    { length: Math.ceil((offset + last) / 7) * 7 },
    (_, i) => {
      const day = new Date(
          month.getFullYear(),
          month.getMonth(),
          i - offset + 1,
        ),
        date = localDate(day),
        ws = state.workouts.filter((w) => w.date === date);
      return `<button class="day ${day.getMonth() !== month.getMonth() ? "muted" : ""} ${date === selected ? "chosen" : ""}" data-date="${date}" aria-label="${nice(date, { month: "long", day: "numeric", year: "numeric" })}, ${ws.length} workouts" aria-pressed="${date === selected}"><span class="${date === localDate() ? "today" : ""}">${day.getDate()}</span><div class="day-events">${ws
        .slice(0, 2)
        .map(
          (w) =>
            `<span class="event ${w.finished ? "complete" : ""}">${w.finished ? "✓ " : ""}${esc(w.title)}</span>`,
        )
        .join(
          "",
        )}${ws.length > 2 ? `<small>+${ws.length - 2} more</small>` : ""}</div>${ws.length ? '<i class="mobile-dot"></i>' : ""}</button>`;
    },
  ).join("");
  const ws = state.workouts.filter(
    (w) => w.date === selected && (filter !== "pending" || !w.finished),
  );
  return `<div class="page-heading"><div><div class="eyebrow">THE WORK STARTS HERE</div><h1>Your workout calendar<span>.</span></h1><p>A plan to follow. Progress to make. One session at a time.</p></div><button class="primary" id="import"><span aria-hidden="true">↑</span> <span>Import calendar</span></button></div><div class="overview"><div><span class="metric-icon">▦</span><div><strong>${upcoming}</strong><span>Upcoming sessions</span></div></div><div><span class="metric-icon">✓</span><div><strong>${state.workouts.filter((w) => w.finished).length}</strong><span>Sessions completed</span></div></div><div class="overview-note"><span>↗</span><p>Consistency builds strength.<br><strong>Make time for your next session.</strong></p></div></div><div class="calendar-layout"><section class="calendar-panel"><div class="calendar-toolbar"><h2>${month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</h2><div><button class="text-button" id="today">Today</button><button class="arrow" id="prev" aria-label="Previous month">‹</button><button class="arrow" id="next" aria-label="Next month">›</button></div></div><div class="weekdays">${["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].map((d) => `<span>${d}</span>`).join("")}</div><div class="calendar-grid">${days}</div><div class="calendar-legend"><span><i></i> Scheduled session</span><span><i></i> Completed</span></div></section><section class="sessions"><div class="session-heading"><div class="eyebrow">YOUR SESSIONS</div><h2>${nice(selected, { weekday: "short", month: "short", day: "numeric" })}</h2><span>${selected === localDate() ? "TODAY" : "SELECTED DAY"}</span></div><div class="tabs"><button data-filter="all" class="${filter === "all" ? "current" : ""}">All sessions</button><button data-filter="pending" class="${filter === "pending" ? "current" : ""}">To do</button></div><div class="session-list">${ws.length ? ws.map((w) => sessionCard(w)).join("") : `<div class="empty"><div class="empty-icon">＋</div><h3>A little room for progress.</h3><p>Schedule a session for this day<br>or import your training calendar.</p></div>`}</div><button class="add-session" id="new">＋ Schedule a workout</button><div class="tip"><span>✧</span><p><strong>Your programming, all in one place.</strong>Import an .ics file from your calendar to bring your sessions into focus.</p></div></section></div>`;
}
function sessionCard(w) {
  const p = progress(w);
  return `<article class="session-card"><div class="card-top"><span class="tag">${w.finished ? "COMPLETED" : "STRENGTH & CONDITIONING"}</span><button class="icon-button" data-edit="${w.id}" aria-label="Edit ${esc(w.title)}">✎</button></div><h3>${esc(w.title)}</h3><p>${w.exercises.length} exercises <span>·</span> ${p.total} ${w.exercises.some(isCardio) ? "steps" : "sets"} ${p.done ? `<span>·</span> ${p.done} done` : ""}</p><div class="exercise-preview">${
    w.exercises
      .slice(0, 3)
      .map(
        (e) =>
          `<div><span>${esc(e.name)}</span><strong>${isCardio(e) ? `${e.sets} × ${e.magnitude} ${esc(e.cardioUnit)} · Zone ${e.zone}` : `${e.sets} × ${e.reps} <small>${esc(e.weight)} ${e.weight ? esc(unitLabel(e.unit)) : ""}</small>`}</strong></div>`,
      )
      .join("") || "<span>Add exercises to start tracking sets.</span>"
  }</div><button class="${w.finished ? "secondary" : "primary"} full" data-start="${w.id}">${w.finished ? "Review workout" : state.active === w.id ? "Resume workout →" : "Start workout →"}</button></article>`;
}
function exerciseSummary(e) {
  return isCardio(e)
    ? `${e.sets} sets × ${e.magnitude} ${esc(e.cardioUnit)} · ${esc(e.measurement)} · Zone ${e.zone}`
    : `${e.sets} sets × ${e.reps} reps ${e.weight ? `@ ${esc(e.weight)} ${esc(unitLabel(e.unit))}` : ""}`;
}
function focusExercise(e) {
  if (isCardio(e))
    return `<div class="prescription"><div><strong>${e.magnitude}</strong><span>${esc(e.cardioUnit)} · ${esc(e.measurement)}</span></div><div><strong>${e.zone}</strong><span>HEART RATE ZONE</span></div><div><strong>${e.done.length + 1}<small> / ${e.sets}</small></strong><span>SET</span></div></div><button class="accent full" aria-label="Complete cardio" data-complete="${e.id}">✓ Complete cardio</button>`;
  return `<div class="prescription"><div><strong>${esc(e.weight) || "—"}</strong><span>${esc(unitLabel(e.unit))}</span></div><div><strong>${e.reps}</strong><span>REPS</span></div><div><strong>${e.done.length + 1}<small> / ${e.sets}</small></strong><span>SET</span></div></div><label class="actual-weight">${e.unit === "BW%" ? "Bodyweight percentage" : e.unit === "%" ? "% of Max for this set" : "Weight for this set"} (${esc(unitLabel(e.unit))})<input id="actual-weight" type="number" min="0" step="0.01" value="${esc(e.weight)}" placeholder="Unweighted"></label><button class="accent full" aria-label="Complete set" data-complete="${e.id}">✓ Complete set</button>`;
}
function active() {
  const w = state.workouts.find((w) => w.id === state.active);
  if (!w)
    return `<div class="page-heading"><div><div class="eyebrow">ONE STEP AT A TIME</div><h1>Stay in your rhythm<span>.</span></h1><p>Your current exercise and progress, right here.</p></div></div><div class="large-empty"><h2>Ready when you are.</h2><p>Choose a scheduled workout to begin your session.</p><button class="primary" data-view="calendar">Go to calendar →</button></div>`;
  const p = progress(w),
    current = w.exercises.find((e) => e.done.length < e.sets),
    label = w.exercises.some(isCardio) ? "steps" : "sets";
  return `<div class="page-heading"><div><div class="eyebrow">${w.finished ? "SESSION COMPLETE" : "ACTIVE SESSION"} · ${nice(w.date)}</div><h1>${esc(w.title)}<span>.</span></h1><p>${w.finished ? "A little stronger than yesterday." : "Focus on this exercise. The next one can wait."}</p></div><button class="secondary" data-edit="${w.id}">Edit session</button></div><div class="workout-layout"><section><div class="focus-card"><div class="eyebrow">${current ? (isCardio(current) ? "CURRENT CARDIO" : "CURRENT LIFT") : "ALL EXERCISES COMPLETE"}</div><h2>${current ? esc(current.name) : "Good work."}</h2>${current ? focusExercise(current) : `<p>${p.total ? "Every prescribed exercise is logged." : "Add exercises to track your session."}</p>`}<p class="save-note">Progress saves automatically on this device.</p></div><div class="exercise-list">${w.exercises.map((e, i) => `<article class="lift-row"><div class="lift-heading"><span class="lift-number">${String(i + 1).padStart(2, "0")}</span><div><h3>${esc(e.name)}</h3><p>${exerciseSummary(e)}</p></div></div><div class="set-buttons">${Array.from({ length: e.sets }, (_, n) => `<button data-set="${e.id}" data-index="${n}" class="${e.done.includes(n) ? "done" : ""}" aria-pressed="${e.done.includes(n)}" aria-label="${esc(e.name)}, ${isCardio(e) ? "cardio set " + (n + 1) : "set " + (n + 1)}${e.done.includes(n) ? ", completed" : ""}">${e.done.includes(n) ? "✓" : isCardio(e) ? "Cardio set " + (n + 1) : n + 1}</button>`).join("")}</div></article>`).join("")}</div></section><aside class="workout-summary"><div class="eyebrow">SESSION PROGRESS</div><div class="progress-number">${p.percent}<span>%</span></div><div class="progress-bar"><i style="width:${p.percent}%"></i></div><p>${p.done} of ${p.total} ${label} completed</p><button class="primary full" id="finish" ${!p.total || p.done !== p.total || w.finished ? "disabled" : ""}>${w.finished ? "Session completed ✓" : "Finish workout"}</button>${w.notes ? `<h3>Programming notes</h3><p class="notes">${esc(w.notes)}</p>` : ""}<div class="tip"><p>Keep Stack Days open to track exercises. iPhone Live Activities and Dynamic Island require a native iOS app.</p></div></aside></div>`;
}
function history() {
  const lifts = liftHistory(state.workouts);
  const lift = lifts.find((l) => l.key === historyLift) || lifts[0];
  const stats = lift
    ? [
        ...new Set(
          lift.entries
            .filter((e) => e.weight !== "" && Number.isFinite(+e.weight))
            .map((e) => e.unit),
        ),
      ].map((unit) => ({
        unit,
        best: Math.max(
          ...lift.entries
            .filter((e) => e.unit === unit && e.weight !== "")
            .map((e) => +e.weight),
        ),
      }))
    : [];
  return `<div class="page-heading"><div><div class="eyebrow">BUILD ON WHAT YOU HAVE DONE</div><h1>Lift history<span>.</span></h1><p>Your logged weights, reps, and completed sets for every lift.</p></div></div>${!lift ? `<div class="large-empty"><div class="empty-icon">↗</div><h2>Your next set starts your story.</h2><p>Complete a set in an active workout to see your lift history here.</p><button class="primary" data-view="calendar">Go to calendar →</button></div>` : `<section class="history-panel"><label>Lift<select id="history-lift">${lifts.map((l) => `<option value="${esc(l.key)}" ${l.key === lift.key ? "selected" : ""}>${esc(l.name)}</option>`).join("")}</select></label><div class="history-summary"><div><span>COMPLETED SETS</span><strong>${lift.entries.length}</strong></div>${stats.map((stat) => `<div><span>HEAVIEST · ${esc(unitLabel(stat.unit))}</span><strong>${stat.best} <small>${esc(unitLabel(stat.unit))}</small></strong></div>`).join("")}</div><div class="table-scroll"><table><caption>${esc(lift.name)} — completed set history</caption><thead><tr><th scope="col">Date / workout</th><th scope="col">Set</th><th scope="col">Weight</th><th scope="col">Reps</th></tr></thead><tbody>${lift.entries.map((e) => `<tr><td><strong>${nice(e.date, { month: "short", day: "numeric", year: "numeric" })}</strong><span>${esc(e.title)}</span></td><td>${e.set}</td><td>${e.weight !== "" ? `${esc(e.weight)} ${esc(unitLabel(e.unit))}` : "Unweighted"}${e.estimated ? " *" : ""}</td><td>${e.reps}</td></tr>`).join("")}</tbody></table></div><p class="history-note">Only completed sets appear here. Weights stay in their recorded units. * Older sets use their workout prescription because no set-level weight was saved. Deleting a workout also removes its history.</p></section>`}`;
}
function settings() {
  return `<div class="page-heading"><div><div class="eyebrow">BUILT AROUND YOU</div><h1>Your app. Your data<span>.</span></h1><p>Private by design. Keep a copy of what matters.</p></div></div><section class="settings-card"><h2>Back up your training</h2><p>Workouts and set progress stay in this browser. Clearing site data or removing the app can erase them. Export regular backups.</p><button class="primary" id="export">↓ Export backup</button> <button class="secondary" id="restore">↥ Restore backup</button></section><section class="settings-card"><h2>Install & train offline</h2><p>On iPhone, open this site in Safari, tap Share, then Add to Home Screen. On Android or desktop, use your browser’s Install app option. Installation requires HTTPS (or localhost during development). Open the app online once before training offline.</p><p>Lock Screen Live Activities, interactive lock screen buttons, and Dynamic Island require a native iOS companion app using ActivityKit. They cannot run in a PWA.</p></section><section class="settings-card"><h2>Import your programming</h2><p>Create one calendar event per complete workout. Put the workout name in the title and every exercise on its own description line, then export an .ics file. Event titles, calendar dates and descriptions are preserved. Use <code>lift, Back squat, 5, 5, 80, kg</code> or <code>cardio, Running, 3, time, 10, min, 2</code>. Cardio measurements: time (min/sec/hr), distance (km/m/mi), calories (kcal). Zones: 1–5. Lift units: kg, lb, % of Max, % of Bodyweight. Older lift notation is still supported. Recurring events are expanded up to 366 occurrences per series and 2,000 sessions per file. Re-importing skips matching events; it does not overwrite your edits.</p><p><a href="/workout-template.ics" download>Download a complete workout calendar template (.ics)</a></p><p>Calendar dates follow the event’s original timezone. Times and reminders are not scheduled. Import explicit calendar exports; external subscription URLs are not fetched.</p></section>`;
}
function editor(id) {
  const w = state.workouts.find((w) => w.id === id) || {
    id: uid(),
    title: "",
    date: selected,
    notes: "",
    exercises: [],
    finished: false,
  };
  const dialog = document.querySelector("#editor");
  dialog.innerHTML = `<form id="workout-form"><div class="dialog-top"><h2>${id ? "Edit" : "Schedule"} workout</h2><button type="button" id="close-editor" class="icon-button" aria-label="Close editor">✕</button></div><label>Session name<input name="title" required maxlength="150" placeholder="e.g. Lower body strength" value="${esc(w.title)}"></label><label>Date<input name="date" type="date" required value="${w.date}"></label><div class="editor-exercise-heading"><h3>Exercise programming</h3><button type="button" id="add-exercise" class="text-button">＋ Add exercise</button></div><div id="exercise-fields"></div><label>Programming notes<textarea name="notes" rows="4" placeholder="Warm-up, tempo, rest, or your original programming…">${esc(w.notes)}</textarea></label><div class="dialog-actions">${id ? '<button type="button" class="danger" id="delete">Delete</button>' : ""}<button type="button" class="secondary" id="cancel">Cancel</button><button class="primary" type="submit">Save workout</button></div></form>`;
  const fields = dialog.querySelector("#exercise-fields");
  function add(
    e = {
      id: uid(),
      name: "",
      sets: 3,
      reps: 5,
      weight: "",
      unit: "kg",
      done: [],
    },
  ) {
    const row = document.createElement("div");
    row.className = "exercise-fields";
    row.dataset.id = e.id;
    row.classList.add("typed-exercise");
    const draft = { type: e.type || "lift", ...e };
    function draw() {
      const options = (values, value) =>
        values
          .map(
            ([v, label]) =>
              `<option value="${v}" ${v === value ? "selected" : ""}>${label}</option>`,
          )
          .join("");
      row.innerHTML = `<label class="exercise-type">Exercise type<select data-field="type">${options(
        [
          ["lift", "Lift"],
          ["cardio", "Cardio"],
        ],
        draft.type,
      )}</select></label><label class="exercise-name">Exercise<input data-field="name" required maxlength="100" value="${esc(draft.name)}" placeholder="${draft.type === "cardio" ? "Running" : "Back squat"}"></label>${
        draft.type === "cardio"
          ? `<label>Sets<input data-field="sets" type="number" min="1" max="50" required value="${draft.sets}"></label><label>Measurement<select data-field="measurement">${options(
              [
                ["time", "Time"],
                ["distance", "Distance"],
                ["calories", "Calories"],
              ],
              draft.measurement || "time",
            )}</select></label><label>Target<input data-field="magnitude" type="number" min="0.01" step="0.01" required value="${draft.magnitude || ""}"></label><label>Unit<select data-field="cardioUnit">${options(
              cardioUnits[draft.measurement || "time"].map((u) => [u, u]),
              draft.cardioUnit,
            )}</select></label><label>Heart rate zone<select data-field="zone">${options(
              [1, 2, 3, 4, 5].map((n) => [String(n), String(n)]),
              String(draft.zone || 2),
            )}</select></label>`
          : `<label>Sets<input data-field="sets" type="number" min="1" max="50" required value="${draft.sets}"></label><label>Reps<input data-field="reps" type="number" min="1" max="1000" required value="${draft.reps}"></label><label>${draft.unit === "BW%" ? "Bodyweight %" : draft.unit === "%" ? "% of Max" : "Weight"}<input data-field="weight" type="number" min="0" step="0.01" value="${esc(draft.weight)}"></label><label>Unit<select data-field="unit">${options(
              [
                ["kg", "kg"],
                ["lb", "lb"],
                ["%", "% of Max"],
                ["BW%", "% of Bodyweight"],
              ],
              draft.unit,
            )}</select></label>`
      }<button type="button" class="icon-button remove" aria-label="Remove exercise">✕</button>`;
      for (const control of row.querySelectorAll("[data-field]"))
        control.onchange = () => {
          for (const field of row.querySelectorAll("[data-field]"))
            draft[field.dataset.field] = field.value;
          if (control.dataset.field === "measurement")
            draft.cardioUnit = cardioUnits[draft.measurement][0];
          if (["type", "measurement", "unit"].includes(control.dataset.field))
            draw();
        };
      row.querySelector(".remove").onclick = () => row.remove();
    }
    draw();
    fields.append(row);
  }
  w.exercises.forEach(add);
  dialog.querySelector("#add-exercise").onclick = () => add();
  dialog.querySelector("#close-editor").onclick = dialog.querySelector(
    "#cancel",
  ).onclick = () => dialog.close();
  if (id)
    dialog.querySelector("#delete").onclick = () => {
      if (confirm("Delete this workout and its set history?")) {
        state.workouts = state.workouts.filter((x) => x.id !== id);
        if (state.active === id) state.active = null;
        persist();
        dialog.close();
        render();
      }
    };
  dialog.querySelector("form").onsubmit = (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    const exercises = [...fields.children].map((row) => {
      const get = (f) => row.querySelector(`[data-field="${f}"]`).value;
      const old = w.exercises.find((x) => x.id === row.dataset.id);
      const type = get("type"),
        sameType = old && (old.type || "lift") === type;
      const sets = +get("sets");
      const base = {
        id: row.dataset.id,
        type,
        name: get("name").trim(),
        sets,
        done: sameType ? (old.done || []).filter((n) => n < sets) : [],
        logs: sameType ? (old.logs || []).filter((log) => log.set < sets) : [],
      };
      return type === "cardio"
        ? {
            ...base,
            measurement: get("measurement"),
            magnitude: +get("magnitude"),
            cardioUnit: get("cardioUnit"),
            zone: +get("zone"),
            reps: 1,
            weight: "",
            unit: "kg",
          }
        : {
            ...base,
            reps: +get("reps"),
            weight: get("weight"),
            unit: get("unit"),
          };
    });
    if (!form.get("title").trim() || exercises.some((x) => !x.name)) return;
    const updated = {
      ...w,
      title: form.get("title").trim(),
      date: form.get("date"),
      notes: form.get("notes"),
      exercises,
    };
    if (updated.finished && progress(updated).percent !== 100)
      updated.finished = false;
    state.workouts = state.workouts
      .filter((x) => x.id !== w.id)
      .concat(updated);
    selected = updated.date;
    month = new Date(`${selected}T12:00:00`);
    persist();
    dialog.close();
    render();
  };
  dialog.showModal();
}
function bind() {
  document.querySelectorAll("[data-view]").forEach(
    (b) =>
      (b.onclick = () => {
        view = b.dataset.view;
        render();
      }),
  );
  document.querySelectorAll("[data-date]").forEach(
    (b) =>
      (b.onclick = () => {
        selected = b.dataset.date;
        render();
      }),
  );
  document.querySelectorAll("[data-filter]").forEach(
    (b) =>
      (b.onclick = () => {
        filter = b.dataset.filter;
        render();
      }),
  );
  document
    .querySelectorAll("[data-edit]")
    .forEach((b) => (b.onclick = () => editor(b.dataset.edit)));
  document.querySelectorAll("[data-start]").forEach(
    (b) =>
      (b.onclick = () => {
        state.active = b.dataset.start;
        view = "active";
        persist();
        render();
      }),
  );
  const liftSelect = document.querySelector("#history-lift");
  if (liftSelect)
    liftSelect.onchange = () => {
      historyLift = liftSelect.value;
      render();
    };
  const on = (id, fn) => {
    const e = document.getElementById(id);
    if (e) e.onclick = fn;
  };
  on("new", () => editor());
  on("import", () => document.querySelector("#ics-file").click());
  on("prev", () => {
    month = new Date(month.getFullYear(), month.getMonth() - 1, 1);
    render();
  });
  on("next", () => {
    month = new Date(month.getFullYear(), month.getMonth() + 1, 1);
    render();
  });
  on("today", () => {
    selected = localDate();
    month = new Date();
    render();
  });
  function setDone(eid, index, weight) {
    const w = state.workouts.find((w) => w.id === state.active),
      e = w.exercises.find((e) => e.id === eid);
    logSet(e, index, weight);
    w.finished = false;
    persist();
    render();
  }
  document
    .querySelectorAll("[data-set]")
    .forEach(
      (b) => (b.onclick = () => setDone(b.dataset.set, +b.dataset.index)),
    );
  document.querySelectorAll("[data-complete]").forEach(
    (b) =>
      (b.onclick = () => {
        const w = state.workouts.find((w) => w.id === state.active),
          e = w.exercises.find((e) => e.id === b.dataset.complete);
        const input = document.querySelector("#actual-weight");
        if (input && !input.checkValidity()) {
          input.reportValidity();
          return;
        }
        setDone(
          e.id,
          Array.from({ length: e.sets }, (_, i) => i).find(
            (i) => !e.done.includes(i),
          ),
          input?.value,
        );
      }),
  );
  on("finish", () => {
    state.workouts.find((w) => w.id === state.active).finished = true;
    persist();
    render();
    toast("Session complete. Good work!");
  });
  document.querySelector("#ics-file").onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      if (file.size > 5e6)
        throw Error("Please use a calendar file smaller than 5 MB.");
      const result = importCalendar(await file.text());
      if (!result.workouts.length)
        throw Error("No dated workout events found in this file.");
      const before = state.workouts.length;
      state.workouts = mergeWorkouts(state.workouts, result.workouts);
      selected = result.workouts[0].date;
      month = new Date(`${selected}T12:00:00`);
      const saved = persist();
      render();
      toast(
        `${state.workouts.length - before} sessions imported.${result.truncated ? " Import limit reached; export a smaller date range for remaining sessions." : ""}${saved ? "" : " Storage unavailable — export a backup."}`,
      );
    } catch (error) {
      toast(`Import failed: ${error.message}`);
    }
    e.target.value = "";
  };
  on("export", () => {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(state, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `stack-days-backup-${localDate()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  on("restore", () => document.querySelector("#backup-file").click());
  document.querySelector("#backup-file").onchange = async (e) => {
    try {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 10e6) throw Error("Backup is too large.");
      const data = JSON.parse(await file.text());
      validateBackup(data);
      if (
        !confirm(
          "Replace all current workouts with this backup? Export your current data first if needed.",
        )
      )
        return;
      state = migrateExercises(data);
      persist();
      render();
      toast("Backup restored.");
    } catch (error) {
      toast(`Restore failed: ${error.message}`);
    }
  };
}
function validateBackup(data) {
  if (!data || !Array.isArray(data.workouts) || data.workouts.length > 10000)
    throw Error("Invalid backup.");
  for (const w of data.workouts)
    for (const e of w.exercises || []) {
      if (e.type !== undefined && !["lift", "cardio"].includes(e.type))
        throw Error("Invalid exercise type.");
      if (
        isCardio(e) &&
        (!cardioUnits[e.measurement]?.includes(e.cardioUnit) ||
          !Number.isFinite(e.magnitude) ||
          e.magnitude <= 0 ||
          !Number.isInteger(e.zone) ||
          e.zone < 1 ||
          e.zone > 5)
      )
        throw Error("Invalid cardio data.");
    }
  const ids = new Set();
  for (const w of data.workouts) {
    if (
      typeof w.id !== "string" ||
      ids.has(w.id) ||
      typeof w.title !== "string" ||
      typeof w.notes !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(w.date) ||
      Number.isNaN(Date.parse(w.date)) ||
      !Array.isArray(w.exercises)
    )
      throw Error("Invalid workout data.");
    ids.add(w.id);
    for (const e of w.exercises)
      if (
        typeof e.id !== "string" ||
        typeof e.name !== "string" ||
        !Number.isInteger(e.sets) ||
        e.sets < 1 ||
        e.sets > 50 ||
        !Number.isInteger(e.reps) ||
        e.reps < 1 ||
        e.reps > 1000 ||
        !Array.isArray(e.done) ||
        new Set(e.done).size !== e.done.length ||
        e.done.some((n) => !Number.isInteger(n) || n < 0 || n >= e.sets) ||
        !["kg", "lb", "lbs", "%", "BW", "BW%"].includes(e.unit) ||
        !["string", "number"].includes(typeof e.weight)
      )
        throw Error("Invalid exercise data.");
  }
  for (const w of data.workouts)
    for (const e of w.exercises)
      if (
        e.logs !== undefined &&
        (!Array.isArray(e.logs) ||
          e.logs.some(
            (log) =>
              !Number.isInteger(log.set) ||
              !e.done.includes(log.set) ||
              typeof log.weight !== "string" ||
              (log.weight !== "" &&
                (!Number.isFinite(Number(log.weight)) ||
                  Number(log.weight) < 0)) ||
              !Number.isInteger(log.reps) ||
              log.reps < 1 ||
              log.reps > 1000 ||
              !["kg", "lb", "lbs", "%", "BW", "BW%"].includes(log.unit) ||
              typeof log.completedAt !== "string",
          ))
      )
        throw Error("Invalid set history.");
  if (data.active !== null && !ids.has(data.active)) data.active = null;
}
render();
if ("serviceWorker" in navigator && import.meta.env.PROD)
  navigator.serviceWorker
    .register("/sw.js")
    .catch(() =>
      toast("Offline installation failed. Reload online to try again."),
    );
