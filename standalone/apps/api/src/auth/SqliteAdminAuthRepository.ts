import type { Database } from "sql.js";
import type { AdminUserDto, AdminUserRole } from "@telegram-bot-template/shared";
import type { SqliteDatabase } from "../storage/SqliteDatabase";
import type { PasswordRecord } from "./passwords";

export interface AdminUserRecord extends AdminUserDto, PasswordRecord {}

export interface CreateAdminUserRecord {
  id: string;
  username: string;
  displayName?: string;
  role: AdminUserRole;
  active: boolean;
  password: PasswordRecord;
  now: string;
}

export interface UpdateAdminUserRecord {
  username?: string;
  displayName?: string;
  role?: AdminUserRole;
  active?: boolean;
  updatedAt: string;
}

export interface CreateAdminSessionRecord {
  token: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
}

export class SqliteAdminAuthRepository {
  constructor(private readonly sqlite: SqliteDatabase) {}

  async countUsers(): Promise<number> {
    const database = await this.sqlite.get();
    const statement = database.prepare("SELECT COUNT(*) AS value FROM admin_users");
    try {
      return statement.step() ? Number(statement.getAsObject().value) : 0;
    } finally {
      statement.free();
    }
  }

  async listUsers(): Promise<AdminUserDto[]> {
    const database = await this.sqlite.get();
    const statement = database.prepare(`
      SELECT
        id,
        username,
        display_name AS displayName,
        role,
        active,
        created_at AS createdAt,
        updated_at AS updatedAt,
        password_changed_at AS passwordChangedAt
      FROM admin_users
      ORDER BY created_at ASC
    `);
    try {
      const users: AdminUserDto[] = [];
      while (statement.step()) {
        users.push(mapUserDto(statement.getAsObject()));
      }
      return users;
    } finally {
      statement.free();
    }
  }

  async findUserById(id: string): Promise<AdminUserRecord | null> {
    return this.findOne("WHERE id = $value", id);
  }

  async findUserByUsername(username: string): Promise<AdminUserRecord | null> {
    return this.findOne("WHERE lower(username) = lower($value)", username);
  }

  async createUser(user: CreateAdminUserRecord): Promise<AdminUserDto> {
    const database = await this.sqlite.get();
    database.run(
      `
      INSERT INTO admin_users (
        id,
        username,
        display_name,
        role,
        password_hash,
        password_salt,
        password_iterations,
        active,
        created_at,
        updated_at,
        password_changed_at
      )
      VALUES (
        $id,
        $username,
        $displayName,
        $role,
        $hash,
        $salt,
        $iterations,
        $active,
        $createdAt,
        $updatedAt,
        $passwordChangedAt
      )
    `,
      {
        $id: user.id,
        $username: user.username,
        $displayName: user.displayName ?? null,
        $role: user.role,
        $hash: user.password.hash,
        $salt: user.password.salt,
        $iterations: user.password.iterations,
        $active: user.active ? 1 : 0,
        $createdAt: user.now,
        $updatedAt: user.now,
        $passwordChangedAt: user.now
      }
    );
    this.sqlite.persist(database);
    const created = await this.findUserById(user.id);
    if (!created) {
      throw new Error("Admin user was not persisted.");
    }
    return toDto(created);
  }

  async updateUser(id: string, patch: UpdateAdminUserRecord): Promise<AdminUserDto | null> {
    const updates: string[] = [];
    const values: Record<string, string | number | null> = {
      $id: id,
      $updatedAt: patch.updatedAt
    };
    if (patch.username !== undefined) {
      updates.push("username = $username");
      values.$username = patch.username;
    }
    if (patch.displayName !== undefined) {
      updates.push("display_name = $displayName");
      values.$displayName = patch.displayName || null;
    }
    if (patch.role !== undefined) {
      updates.push("role = $role");
      values.$role = patch.role;
    }
    if (patch.active !== undefined) {
      updates.push("active = $active");
      values.$active = patch.active ? 1 : 0;
    }
    if (updates.length === 0) {
      const existing = await this.findUserById(id);
      return existing ? toDto(existing) : null;
    }

    const database = await this.sqlite.get();
    database.run(
      `
      UPDATE admin_users
      SET ${updates.join(", ")}, updated_at = $updatedAt
      WHERE id = $id
    `,
      values
    );
    this.sqlite.persist(database);
    const updated = await this.findUserById(id);
    return updated ? toDto(updated) : null;
  }

