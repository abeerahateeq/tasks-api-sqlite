// npm install express better-sqlite3
const express = require("express");
const Database = require("better-sqlite3");

const app = express();
app.use(express.json());

// Stage 0: create the database file and table if missing
const db = new Database("tasks.db");
db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id    INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    done  INTEGER NOT NULL DEFAULT 0
  )
`);

// Seed three example tasks only when the table is empty
const { count } = db.prepare("SELECT COUNT(*) AS count FROM tasks").get();
if (count === 0) {
  const insert = db.prepare("INSERT INTO tasks (title, done) VALUES (?, ?)");
  // Transaction: all three seeds are inserted, or none are
  const seed = db.transaction(() => {
    insert.run("Buy milk", 0);
    insert.run("Learn SQL", 0);
    insert.run("Push project to GitHub", 1);
  });
  seed();
}

// SQLite stores booleans as 0/1, so convert back to keep the API identical
const toTask = (row) => ({ id: row.id, title: row.title, done: !!row.done });

// Stage 1: read
app.get("/tasks", (req, res) => {
  const rows = db.prepare("SELECT * FROM tasks").all();
  res.json(rows.map(toTask));
});

app.get("/tasks/:id", (req, res) => {
  const row = db.prepare("SELECT * FROM tasks WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Task not found" });
  res.json(toTask(row));
});

// Stage 2: create
app.post("/tasks", (req, res) => {
  const { title } = req.body || {};
  if (typeof title !== "string" || title.trim() === "") {
    return res.status(400).json({ error: "Title is required" });
  }
  // New tasks always start as not done (0)
  const info = db
    .prepare("INSERT INTO tasks (title, done) VALUES (?, 0)")
    .run(title.trim());
  const row = db.prepare("SELECT * FROM tasks WHERE id = ?").get(info.lastInsertRowid);
  res.status(201).json(toTask(row));
});

// Stage 3: update and delete
app.put("/tasks/:id", (req, res) => {
  const existing = db.prepare("SELECT * FROM tasks WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Task not found" });

  const { title, done } = req.body || {};
  if (title !== undefined && (typeof title !== "string" || title.trim() === "")) {
    return res.status(400).json({ error: "Title must be a non-empty string" });
  }

  const newTitle = title !== undefined ? title.trim() : existing.title;
  const newDone = done !== undefined ? (done ? 1 : 0) : existing.done;

  db.prepare("UPDATE tasks SET title = ?, done = ? WHERE id = ?").run(
    newTitle,
    newDone,
    req.params.id
  );
  res.json(toTask({ id: existing.id, title: newTitle, done: newDone }));
});

app.delete("/tasks/:id", (req, res) => {
  const info = db.prepare("DELETE FROM tasks WHERE id = ?").run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: "Task not found" });
  res.status(204).send();
});

app.listen(3000, () => console.log("Server running on http://localhost:3000"));
