// Repository: the ONLY file that talks to Postgres.
const { Pool } = require("pg");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Create the table if missing and seed three tasks only when it is empty.
async function init() {
  // Retry a few times: the database container may still be starting up.
  for (let attempt = 1; attempt <= 15; attempt++) {
    try {
      await pool.query("SELECT 1");
      break;
    } catch (err) {
      if (attempt === 15) throw err;
      console.log(`Waiting for database (attempt ${attempt})...`);
      await sleep(2000);
    }
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id    SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      done  BOOLEAN NOT NULL DEFAULT FALSE
    )
  `);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Lock the table so two app instances cannot both seed
    await client.query("LOCK TABLE tasks IN EXCLUSIVE MODE");
    const { rows } = await client.query("SELECT COUNT(*)::int AS count FROM tasks");
    if (rows[0].count === 0) {
      await client.query(
        "INSERT INTO tasks (title, done) VALUES ($1, $2), ($3, $4), ($5, $6)",
        ["Buy milk", false, "Learn SQL", false, "Push project to GitHub", true]
      );
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

const validId = (id) => /^\d+$/.test(String(id));

async function getAll() {
  const { rows } = await pool.query("SELECT * FROM tasks ORDER BY id");
  return rows;
}

async function getById(id) {
  if (!validId(id)) return null;
  const { rows } = await pool.query("SELECT * FROM tasks WHERE id = $1", [id]);
  return rows[0] || null;
}

async function create(title) {
  const { rows } = await pool.query(
    "INSERT INTO tasks (title, done) VALUES ($1, $2) RETURNING *",
    [title, false]
  );
  return rows[0];
}

// title/done may be undefined: keep the existing value in that case
async function update(id, title, done) {
  if (!validId(id)) return null;
  const { rows } = await pool.query(
    `UPDATE tasks
        SET title = COALESCE($1, title),
            done  = COALESCE($2, done)
      WHERE id = $3
      RETURNING *`,
    [title ?? null, done ?? null, id]
  );
  return rows[0] || null;
}

async function remove(id) {
  if (!validId(id)) return false;
  const result = await pool.query("DELETE FROM tasks WHERE id = $1", [id]);
  return result.rowCount > 0;
}

module.exports = { init, getAll, getById, create, update, remove };
