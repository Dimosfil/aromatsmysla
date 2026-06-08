import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, extname, resolve } from "node:path";
import type { GuideBotAdminContent, GuideBotAdminGuide } from "@telegram-bot-template/shared";
import type { GuideBotRuntimeConfig } from "./config";

const allowedUploadExtensions = new Set([".jpg", ".jpeg", ".png", ".webp", ".pdf"]);

export class GuideBotAdminContentStore {
  constructor(
    private readonly contentPath: string,
    private readonly uploadDir: string
  ) {}

  read(baseConfig: GuideBotRuntimeConfig | null): GuideBotAdminContent {
    const baseContent = createContentFromRuntimeConfig(baseConfig);
    const savedContent = this.readSavedContent();
    if (!savedContent) {
      return baseContent;
    }

    return normalizeAdminContent({
      requiredChannelUrl: savedContent.requiredChannelUrl ?? baseContent.requiredChannelUrl,
      selectionPhotoPath: savedContent.selectionPhotoPath ?? baseContent.selectionPhotoPath,
      messages: {
        ...baseContent.messages,
        ...savedContent.messages
      },
      media: {
        ...baseContent.media,
        ...savedContent.media
      },
      guides: savedContent.guides?.length ? savedContent.guides : baseContent.guides
    });
  }

  write(content: GuideBotAdminContent): GuideBotAdminContent {
    const normalized = normalizeAdminContent(content);
    mkdirSync(resolve(this.contentPath, ".."), { recursive: true });
    writeFileSync(this.contentPath, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
    return normalized;
  }

  writeUpload(fileName: string, body: Buffer): string {
    const safeName = createSafeUploadName(fileName);
    mkdirSync(this.uploadDir, { recursive: true });
    const filePath = resolve(this.uploadDir, safeName);
    writeFileSync(filePath, body);
    return filePath;
  }

  private readSavedContent(): Partial<GuideBotAdminContent> | null {
    if (!existsSync(this.contentPath)) {
      return null;
    }

    const parsed = JSON.parse(readFileSync(this.contentPath, "utf8")) as Partial<GuideBotAdminContent>;
    return parsed && typeof parsed === "object" ? parsed : null;
  }
}

export function createContentFromRuntimeConfig(config: GuideBotRuntimeConfig | null): GuideBotAdminContent {
  return normalizeAdminContent({
    requiredChannelUrl: config?.requiredChannelUrl,
    selectionPhotoPath: config?.selectionPhotoPath,
    messages: {
      welcomePrompt: config?.copy.welcomePrompt ?? "",
      subscribePrompt: config?.copy.subscribePrompt ?? "",
      subscribedPrompt: config?.copy.subscribedPrompt ?? "",
      deliveredPrefix: config?.copy.deliveredPrefix ?? "",
      unavailableGuide: config?.copy.unavailableGuide ?? "",
      subscriptionCheckError: config?.copy.subscriptionCheckError ?? "",
      checkSubscriptionButton: config?.copy.checkSubscriptionButton ?? "",
      channelButtonText: config?.copy.channelButtonText ?? ""
    },
    media: {
      welcomePhotoPath: config?.media?.welcomePhotoPath,
      subscribePhotoPath: config?.media?.subscribePhotoPath,
      subscriptionCheckErrorPhotoPath: config?.media?.subscriptionCheckErrorPhotoPath,
      unavailableGuidePhotoPath: config?.media?.unavailableGuidePhotoPath,
      deliveredPhotoPath: config?.media?.deliveredPhotoPath
    },
    guides: config?.guides ?? []
  });
}

export function applyAdminContentToRuntimeConfig(
  config: GuideBotRuntimeConfig | null,
  content: GuideBotAdminContent
): GuideBotRuntimeConfig | null {
  if (!config) {
    return null;
  }

  const normalized = normalizeAdminContent(content);
  config.requiredChannelUrl = normalized.requiredChannelUrl;
  config.selectionPhotoPath = normalized.selectionPhotoPath;
  config.copy = normalized.messages;
  config.media = normalized.media;
  config.guides = normalized.guides;
  return config;
}

function normalizeAdminContent(content: GuideBotAdminContent): GuideBotAdminContent {
  return {
    requiredChannelUrl: normalizeOptionalString(content.requiredChannelUrl),
    selectionPhotoPath: normalizeOptionalString(content.selectionPhotoPath),
    messages: {
      welcomePrompt: content.messages?.welcomePrompt ?? "",
      subscribePrompt: content.messages?.subscribePrompt ?? "",
      subscribedPrompt: content.messages?.subscribedPrompt ?? "",
      deliveredPrefix: content.messages?.deliveredPrefix ?? "",
      unavailableGuide: content.messages?.unavailableGuide ?? "",
      subscriptionCheckError: content.messages?.subscriptionCheckError ?? "",
      checkSubscriptionButton: content.messages?.checkSubscriptionButton ?? "",
      channelButtonText: content.messages?.channelButtonText ?? ""
    },
    media: {
      welcomePhotoPath: normalizeOptionalString(content.media?.welcomePhotoPath),
      subscribePhotoPath: normalizeOptionalString(content.media?.subscribePhotoPath),
      subscriptionCheckErrorPhotoPath: normalizeOptionalString(content.media?.subscriptionCheckErrorPhotoPath),
      unavailableGuidePhotoPath: normalizeOptionalString(content.media?.unavailableGuidePhotoPath),
      deliveredPhotoPath: normalizeOptionalString(content.media?.deliveredPhotoPath)
    },
    guides: (content.guides ?? []).map(normalizeGuide).filter((guide) => guide.id || guide.title || guide.filePath)
  };
}

function normalizeGuide(guide: GuideBotAdminGuide): GuideBotAdminGuide {
  return {
    id: guide.id.trim(),
    title: guide.title.trim(),
    buttonPrefix: normalizeOptionalString(guide.buttonPrefix),
    filePath: guide.filePath.trim()
  };
}

function normalizeOptionalString(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized || undefined;
}

function createSafeUploadName(fileName: string): string {
  const rawBase = basename(fileName || "upload.bin");
  const extension = extname(rawBase).toLowerCase();
  if (!allowedUploadExtensions.has(extension)) {
    throw new Error("Only jpg, png, webp, and pdf uploads are supported.");
  }

  const nameWithoutExtension = rawBase.slice(0, -extension.length);
  const safeBase = nameWithoutExtension.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "upload";
  return `${Date.now()}-${safeBase}${extension}`;
}
