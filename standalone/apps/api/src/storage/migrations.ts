import type { Database } from "sql.js";

interface SqliteMigration {
  id: string;
  sql: string;
}

const migrations: SqliteMigration[] = [
  {
    id: "001_create_user_sessions",
    sql: `
CREATE TABLE IF NOT EXISTS user_sessions (
  user_id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL,
  username TEXT,
  last_intent TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`
  },
  {
    id: "002_create_lead_requests",
    sql: `
CREATE TABLE IF NOT EXISTS lead_requests (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  status TEXT NOT NULL,
  user_id TEXT NOT NULL,
  chat_id TEXT NOT NULL,
  username TEXT,
  text TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`
  },
  {
    id: "003_extend_user_sessions_for_guides",
    sql: `
ALTER TABLE user_sessions ADD COLUMN selected_guide_id TEXT;
ALTER TABLE user_sessions ADD COLUMN subscription_checked_at TEXT;
ALTER TABLE user_sessions ADD COLUMN guide_delivered_at TEXT;
`
  },
  {
    id: "004_create_analytics_events",
    sql: `
CREATE TABLE IF NOT EXISTS analytics_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  source TEXT NOT NULL,
  user_id TEXT NOT NULL,
  chat_id TEXT NOT NULL,
  username TEXT,
  guide_id TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at
  ON analytics_events(created_at);

CREATE INDEX IF NOT EXISTS idx_analytics_events_event_type
  ON analytics_events(event_type);

CREATE INDEX IF NOT EXISTS idx_analytics_events_user_id
  ON analytics_events(user_id);
`
  },
  {
    id: "005_create_admin_auth",
    sql: `
CREATE TABLE IF NOT EXISTS admin_users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  display_name TEXT,
  role TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  password_iterations INTEGER NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  password_changed_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_admin_users_username
  ON admin_users(username);

CREATE TABLE IF NOT EXISTS admin_sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  FOREIGN KEY (user_id) REFERENCES admin_users(id)
);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_user_id
  ON admin_sessions(user_id);
`
  }
];

export function runSqliteMigrations(database: Database): void {
  database.run(`
CREATE TABLE IF NOT EXISTS schema_migrations (
  id TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL
);
`);

  const applied = readAppliedMigrations(database);
  for (const migration of migrations) {
    if (applied.has(migration.id)) {
      continue;
    }

    database.run("BEGIN");
    try {
      database.run(migration.sql);
      database.run(
        "INSERT INTO schema_migrations (id, applied_at) VALUES ($id, $appliedAt)",
        {
          $id: migration.id,
          $appliedAt: new Date().toISOString()
        }
      );
      database.run("COMMIT");
    } catch (error) {
      database.run("ROLLBACK");
      throw error;
    }
  }
}

function readAppliedMigrations(database: Database): Set<string> {
  const statement = database.prepare("SELECT id FROM schema_migrations");

  try {
    const ids = new Set<string>();
    while (statement.step()) {
      const row = statement.getAsObject();
      ids.add(String(row.id));
    }
    return ids;
  } finally {
    statement.free();
  }
}
