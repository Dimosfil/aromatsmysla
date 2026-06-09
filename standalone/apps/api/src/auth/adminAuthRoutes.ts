import type { FastifyInstance, FastifyReply } from "fastify";
import type {
  AdminChangePasswordRequest,
  AdminCreateUserRequest,
  AdminLoginRequest,
  AdminLoginResponse,
  AdminMeResponse,
  AdminResetPasswordRequest,
  AdminUpdateUserRequest,
  AdminUsersResponse
} from "@telegram-bot-template/shared";
import { AdminAuthError, type AdminAuthService, type AdminPermission } from "./AdminAuthService";

export function registerAdminAuthRoutes(server: FastifyInstance, auth: AdminAuthService): void {
  server.post<{ Body: AdminLoginRequest }>("/admin/login", async (request, reply): Promise<AdminLoginResponse | unknown> => {
    try {
      const result = await auth.login(request.body.username, request.body.password);
      return {
        token: result.token,
        username: result.user.username,
        role: result.user.role
      };
    } catch (error) {
      return sendAuthError(reply, error);
    }
  });

  server.get("/admin/me", async (request, reply): Promise<AdminMeResponse | unknown> => {
    try {
      return {
        user: await auth.authenticate(request.headers.authorization)
      };
    } catch (error) {
      return sendAuthError(reply, error);
    }
  });

  server.post<{ Body: AdminChangePasswordRequest }>("/admin/me/password", async (request, reply): Promise<unknown> => {
    try {
      const user = await auth.authenticate(request.headers.authorization);
      await auth.changeOwnPassword(user.id, request.body.currentPassword, request.body.newPassword);
      return reply.code(204).send();
    } catch (error) {
      return sendAuthError(reply, error);
    }
  });

  server.get("/admin/users", async (request, reply): Promise<AdminUsersResponse | unknown> => {
    try {
      await auth.authenticate(request.headers.authorization, "users:manage");
      return {
        users: await auth.listUsers()
      };
    } catch (error) {
      return sendAuthError(reply, error);
    }
  });

  server.post<{ Body: AdminCreateUserRequest }>("/admin/users", async (request, reply): Promise<unknown> => {
    try {
      await auth.authenticate(request.headers.authorization, "users:manage");
      return reply.code(201).send(await auth.createUser(request.body));
    } catch (error) {
      return sendAuthError(reply, error);
    }
  });

  server.patch<{ Params: { userId: string }; Body: AdminUpdateUserRequest }>(
    "/admin/users/:userId",
    async (request, reply): Promise<unknown> => {
      try {
        await auth.authenticate(request.headers.authorization, "users:manage");
        return auth.updateUser(request.params.userId, request.body);
      } catch (error) {
        return sendAuthError(reply, error);
      }
    }
  );

  server.post<{ Params: { userId: string }; Body: AdminResetPasswordRequest }>(
    "/admin/users/:userId/password",
    async (request, reply): Promise<unknown> => {
      try {
        await auth.authenticate(request.headers.authorization, "users:manage");
        await auth.resetUserPassword(request.params.userId, request.body.password);
        return reply.code(204).send();
      } catch (error) {
        return sendAuthError(reply, error);
      }
    }
  );
}

export async function requireAdminPermission(
  auth: AdminAuthService,
  authorization: string | undefined,
  permission: AdminPermission,
  reply: FastifyReply
): Promise<boolean> {
  try {
    await auth.authenticate(authorization, permission);
    return true;
  } catch (error) {
    sendAuthError(reply, error);
    return false;
  }
}

function sendAuthError(reply: FastifyReply, error: unknown): FastifyReply {
  if (error instanceof AdminAuthError) {
    return reply.code(error.statusCode).send({ error: error.message });
  }
  return reply.code(400).send({ error: error instanceof Error ? error.message : String(error) });
}
