// Routes only. No SQL in this file; all storage lives in db.js.
const express = require("express");
const db = require("./db");

const app = express();
app.use(express.json());

const notFound = (res) => res.status(404).json({ error: "Task not found" });

app.get("/tasks", async (req, res, next) => {
  try {
    res.json(await db.getAll());
  } catch (err) {
    next(err);
  }
});

app.get("/tasks/:id", async (req, res, next) => {
  try {
    const task = await db.getById(req.params.id);
    if (!task) return notFound(res);
    res.json(task);
  } catch (err) {
    next(err);
  }
});

app.post("/tasks", async (req, res, next) => {
  try {
    const { title } = req.body || {};
    if (typeof title !== "string" || title.trim() === "") {
      return res.status(400).json({ error: "Title is required" });
    }
    const task = await db.create(title.trim());
    res.status(201).json(task);
  } catch (err) {
    next(err);
  }
});

app.put("/tasks/:id", async (req, res, next) => {
  try {
    const { title, done } = req.body || {};
    if (title !== undefined && (typeof title !== "string" || title.trim() === "")) {
      return res.status(400).json({ error: "Title must be a non-empty string" });
    }
    if (done !== undefined && typeof done !== "boolean") {
      return res.status(400).json({ error: "Done must be true or false" });
    }
    const task = await db.update(
      req.params.id,
      title === undefined ? undefined : title.trim(),
      done
    );
    if (!task) return notFound(res);
    res.json(task);
  } catch (err) {
    next(err);
  }
});

app.delete("/tasks/:id", async (req, res, next) => {
  try {
    const deleted = await db.remove(req.params.id);
    if (!deleted) return notFound(res);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

const PORT = process.env.PORT || 3000;

db.init()
  .then(() => app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`)))
  .catch((err) => {
    console.error("Could not start:", err.message);
    process.exit(1);
  });