  async updatePassword(id: string, password: PasswordRecord, now: string): Promise<void> {
    const database = await this.sqlite.get();
    database.run(
      `
      UPDATE admin_users
      SET
        password_hash = $hash,
        password_salt = $salt,
        password_iterations = $iterations,
        updated_at = $updatedAt,
        password_changed_at = $passwordChangedAt
      WHERE id = $id
    `,
      {
        $id: id,
        $hash: password.hash,
        $salt: password.salt,
        $iterations: password.iterations,
        $updatedAt: now,
        $passwordChangedAt: now
      }
    );
    this.sqlite.persist(database);
  }

  async countActiveOwners(excludingUserId?: string): Promise<number> {
    const database = await this.sqlite.get();
    const statement = database.prepare(`
      SELECT COUNT(*) AS value
      FROM admin_users
      WHERE role = 'owner' AND active = 1 AND ($excludingUserId IS NULL OR id != $excludingUserId)
    `);
    try {
      statement.bind({ $excludingUserId: excludingUserId ?? null });
      return statement.step() ? Number(statement.getAsObject().value) : 0;
    } finally {
      statement.free();
    }
  }

  async createSession(session: CreateAdminSessionRecord): Promise<void> {
    const database = await this.sqlite.get();
    database.run(
      `
      INSERT INTO admin_sessions (token, user_id, created_at, expires_at)
      VALUES ($token, $userId, $createdAt, $expiresAt)
    `,
      {
        $token: session.token,
        $userId: session.userId,
        $createdAt: session.createdAt,
        $expiresAt: session.expiresAt
      }
    );
    this.sqlite.persist(database);
  }

  async findUserBySessionToken(token: string, now: string): Promise<AdminUserRecord | null> {
    const database = await this.sqlite.get();
    const statement = database.prepare(`
      SELECT
        users.id,
        users.username,
        users.display_name AS displayName,
        users.role,
        users.password_hash AS hash,
        users.password_salt AS salt,
        users.password_iterations AS iterations,
        users.active,
        users.created_at AS createdAt,
        users.updated_at AS updatedAt,
        users.password_changed_at AS passwordChangedAt
      FROM admin_sessions sessions
      INNER JOIN admin_users users ON users.id = sessions.user_id
      WHERE sessions.token = $token
        AND sessions.revoked_at IS NULL
        AND sessions.expires_at > $now
        AND users.active = 1
      LIMIT 1
    `);
    try {
      statement.bind({ $token: token, $now: now });
      return statement.step() ? mapUserRecord(statement.getAsObject()) : null;
    } finally {
      statement.free();
    }
  }

  async revokeSessionsForUser(userId: string, now: string): Promise<void> {
    const database = await this.sqlite.get();
    database.run(
      `
      UPDATE admin_sessions
      SET revoked_at = $revokedAt
      WHERE user_id = $userId AND revoked_at IS NULL
    `,
      {
        $userId: userId,
        $revokedAt: now
      }
    );
    this.sqlite.persist(database);
  }

  private async findOne(whereClause: string, value: string): Promise<AdminUserRecord | null> {
    const database = await this.sqlite.get();
    const statement = database.prepare(`
      SELECT
        id,
        username,
        display_name AS displayName,
        role,
        password_hash AS hash,
        password_salt AS salt,
        password_iterations AS iterations,
        active,
        created_at AS createdAt,
        updated_at AS updatedAt,
        password_changed_at AS passwordChangedAt
      FROM admin_users
      ${whereClause}
      LIMIT 1
    `);
    try {
      statement.bind({ $value: value });
      return statement.step() ? mapUserRecord(statement.getAsObject()) : null;
    } finally {
      statement.free();
    }
  }
}

function mapUserRecord(row: Record<string, unknown>): AdminUserRecord {
  return {
    ...mapUserDto(row),
    hash: String(row.hash),
    salt: String(row.salt),
    iterations: Number(row.iterations)
  };
}

function mapUserDto(row: Record<string, unknown>): AdminUserDto {
  return {
    id: String(row.id),
    username: String(row.username),
    displayName: typeof row.displayName === "string" ? row.displayName : undefined,
    role: String(row.role) as AdminUserRole,
    active: Number(row.active) === 1,
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt),
    passwordChangedAt: String(row.passwordChangedAt)
  };
}

function toDto(user: AdminUserRecord): AdminUserDto {
  const { hash: _hash, salt: _salt, iterations: _iterations, ...dto } = user;
  return dto;
}
