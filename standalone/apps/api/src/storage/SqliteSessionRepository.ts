import type { UserSession } from "@telegram-bot-template/core";
import type { SessionRepository } from "@telegram-bot-template/core";
import { SqliteDatabase, type SqliteDatabaseOptions } from "./SqliteDatabase";

export class SqliteSessionRepository implements SessionRepository {
  private readonly database: SqliteDatabase;
  private readonly ownsDatabase: boolean;

  constructor(source: SqliteDatabase | SqliteDatabaseOptions) {
    this.database = source instanceof SqliteDatabase ? source : new SqliteDatabase(source);
    this.ownsDatabase = !(source instanceof SqliteDatabase);
  }

  async findByUserId(userId: string): Promise<UserSession | null> {
    const database = await this.database.get();
    const statement = database.prepare(`
      SELECT
        user_id AS userId,
        chat_id AS chatId,
        username,
        last_intent AS lastIntent,
        selected_guide_id AS selectedGuideId,
        subscription_checked_at AS subscriptionCheckedAt,
        guide_delivered_at AS guideDeliveredAt,
        updated_at AS updatedAt
      FROM user_sessions
      WHERE user_id = $userId
    `);

    try {
      statement.bind({ $userId: userId });
      if (!statement.step()) {
        return null;
      }

      const row = statement.getAsObject();
      return {
        userId: String(row.userId),
        chatId: String(row.chatId),
        username: typeof row.username === "string" ? row.username : undefined,
        lastIntent: String(row.lastIntent),
        selectedGuideId: typeof row.selectedGuideId === "string" ? row.selectedGuideId : undefined,
        subscriptionCheckedAt: typeof row.subscriptionCheckedAt === "string" ? row.subscriptionCheckedAt : undefined,
        guideDeliveredAt: typeof row.guideDeliveredAt === "string" ? row.guideDeliveredAt : undefined,
        updatedAt: String(row.updatedAt)
      };
    } finally {
      statement.free();
    }
  }

  async save(session: UserSession): Promise<void> {
    const database = await this.database.get();
    database.run(
      `
      INSERT INTO user_sessions (
        user_id,
        chat_id,
        username,
        last_intent,
        selected_guide_id,
        subscription_checked_at,
        guide_delivered_at,
        updated_at
      )
      VALUES (
        $userId,
        $chatId,
        $username,
        $lastIntent,
        $selectedGuideId,
        $subscriptionCheckedAt,
        $guideDeliveredAt,
        $updatedAt
      )
      ON CONFLICT(user_id) DO UPDATE SET
        chat_id = excluded.chat_id,
        username = excluded.username,
        last_intent = excluded.last_intent,
        selected_guide_id = excluded.selected_guide_id,
        subscription_checked_at = excluded.subscription_checked_at,
        guide_delivered_at = excluded.guide_delivered_at,
        updated_at = excluded.updated_at
      `,
      {
        $userId: session.userId,
        $chatId: session.chatId,
        $username: session.username ?? null,
        $lastIntent: session.lastIntent,
        $selectedGuideId: session.selectedGuideId ?? null,
        $subscriptionCheckedAt: session.subscriptionCheckedAt ?? null,
        $guideDeliveredAt: session.guideDeliveredAt ?? null,
        $updatedAt: session.updatedAt
      }
    );
    this.database.persist(database);
  }

  async close(): Promise<void> {
    if (this.ownsDatabase) {
      await this.database.close();
    }
  }
}
