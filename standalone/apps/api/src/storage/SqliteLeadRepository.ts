import type { LeadRequest, LeadRepository } from "@telegram-bot-template/core";
import { SqliteDatabase, type SqliteDatabaseOptions } from "./SqliteDatabase";

export class SqliteLeadRepository implements LeadRepository {
  private readonly database: SqliteDatabase;
  private readonly ownsDatabase: boolean;

  constructor(source: SqliteDatabase | SqliteDatabaseOptions) {
    this.database = source instanceof SqliteDatabase ? source : new SqliteDatabase(source);
    this.ownsDatabase = !(source instanceof SqliteDatabase);
  }

  async create(lead: LeadRequest): Promise<void> {
    const database = await this.database.get();
    database.run(
      `
      INSERT INTO lead_requests (
        id,
        source,
        status,
        user_id,
        chat_id,
        username,
        text,
        created_at,
        updated_at
      )
      VALUES (
        $id,
        $source,
        $status,
        $userId,
        $chatId,
        $username,
        $text,
        $createdAt,
        $updatedAt
      )
      `,
      {
        $id: lead.id,
        $source: lead.source,
        $status: lead.status,
        $userId: lead.userId,
        $chatId: lead.chatId,
        $username: lead.username ?? null,
        $text: lead.text,
        $createdAt: lead.createdAt,
        $updatedAt: lead.updatedAt
      }
    );
    this.database.persist(database);
  }

  async listRecent(limit: number): Promise<LeadRequest[]> {
    const database = await this.database.get();
    const normalizedLimit = Math.max(1, Math.min(100, Math.floor(limit)));
    const statement = database.prepare(`
      SELECT
        id,
        source,
        status,
        user_id AS userId,
        chat_id AS chatId,
        username,
        text,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM lead_requests
      ORDER BY created_at DESC
      LIMIT $limit
    `);

    try {
      statement.bind({ $limit: normalizedLimit });
      const leads: LeadRequest[] = [];
      while (statement.step()) {
        leads.push(this.mapLeadRow(statement.getAsObject()));
      }
      return leads;
    } finally {
      statement.free();
    }
  }

  async findById(id: string): Promise<LeadRequest | null> {
    const database = await this.database.get();
    const statement = database.prepare(`
      SELECT
        id,
        source,
        status,
        user_id AS userId,
        chat_id AS chatId,
        username,
        text,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM lead_requests
      WHERE id = $id
    `);

    try {
      statement.bind({ $id: id });
      if (!statement.step()) {
        return null;
      }

      return this.mapLeadRow(statement.getAsObject());
    } finally {
      statement.free();
    }
  }

  async close(): Promise<void> {
    if (this.ownsDatabase) {
      await this.database.close();
    }
  }

  private mapLeadRow(row: Record<string, unknown>): LeadRequest {
    return {
      id: String(row.id),
      source: String(row.source) as LeadRequest["source"],
      status: String(row.status) as LeadRequest["status"],
      userId: String(row.userId),
      chatId: String(row.chatId),
      username: typeof row.username === "string" ? row.username : undefined,
      text: String(row.text),
      createdAt: String(row.createdAt),
      updatedAt: String(row.updatedAt)
    };
  }
}
