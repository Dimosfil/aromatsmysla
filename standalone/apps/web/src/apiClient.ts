import type {
  AdminChangePasswordRequest,
  AdminCreateUserRequest,
  AdminLoginResponse,
  AdminMeResponse,
  AdminResetPasswordRequest,
  AdminStatsResponse,
  AdminUpdateUserRequest,
  AdminUploadResponse,
  AdminUserDto,
  AdminUsersResponse,
  GuideBotAdminContent
} from "@telegram-bot-template/shared";

const apiBaseUrl = import.meta.env.VITE_API_URL ?? "";

export const tokenStorageKey = "guide-bot-admin-token";

export async function login(username: string, password: string): Promise<AdminLoginResponse> {
  const response = await fetch(`${apiBaseUrl}/admin/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username, password })
  });
  return readApiResponse<AdminLoginResponse>(response);
}

export async function fetchMe(token: string): Promise<AdminMeResponse> {
  const response = await fetch(`${apiBaseUrl}/admin/me`, {
    headers: createAuthHeaders(token)
  });
  return readApiResponse<AdminMeResponse>(response);
}

export async function fetchContent(token: string): Promise<GuideBotAdminContent> {
  const response = await fetch(`${apiBaseUrl}/admin/guide-bot/content`, {
    headers: createAuthHeaders(token)
  });
  return readApiResponse<GuideBotAdminContent>(response);
}

export async function saveContent(token: string, content: GuideBotAdminContent): Promise<GuideBotAdminContent> {
  const response = await fetch(`${apiBaseUrl}/admin/guide-bot/content`, {
    method: "PUT",
    headers: {
      ...createAuthHeaders(token),
      "content-type": "application/json"
    },
    body: JSON.stringify(content)
  });
  return readApiResponse<GuideBotAdminContent>(response);
}

export async function fetchStats(token: string): Promise<AdminStatsResponse> {
  const response = await fetch(`${apiBaseUrl}/admin/stats`, {
    headers: createAuthHeaders(token)
  });
  return readApiResponse<AdminStatsResponse>(response);
}

export async function fetchUsers(token: string): Promise<AdminUsersResponse> {
  const response = await fetch(`${apiBaseUrl}/admin/users`, {
    headers: createAuthHeaders(token)
  });
  return readApiResponse<AdminUsersResponse>(response);
}

export async function createUser(token: string, user: AdminCreateUserRequest): Promise<AdminUserDto> {
  const response = await fetch(`${apiBaseUrl}/admin/users`, {
    method: "POST",
    headers: {
      ...createAuthHeaders(token),
      "content-type": "application/json"
    },
    body: JSON.stringify(user)
  });
  return readApiResponse<AdminUserDto>(response);
}

export async function updateUser(token: string, userId: string, patch: AdminUpdateUserRequest): Promise<AdminUserDto> {
  const response = await fetch(`${apiBaseUrl}/admin/users/${userId}`, {
    method: "PATCH",
    headers: {
      ...createAuthHeaders(token),
      "content-type": "application/json"
    },
    body: JSON.stringify(patch)
  });
  return readApiResponse<AdminUserDto>(response);
}

export async function changePassword(token: string, request: AdminChangePasswordRequest): Promise<void> {
  const response = await fetch(`${apiBaseUrl}/admin/me/password`, {
    method: "POST",
    headers: {
      ...createAuthHeaders(token),
      "content-type": "application/json"
    },
    body: JSON.stringify(request)
  });
  await readApiResponse<void>(response);
}

export async function resetUserPassword(token: string, userId: string, request: AdminResetPasswordRequest): Promise<void> {
  const response = await fetch(`${apiBaseUrl}/admin/users/${userId}/password`, {
    method: "POST",
    headers: {
      ...createAuthHeaders(token),
      "content-type": "application/json"
    },
    body: JSON.stringify(request)
  });
  await readApiResponse<void>(response);
}

export async function uploadFile(token: string, file: File): Promise<AdminUploadResponse> {
  const response = await fetch(`${apiBaseUrl}/admin/guide-bot/uploads`, {
    method: "POST",
    headers: {
      ...createAuthHeaders(token),
      "content-type": "application/octet-stream",
      "x-file-name": encodeURIComponent(file.name)
    },
    body: await file.arrayBuffer()
  });
  return readApiResponse<AdminUploadResponse>(response);
}

function createAuthHeaders(token: string): Record<string, string> {
  return {
    authorization: `Bearer ${token}`
  };
}

async function readApiResponse<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!response.ok) {
    throw new ApiRequestError(body?.error ?? `API request failed: ${response.status}`, response.status);
  }

  return body as T;
}

class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

export function isUnauthorizedError(error: unknown): boolean {
  return error instanceof ApiRequestError && error.status === 401;
}
