import type { GuideBotAdminContent, GuideBotAdminGuide, GuideBotAdminMedia, GuideBotAdminMessages } from "@telegram-bot-template/shared";

type MessageKey = keyof GuideBotAdminMessages;
type MediaKey = keyof GuideBotAdminMedia;

export const messageFields: Array<{ key: MessageKey; label: string; mediaKey?: MediaKey }> = [
  { key: "welcomePrompt", label: "Первое сообщение /start", mediaKey: "welcomePhotoPath" },
  { key: "subscribePrompt", label: "Нет подписки", mediaKey: "subscribePhotoPath" },
  { key: "subscribedPrompt", label: "Экран выбора подарка" },
  { key: "deliveredPrefix", label: "Подпись перед файлом", mediaKey: "deliveredPhotoPath" },
  { key: "unavailableGuide", label: "Недоступный материал", mediaKey: "unavailableGuidePhotoPath" },
  { key: "subscriptionCheckError", label: "Ошибка проверки подписки", mediaKey: "subscriptionCheckErrorPhotoPath" },
  { key: "checkSubscriptionButton", label: "Кнопка проверки подписки" },
  { key: "channelButtonText", label: "Кнопка канала" }
];

export const emptyContent: GuideBotAdminContent = {
  requiredChannelUrl: "",
  selectionPhotoPath: "",
  messages: {
    welcomePrompt: "",
    subscribePrompt: "",
    subscribedPrompt: "",
    deliveredPrefix: "",
    unavailableGuide: "",
    subscriptionCheckError: "",
    checkSubscriptionButton: "",
    channelButtonText: ""
  },
  media: {},
  guides: []
};

export function createEmptyGuide(): GuideBotAdminGuide {
  return {
    id: "",
    title: "",
    filePath: "",
    fileName: "",
    photoPath: "",
    telegramFileId: "",
    telegramMessageLink: "",
    buttonPrefix: ""
  };
}

export function findLocalWorkstationFilePathWarnings(content: GuideBotAdminContent): string[] {
  const warnings: string[] = [];
  if (isLocalWorkstationPath(content.selectionPhotoPath)) {
    warnings.push("фото экрана выбора подарка");
  }

  for (const [key, value] of Object.entries(content.media)) {
    if (isLocalWorkstationPath(value)) {
      warnings.push(`медиа ${key}`);
    }
  }

  content.guides.forEach((guide, index) => {
    const hasTelegramFallback = Boolean(guide.telegramFileId?.trim() || guide.telegramMessageLink?.trim());
    if (isLocalWorkstationPath(guide.filePath) && !hasTelegramFallback) {
      warnings.push(guide.title.trim() || `материал ${index + 1}`);
    }
    if (isLocalWorkstationPath(guide.photoPath)) {
      warnings.push(`${guide.title.trim() || `материал ${index + 1}`}: фото`);
    }
  });

  return warnings;
}

function isLocalWorkstationPath(filePath: string | undefined): boolean {
  const normalized = filePath?.trim();
  if (!normalized) {
    return false;
  }

  return /^[a-zA-Z]:[\\/]/.test(normalized) || /^\\\\/.test(normalized) || /^\/(?:Users|home)\//.test(normalized);
}
