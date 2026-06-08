import type { UserSession } from "../models";
import type { SessionRepository } from "../ports";

export class InMemorySessionRepository implements SessionRepository {
  private readonly sessions = new Map<string, UserSession>();

  async findByUserId(userId: string): Promise<UserSession | null> {
    return this.sessions.get(userId) ?? null;
  }

  async save(session: UserSession): Promise<void> {
    this.sessions.set(session.userId, session);
  }
}
