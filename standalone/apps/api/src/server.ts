import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { access, readFile } from "node:fs/promises";
import { extname, relative, resolve, sep } from "node:path";
import Fastify from "fastify";
import type { FastifyInstance, FastifyReply } from "fastify";
import { BusinessBotService, createExampleExtension } from "@telegram-bot-template/core";
import type {
  AdminLoginRequest,
  AdminLoginResponse,
  AdminStatsResponse,
  AdminUploadResponse,
  HealthResponse,
  GuideBotAdminContent,
  LeadDetailResponse,
  LeadListResponse,
  TelegramBotConfigRequest,
  TelegramBotConfigStatus,
  TelegramDiagnosticsResponse,
  TelegramInboundMessage
} from "@telegram-bot-template/shared";
import { type ApiConfig, loadApiConfig, type LoadApiConfigOptions } from "./config";
import { createAiRouter } from "./aiRouterFactory";
import { SqliteDatabase } from "./storage/SqliteDatabase";
import { SqliteAnalyticsRepository } from "./storage/SqliteAnalyticsRepository";
import { SqliteLeadRepository } from "./storage/SqliteLeadRepository";
import { SqliteSessionRepository } from "./storage/SqliteSessionRepository";
import { registerExtensions } from "./extensions/registerExtensions";
import { TelegramSubscriptionChecker } from "./TelegramSubscriptionChecker";
import { TelegramPollingGateway } from "./telegramPollingGateway";
import { applyAdminContentToRuntimeConfig, GuideBotAdminContentStore } from "./guideBotAdminContent";

export interface BuildServerOptions {
  config?: ApiConfig;
  configOptions?: LoadApiConfigOptions;
  sqliteSessionPath?: string;
  telegramFetch?: typeof fetch;
  telegramPollIntervalMs?: number;
  telegramRetryDelayMs?: number;
  adminContentOverlayEnabled?: boolean;
}

