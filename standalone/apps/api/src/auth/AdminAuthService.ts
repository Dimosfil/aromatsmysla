import { randomUUID } from "node:crypto";
import type {
  AdminCreateUserRequest,
  AdminUpdateUserRequest,
  AdminUserDto,
  AdminUserRole
} from "@telegram-bot-template/shared";
import { hashPassword, verifyPassword } from "./passwords";
import { type AdminUserRecord, SqliteAdminAuthRepository } from "./SqliteAdminAuthRepository";

export type AdminPermission = "content:read" | "content:write" | "stats:read" | "users:manage";

const rolePermissions: Record<AdminUserRole, AdminPermission[]> = {
  owner: ["content:read", "content:write", "stats:read", "users:manage"],
  admin: ["content:read", "content:write", "stats:read", "users:manage"],
  editor: ["content:read", "content:write", "stats:read"],
  viewer: ["content:read", "stats:read"]
};

const validRoles = new Set<AdminUserRole>(["owner", "admin", "editor", "viewer"]);
const sessionTtlMs = 1000 * 60 * 60 * 12;

export class AdminAuthError extends Error {
  constructor(
    readonly statusCode: number,
    message: string
  ) {
    super(message);
    this.name = "AdminAuthError";
  }
}

export class AdminAuthService {
  constructor(
    private readonly repository: SqliteAdminAuthRepository,
    private readonly bootstrap: { username: string; password: string }
  ) {}

  async ensureBootstrapOwner(): Promise<void> {
    if ((await this.repository.countUsers()) > 0) {
      return;
    }

    await this.repository.createUser({
      id: randomUUID(),
      username: normalizeUsername(this.bootstrap.username),
      role: "owner",
      active: true,
      password: hashPassword(this.bootstrap.password),
      now: new Date().toISOString()
    });
  }

  async login(username: string, password: string): Promise<{ token: string; user: AdminUserDto }> {
    await this.ensureBootstrapOwner();
    const user = await this.repository.findUserByUsername(normalizeUsername(username));
    if (!user || !user.active || !verifyPassword(password, user)) {
      throw new AdminAuthError(401, "Invalid username or password.");
    }

    const now = new Date();
    const token = randomUUID();
    await this.repository.createSession({
      token,
      userId: user.id,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + sessionTtlMs).toISOString()
    });
    return { token, user: toDto(user) };
  }

  async authenticate(authorization: string | undefined, permission?: AdminPermission): Promise<AdminUserDto> {
    await this.ensureBootstrapOwner();
    const [scheme, token] = authorization?.split(" ") ?? [];
    if (scheme !== "Bearer" || !token) {
      throw new AdminAuthError(401, "Admin login required.");
    }

    const user = await this.repository.findUserBySessionToken(token, new Date().toISOString());
    if (!user) {
      throw new AdminAuthError(401, "Admin login required.");
    }

    if (permission && !hasPermission(user.role, permission)) {
      throw new AdminAuthError(403, "Insufficient permissions.");
    }

    return toDto(user);
  }

  async listUsers(): Promise<AdminUserDto[]> {
    return this.repository.listUsers();
  }

  async createUser(request: AdminCreateUserRequest): Promise<AdminUserDto> {
    const username = normalizeUsername(request.username);
    const role = normalizeRole(request.role);
    validateUsername(username);
    validatePassword(request.password);

    return this.repository.createUser({
      id: randomUUID(),
      username,
      displayName: normalizeOptionalText(request.displayName),
      role,
      active: true,
      password: hashPassword(request.password),
      now: new Date().toISOString()
    });
  }

  async updateUser(userId: string, patch: AdminUpdateUserRequest): Promise<AdminUserDto> {
    const existing = await this.repository.findUserById(userId);
    if (!existing) {
      throw new AdminAuthError(404, "Admin user not found.");
    }

    const normalizedPatch: AdminUpdateUserRequest = {};
    if (patch.username !== undefined) {
      const username = normalizeUsername(patch.username);
      validateUsername(username);
      normalizedPatch.username = username;
    }
    if (patch.displayName !== undefined) {
      normalizedPatch.displayName = normalizeOptionalText(patch.displayName);
    }
    if (patch.role !== undefined) {
      normalizedPatch.role = normalizeRole(patch.role);
    }
    if (patch.active !== undefined) {
      normalizedPatch.active = Boolean(patch.active);
    }

    await this.assertOwnerIsPreserved(existing, normalizedPatch);
    const updated = await this.repository.updateUser(userId, {
      ...normalizedPatch,
      updatedAt: new Date().toISOString()
    });
    if (!updated) {
      throw new AdminAuthError(404, "Admin user not found.");
    }
    if (normalizedPatch.active === false) {
      await this.repository.revokeSessionsForUser(userId, new Date().toISOString());
    }
    return updated;
  }

  async changeOwnPassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.repository.findUserById(userId);
    if (!user || !user.active) {
      throw new AdminAuthError(404, "Admin user not found.");
    }
    if (!verifyPassword(currentPassword, user)) {
      throw new AdminAuthError(400, "Current password is incorrect.");
    }
    await this.setUserPassword(userId, newPassword);
  }

  async resetUserPassword(userId: string, password: string): Promise<void> {
    const user = await this.repository.findUserById(userId);
    if (!user) {
      throw new AdminAuthError(404, "Admin user not found.");
    }
    await this.setUserPassword(userId, password);
  }

  private async setUserPassword(userId: string, password: string): Promise<void> {
    validatePassword(password);
    const now = new Date().toISOString();
    await this.repository.updatePassword(userId, hashPassword(password), now);
    await this.repository.revokeSessionsForUser(userId, now);
  }

  private async assertOwnerIsPreserved(existing: AdminUserRecord, patch: AdminUpdateUserRequest): Promise<void> {
    const nextRole = patch.role ?? existing.role;
    const nextActive = patch.active ?? existing.active;
    if (existing.role === "owner" && (nextRole !== "owner" || !nextActive)) {
      const remainingOwners = await this.repository.countActiveOwners(existing.id);
      if (remainingOwners === 0) {
        throw new AdminAuthError(400, "At least one active owner is required.");
      }
    }
  }
}

export function hasPermission(role: AdminUserRole, permission: AdminPermission): boolean {
  return rolePermissions[role]?.includes(permission) ?? false;
}

function normalizeRole(role: AdminUserRole): AdminUserRole {
  if (!validRoles.has(role)) {
    throw new AdminAuthError(400, "Role must be one of: owner, admin, editor, viewer.");
  }
  return role;
}

function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

function normalizeOptionalText(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized || undefined;
}

function validateUsername(username: string): void {
  if (!/^[a-z0-9._-]{3,64}$/.test(username)) {
    throw new AdminAuthError(400, "Username must be 3-64 characters and use letters, numbers, dot, underscore, or dash.");
  }
}

function validatePassword(password: string): void {
  if (password.length < 8) {
    throw new AdminAuthError(400, "Password must be at least 8 characters.");
  }
}

function toDto(user: AdminUserRecord): AdminUserDto {
  const { hash: _hash, salt: _salt, iterations: _iterations, ...dto } = user;
  return dto;
}
