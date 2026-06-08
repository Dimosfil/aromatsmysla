import type { AnalyticsEvent, AnalyticsRepository } from "@telegram-bot-template/core";
import type { AdminStatsDailyPoint, AdminStatsEventDto, AdminStatsResponse } from "@telegram-bot-template/shared";
import type { Database } from "sql.js";
import { SqliteDatabase, type SqliteDatabaseOptions } from "./SqliteDatabase";

const errorEventTypes = ["guide_subscription_check_error", "guide_unavailable"];

export class SqliteAnalyticsRepository implements AnalyticsRepository {
  private readonly database: SqliteDatabase;
  private readonly ownsDatabase: boolean;

  constructor(source: SqliteDatabase | SqliteDatabaseOptions) {
    this.database = source instanceof SqliteDatabase ? source : new SqliteDatabase(source);
    this.ownsDatabase = !(source instanceof SqliteDatabase);
  }

  async record(event: AnalyticsEvent): Promise<void> {
    const database = await this.database.get();
    database.run(
      `
      INSERT INTO analytics_events (
        id,
        event_type,
        source,
        user_id,
        chat_id,
        username,
        guide_id,
        metadata_json,
        created_at
      )
      VALUES (
        $id,
        $eventType,
        $source,
        $userId,
        $chatId,
        $username,
        $guideId,
        $metadataJson,
        $createdAt
      )
      `,
      {
        $id: event.id,
        $eventType: event.eventType,
        $source: event.source,
        $userId: event.userId,
        $chatId: event.chatId,
        $username: event.username ?? null,
        $guideId: event.guideId ?? null,
        $metadataJson: event.metadata ? JSON.stringify(event.metadata) : null,
        $createdAt: event.createdAt
      }
    );
    this.database.persist(database);
  }

  async getAdminStats(limit = 25): Promise<AdminStatsResponse> {
    const database = await this.database.get();
    const eventCounts = readEventCounts(database);
    const totalEvents = readNumber(database, "SELECT COUNT(*) AS value FROM analytics_events");
    const totalUsers = readNumber(database, "SELECT COUNT(DISTINCT user_id) AS value FROM analytics_events");
    const errors = errorEventTypes.reduce((sum, eventType) => sum + (eventCounts.get(eventType) ?? 0), 0);

    return {
      overview: {
        totalUsers,
        totalEvents,
        starts: eventCounts.get("guide_start") ?? 0,
        subscriptionChecks: eventCounts.get("guide_subscription_check_clicked") ?? 0,
        subscriptionVerified: eventCounts.get("guide_subscription_verified") ?? 0,
        guideClicks: eventCounts.get("guide_clicked") ?? 0,
        guideDelivered: eventCounts.get("guide_delivered") ?? 0,
        errors
      },
      daily: readDailyPoints(database),
      funnel: [
        {
          id: "guide_start",
          label: "/start",
          count: eventCounts.get("guide_start") ?? 0
        },
        {
          id: "guide_subscription_check_clicked",
          label: "Проверка подписки",
          count: eventCounts.get("guide_subscription_check_clicked") ?? 0
        },
        {
          id: "guide_subscription_verified",
          label: "Подписка подтверждена",
          count: eventCounts.get("guide_subscription_verified") ?? 0
        },
        {
          id: "guide_clicked",
          label: "Выбор подарка",
          count: eventCounts.get("guide_clicked") ?? 0
        },
        {
          id: "guide_delivered",
          label: "Файл отправлен",
          count: eventCounts.get("guide_delivered") ?? 0
        }
      ],
      recentEvents: readRecentEvents(database, limit),
      recentErrors: readRecentEvents(database, limit, errorEventTypes)
    };
  }

  async close(): Promise<void> {
    if (this.ownsDatabase) {
      await this.database.close();
    }
  }
}

function readEventCounts(database: Database): Map<string, number> {
  const statement = database.prepare(`
    SELECT event_type AS eventType, COUNT(*) AS count
    FROM analytics_events
    GROUP BY event_type
  `);

  try {
    const counts = new Map<string, number>();
    while (statement.step()) {
      const row = statement.getAsObject();
      counts.set(String(row.eventType), Number(row.count));
    }
    return counts;
  } finally {
    statement.free();
  }
}

function readDailyPoints(database: Database): AdminStatsDailyPoint[] {
  const statement = database.prepare(`
    WITH first_seen AS (
      SELECT user_id, MIN(substr(created_at, 1, 10)) AS first_date
      FROM analytics_events
      GROUP BY user_id
    ),
    event_days AS (
      SELECT substr(created_at, 1, 10) AS date, COUNT(*) AS events
      FROM analytics_events
      GROUP BY substr(created_at, 1, 10)
    ),
    user_days AS (
      SELECT first_date AS date, COUNT(*) AS newUsers
      FROM first_seen
      GROUP BY first_date
    )
    SELECT
      event_days.date AS date,
      COALESCE(user_days.newUsers, 0) AS newUsers,
      event_days.events AS events
    FROM event_days
    LEFT JOIN user_days ON user_days.date = event_days.date
    ORDER BY event_days.date DESC
    LIMIT 14
  `);

  try {
    const points: AdminStatsDailyPoint[] = [];
    while (statement.step()) {
      const row = statement.getAsObject();
      points.push({
        date: String(row.date),
        newUsers: Number(row.newUsers),
        events: Number(row.events)
      });
    }
    return points.reverse();
  } finally {
    statement.free();
  }
}

function readRecentEvents(database: Database, limit: number, eventTypes?: string[]): AdminStatsEventDto[] {
  const typeFilter = eventTypes?.length
    ? `WHERE event_type IN (${eventTypes.map((_eventType, index) => `$eventType${index}`).join(", ")})`
    : "";
  const statement = database.prepare(`
    SELECT
      id,
      event_type AS eventType,
      user_id AS userId,
      chat_id AS chatId,
      username,
      guide_id AS guideId,
      metadata_json AS metadataJson,
      created_at AS createdAt
    FROM analytics_events
    ${typeFilter}
    ORDER BY created_at DESC
    LIMIT $limit
  `);

  try {
    const events: AdminStatsEventDto[] = [];
    statement.bind({
      $limit: limit,
      ...(eventTypes ?? []).reduce<Record<string, string>>((params, eventType, index) => {
        params[`$eventType${index}`] = eventType;
        return params;
      }, {})
    });
    while (statement.step()) {
      const row = statement.getAsObject();
      events.push({
        id: String(row.id),
        eventType: String(row.eventType),
        userId: String(row.userId),
        chatId: String(row.chatId),
        username: typeof row.username === "string" ? row.username : undefined,
        guideId: typeof row.guideId === "string" ? row.guideId : undefined,
        metadata: parseMetadata(row.metadataJson),
        createdAt: String(row.createdAt)
      });
    }
    return events;
  } finally {
    statement.free();
  }
}

function readNumber(database: Database, sql: string): number {
  const statement = database.prepare(sql);

  try {
    if (!statement.step()) {
      return 0;
    }

    const row = statement.getAsObject();
    return Number(row.value);
  } finally {
    statement.free();
  }
}

function parseMetadata(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== "string" || !value) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : undefined;
  } catch {
    return undefined;
  }
}