export function buildServer(options: BuildServerOptions = {}) {
  const config = options.config ?? loadApiConfig(options.configOptions);
  const adminContentOverlayEnabled = options.adminContentOverlayEnabled ?? !options.config;
  const guideBotConfig = config.guideBot
    ? {
        ...config.guideBot,
        copy: { ...config.guideBot.copy },
        media: { ...config.guideBot.media },
        guides: config.guideBot.guides.map((guide) => ({ ...guide }))
      }
    : null;
  const adminContentStore = new GuideBotAdminContentStore(
    config.guideBotContentPath,
    config.guideBotUploadDir,
    config.guideBotContentSeedPath
  );
  const adminSessions = new Set<string>();
  if (adminContentOverlayEnabled) {
    applyAdminContentToRuntimeConfig(guideBotConfig, adminContentStore.read(guideBotConfig));
  }
  const database = new SqliteDatabase({
    databasePath: options.sqliteSessionPath ?? config.sqliteSessionPath
  });
  const sessions = new SqliteSessionRepository(database);
  const leads = new SqliteLeadRepository(database);
  const analytics = new SqliteAnalyticsRepository(database);
  const subscriptionChecker = guideBotConfig
    ? new TelegramSubscriptionChecker(guideBotConfig.requiredChannelId, options.telegramFetch)
    : null;
  const server = Fastify({ logger: true });
  const businessGuideBot =
    guideBotConfig && subscriptionChecker
      ? {
          requiredChannelUrl: guideBotConfig.requiredChannelUrl,
          selectionPhotoPath: guideBotConfig.selectionPhotoPath,
          guides: guideBotConfig.guides,
          copy: guideBotConfig.copy,
          media: guideBotConfig.media,
          subscriptionChecker
        }
      : undefined;
  const businessBot = new BusinessBotService({
    sessions,
    leads,
    analytics,
    aiRouter: createAiRouter(config),
    guideBot: businessGuideBot
  });
  const telegramGateway = new TelegramPollingGateway((message) => businessBot.handleInboundMessage(message), {
    fetchFn: options.telegramFetch,
    pollIntervalMs: options.telegramPollIntervalMs,
    retryDelayMs: options.telegramRetryDelayMs
  });
  if (config.telegramBotToken) {
    subscriptionChecker?.configureToken(config.telegramBotToken);
  }
  if (config.telegramBotToken && config.telegramPollingEnabled) {
    telegramGateway.configureToken(config.telegramBotToken, "env");
  }

  server.addContentTypeParser("application/octet-stream", { parseAs: "buffer" }, (_request, body, done) => {
    done(null, body);
  });

  server.addHook("onRequest", async (request, reply) => {
    reply.header("Access-Control-Allow-Origin", "*");
    reply.header("Access-Control-Allow-Methods", "GET,POST,PUT,OPTIONS");
    reply.header("Access-Control-Allow-Headers", "Authorization,Content-Type,X-File-Name");

    if (request.method === "OPTIONS") {
      return reply.code(204).send();
    }
  });

  server.get("/health", async (): Promise<HealthResponse> => {
    return {
      status: "ok",
      service: "telegram-bot-template-api"
    };
  });

  server.get("/telegram/config", async (): Promise<TelegramBotConfigStatus> => {
    return telegramGateway.getStatus();
  });

  server.post<{ Body: AdminLoginRequest }>("/admin/login", async (request, reply): Promise<AdminLoginResponse | unknown> => {
    if (request.body.username !== config.adminUsername || request.body.password !== config.adminPassword) {
      return reply.code(401).send({ error: "Invalid username or password." });
    }

    const token = randomUUID();
    adminSessions.add(token);
    return {
      token,
      username: config.adminUsername
    };
  });

  server.get("/admin/guide-bot/content", async (request, reply): Promise<GuideBotAdminContent | unknown> => {
    if (!isAdminRequestAuthorized(request.headers.authorization, adminSessions)) {
      return reply.code(401).send({ error: "Admin login required." });
    }

    return adminContentStore.read(guideBotConfig);
  });

  server.get("/admin/stats", async (request, reply): Promise<AdminStatsResponse | unknown> => {
    if (!isAdminRequestAuthorized(request.headers.authorization, adminSessions)) {
      return reply.code(401).send({ error: "Admin login required." });
    }

    return analytics.getAdminStats();
  });

  server.put<{ Body: GuideBotAdminContent }>("/admin/guide-bot/content", async (request, reply): Promise<GuideBotAdminContent | unknown> => {
    if (!isAdminRequestAuthorized(request.headers.authorization, adminSessions)) {
      return reply.code(401).send({ error: "Admin login required." });
    }

    try {
      const content = adminContentStore.write(request.body);
      applyAdminContentToRuntimeConfig(guideBotConfig, content);
      if (businessGuideBot && guideBotConfig) {
        businessGuideBot.requiredChannelUrl = guideBotConfig.requiredChannelUrl;
        businessGuideBot.selectionPhotoPath = guideBotConfig.selectionPhotoPath;
        businessGuideBot.guides = guideBotConfig.guides;
        businessGuideBot.copy = guideBotConfig.copy;
        businessGuideBot.media = guideBotConfig.media;
      }
      return content;
    } catch (error) {
      return reply.code(400).send({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  server.post<{ Headers: { "x-file-name"?: string }; Body: Buffer }>(
    "/admin/guide-bot/uploads",
    { bodyLimit: config.guideBotUploadMaxBytes },
    async (request, reply): Promise<AdminUploadResponse | unknown> => {
      if (!isAdminRequestAuthorized(request.headers.authorization, adminSessions)) {
        return reply.code(401).send({ error: "Admin login required." });
      }

      const fileName = request.headers["x-file-name"];
      if (!fileName) {
        return reply.code(400).send({ error: "X-File-Name header is required." });
      }

      try {
        const filePath = adminContentStore.writeUpload(fileName, request.body);
        return {
          filePath,
          fileName
        };
      } catch (error) {
        return reply.code(400).send({ error: error instanceof Error ? error.message : String(error) });
      }
    }
  );

  server.post<{ Body: TelegramBotConfigRequest }>("/telegram/config", async (request, reply) => {
    try {
      subscriptionChecker?.configureToken(request.body.token);
      return telegramGateway.configureToken(request.body.token);
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  server.post<{ Body: TelegramInboundMessage }>("/telegram/inbound", async (request) => {
    return businessBot.handleInboundMessage(request.body);
  });

  server.get<{ Querystring: { limit?: string } }>("/leads", async (request): Promise<LeadListResponse> => {
    const rawLimit = request.query.limit ? Number(request.query.limit) : 20;
    const limit = Number.isFinite(rawLimit) ? rawLimit : 20;
    return {
      leads: await leads.listRecent(limit)
    };
  });

  server.get<{ Params: { leadId: string } }>("/leads/:leadId", async (request): Promise<LeadDetailResponse> => {
    const lead = await leads.findById(request.params.leadId);
    return {
      found: Boolean(lead),
      lead
    };
  });

  server.get("/debug/telegram/diagnostics", async (): Promise<TelegramDiagnosticsResponse> => {
    const cases = await Promise.all(
      ["/start", "/ozon", "/lead", "/unknown"].map(async (command) => {
        const response = await businessBot.handleInboundMessage({
          chatId: "diagnostic-chat",
          userId: `diagnostic-${command.slice(1) || "empty"}`,
          username: "diagnostic",
          text: command
        });
        return {
          command,
          status: response.status,
          text: response.text
        };
      })
    );

    return {
      config: telegramGateway.getStatus(),
      cases
    };
  });

  server.get<{ Params: { userId: string } }>("/debug/sessions/:userId", async (request) => {
    const session = await sessions.findByUserId(request.params.userId);
    return {
      found: Boolean(session),
      session
    };
  });

  void registerExtensions(server, [createExampleExtension()]);
  registerAdminWebRoutes(server, config.adminWebDir);

  server.addHook("onClose", async () => {
    telegramGateway.stop();
    await database.close();
  });

  return server;
}

function isAdminRequestAuthorized(authorization: string | undefined, sessions: Set<string>): boolean {
  const [scheme, token] = authorization?.split(" ") ?? [];
  return scheme === "Bearer" && Boolean(token) && sessions.has(token);
}

function registerAdminWebRoutes(server: FastifyInstance, adminWebDir: string | null): void {
  if (!adminWebDir) {
    server.log.debug("Admin web dir is not configured; admin panel routes are disabled.");
    return;
  }

  const rootDir = resolveAdminWebRoot(adminWebDir);
  server.log.info({ adminWebDir, rootDir }, "Admin web routes enabled.");

  server.get("/", async (_request, reply) => {
    return sendAdminWebFile(reply, rootDir, "index.html");
  });

  server.get<{ Params: { "*": string } }>("/*", async (request, reply) => {
    const requestedPath = request.params["*"] || "index.html";
    if (await trySendAdminWebFile(reply, rootDir, requestedPath)) {
      return reply;
    }

    return sendAdminWebFile(reply, rootDir, "index.html");
  });
}

function resolveAdminWebRoot(adminWebDir: string): string {
  const candidates = [
    adminWebDir,
    "/app/apps/web/dist",
    "/app/standalone/apps/web/dist",
    resolve(process.cwd(), "apps/web/dist"),
    resolve(process.cwd(), "standalone/apps/web/dist")
  ];
  const rootDir = candidates.find((candidate) => existsSync(resolve(candidate, "index.html")));
  return resolve(rootDir ?? adminWebDir);
}

async function sendAdminWebFile(reply: FastifyReply, rootDir: string, requestedPath: string) {
  if (await trySendAdminWebFile(reply, rootDir, requestedPath)) {
    return reply;
  }

  return reply.code(404).send({ error: "Not found." });
}

async function trySendAdminWebFile(reply: FastifyReply, rootDir: string, requestedPath: string): Promise<boolean> {
  const normalizedPath = requestedPath.replaceAll("\\", "/");
  const filePath = resolve(rootDir, normalizedPath);
  const relativePath = relative(rootDir, filePath);
  if (relativePath.startsWith("..") || relativePath === "" || relativePath.split(sep).includes("..")) {
    return false;
  }

  try {
    await access(filePath);
    reply.type(getContentType(filePath)).send(await readFile(filePath));
    return true;
  } catch {
    return false;
  }
}

function getContentType(filePath: string): string {
  switch (extname(filePath).toLowerCase()) {
    case ".css":
      return "text/css; charset=utf-8";
    case ".html":
      return "text/html; charset=utf-8";
    case ".js":
      return "text/javascript; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".svg":
      return "image/svg+xml";
    case ".webp":
      return "image/webp";
    default:
      return "application/octet-stream";
  }
}
