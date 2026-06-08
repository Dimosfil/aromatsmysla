import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import initSqlJs, { type Database } from "sql.js";
import { runSqliteMigrations } from "./migrations";

export interface SqliteDatabaseOptions {
  databasePath: string;
}

export class SqliteDatabase {
  private databasePromise: Promise<Database> | null = null;

  constructor(private readonly options: SqliteDatabaseOptions) {}

  async get(): Promise<Database> {
    this.databasePromise ??= this.createDatabase();
    return this.databasePromise;
  }

  persist(database: Database): void {
    mkdirSync(dirname(this.options.databasePath), { recursive: true });
    writeFileSync(this.options.databasePath, database.export());
  }

  async close(): Promise<void> {
    if (!this.databasePromise) {
      return;
    }

    const database = await this.databasePromise;
    this.persist(database);
    database.close();
    this.databasePromise = null;
  }

  private async createDatabase(): Promise<Database> {
    const SQL = await initSqlJs();
    const database = existsSync(this.options.databasePath)
      ? new SQL.Database(readFileSync(this.options.databasePath))
      : new SQL.Database();
    runSqliteMigrations(database);
    this.persist(database);
    return database;
  }
}
