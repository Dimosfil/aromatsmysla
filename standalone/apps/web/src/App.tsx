import { FormEvent, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type {
  AdminLoginResponse,
  AdminStatsResponse,
  AdminUploadResponse,
  GuideBotAdminContent,
  GuideBotAdminGuide,
  GuideBotAdminMedia,
  GuideBotAdminMessages
} from "@telegram-bot-template/shared";

const apiBaseUrl = import.meta.env.VITE_API_URL ?? "";
const tokenStorageKey = "guide-bot-admin-token";

type MessageKey = keyof GuideBotAdminMessages;
type MediaKey = keyof GuideBotAdminMedia;
type SaveState = "idle" | "saving" | "saved" | "error";
type ActiveTab = "content" | "stats";

const messageFields: Array<{ key: MessageKey; label: string; mediaKey?: MediaKey }> = [
  { key: "welcomePrompt", label: "Первое сообщение /start", mediaKey: "welcomePhotoPath" },
  { key: "subscribePrompt", label: "Нет подписки", mediaKey: "subscribePhotoPath" },
  { key: "subscribedPrompt", label: "Экран выбора подарка" },
  { key: "deliveredPrefix", label: "Подпись перед файлом", mediaKey: "deliveredPhotoPath" },
  { key: "unavailableGuide", label: "Недоступный материал", mediaKey: "unavailableGuidePhotoPath" },
  { key: "subscriptionCheckError", label: "Ошибка проверки подписки", mediaKey: "subscriptionCheckErrorPhotoPath" },
  { key: "checkSubscriptionButton", label: "Кнопка проверки подписки" },
  { key: "channelButtonText", label: "Кнопка канала" }
];

const emptyContent: GuideBotAdminContent = {
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

async function login(username: string, password: string): Promise<AdminLoginResponse> {
  const response = await fetch(`${apiBaseUrl}/admin/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username, password })
  });
  return readApiResponse<AdminLoginResponse>(response);
}

async function fetchContent(token: string): Promise<GuideBotAdminContent> {
  const response = await fetch(`${apiBaseUrl}/admin/guide-bot/content`, {
    headers: createAuthHeaders(token)
  });
  return readApiResponse<GuideBotAdminContent>(response);
}

async function saveContent(token: string, content: GuideBotAdminContent): Promise<GuideBotAdminContent> {
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

async function fetchStats(token: string): Promise<AdminStatsResponse> {
  const response = await fetch(`${apiBaseUrl}/admin/stats`, {
    headers: createAuthHeaders(token)
  });
  return readApiResponse<AdminStatsResponse>(response);
}

async function uploadFile(token: string, file: File): Promise<AdminUploadResponse> {
  const response = await fetch(`${apiBaseUrl}/admin/guide-bot/uploads`, {
    method: "POST",
    headers: {
      ...createAuthHeaders(token),
      "content-type": "application/octet-stream",
      "x-file-name": file.name
    },
    body: await file.arrayBuffer()
  });
  return readApiResponse<AdminUploadResponse>(response);
}

export function App() {
  const [token, setToken] = useState(() => localStorage.getItem(tokenStorageKey) ?? "");
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [draft, setDraft] = useState<GuideBotAdminContent>(emptyContent);
  const [saveStatus, setSaveStatus] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [uploadStatus, setUploadStatus] = useState("");
  const [activeTab, setActiveTab] = useState<ActiveTab>("content");

  const contentQuery = useQuery({
    queryKey: ["guide-bot-admin-content", token],
    queryFn: () => fetchContent(token),
    enabled: Boolean(token)
  });
  const statsQuery = useQuery({
    queryKey: ["guide-bot-admin-stats", token],
    queryFn: () => fetchStats(token),
    enabled: Boolean(token) && activeTab === "stats"
  });

  useEffect(() => {
    if (contentQuery.data) {
      setDraft(contentQuery.data);
    }
  }, [contentQuery.data]);

  useEffect(() => {
    if (isUnauthorizedError(contentQuery.error) || isUnauthorizedError(statsQuery.error)) {
      localStorage.removeItem(tokenStorageKey);
      setToken("");
      setLoginError("Сессия устарела. Войдите еще раз.");
    }
  }, [contentQuery.error, statsQuery.error]);

  const hasSession = Boolean(token);
  const isSaving = saveState === "saving";
  const isSyncing = contentQuery.isFetching || statsQuery.isFetching;
  const canSave = useMemo(() => hasSession && !contentQuery.isLoading && !isSaving, [contentQuery.isLoading, hasSession, isSaving]);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoginError("");
    try {
      const result = await login(username.trim(), password);
      localStorage.setItem(tokenStorageKey, result.token);
      setToken(result.token);
      setPassword("");
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : String(error));
    }
  }

  async function handleSave(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (!token) {
      return;
    }

    setSaveState("saving");
    setSaveStatus("Сохраняю...");
    try {
      const saved = await saveContent(token, draft);
      setDraft(saved);
      setSaveState("saved");
      setSaveStatus("Сохранено. Бот использует новые значения без перезапуска API.");
      await contentQuery.refetch();
    } catch (error) {
      setSaveState("error");
      setSaveStatus(error instanceof Error ? error.message : String(error));
      if (isUnauthorizedError(error)) {
        localStorage.removeItem(tokenStorageKey);
        setToken("");
        setLoginError("Сессия устарела. Войдите еще раз.");
      }
    }
  }

  async function handleUpload(file: File | undefined, onPath: (filePath: string) => void) {
    if (!file || !token) {
      return;
    }

    setUploadStatus(`Загружаю ${file.name}...`);
    try {
      const result = await uploadFile(token, file);
      onPath(result.filePath);
      setUploadStatus(`Загружено: ${result.fileName}`);
    } catch (error) {
      setUploadStatus(error instanceof Error ? error.message : String(error));
    }
  }

  function logout() {
    localStorage.removeItem(tokenStorageKey);
    setToken("");
    setDraft(emptyContent);
  }

  if (!hasSession) {
    return (
      <main className="app-shell compact-shell">
        <section className="login-panel">
          <p className="eyebrow">Aroma guide bot</p>
          <h1>Админка бота</h1>
          <form className="inline-form" onSubmit={handleLogin}>
            <label htmlFor="admin-login">Логин</label>
            <input id="admin-login" value={username} onChange={(event) => setUsername(event.target.value)} />
            <label htmlFor="admin-password">Пароль</label>
            <input
              id="admin-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            {loginError ? <p className="field-error">{loginError}</p> : null}
            <button type="submit" className="primary-action">
              Войти
            </button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Aroma guide bot</p>
            <h1>{activeTab === "stats" ? "Статистика бота" : "Контент бота"}</h1>
          </div>
          <div className="topbar-actions">
            <span className="status">{isSyncing ? "syncing" : "ready"}</span>
            <button
              type="button"
              className="secondary-action"
              onClick={() => (activeTab === "stats" ? void statsQuery.refetch() : void contentQuery.refetch())}
            >
              Обновить
            </button>
            <button type="button" className="secondary-action" onClick={logout}>
              Выйти
            </button>
          </div>
        </header>

        <nav className="admin-tabs" aria-label="Admin sections">
          <button
            type="button"
            className={activeTab === "content" ? "tab-button active" : "tab-button"}
            onClick={() => setActiveTab("content")}
          >
            Контент
          </button>
          <button
            type="button"
            className={activeTab === "stats" ? "tab-button active" : "tab-button"}
            onClick={() => setActiveTab("stats")}
          >
            Статистика
          </button>
        </nav>

        {activeTab === "content" && contentQuery.isError ? <p className="field-error">{String(contentQuery.error)}</p> : null}
        {activeTab === "stats" && statsQuery.isError ? <p className="field-error">{String(statsQuery.error)}</p> : null}

        {activeTab === "stats" ? (
          <StatsPanel stats={statsQuery.data} isLoading={statsQuery.isLoading} onRefresh={() => void statsQuery.refetch()} />
        ) : (
          <form className="admin-layout" onSubmit={(event) => void handleSave(event)}>
            <section className="editor-section">
              <div className="section-heading">
                <h2>Сообщения</h2>
                <div className="save-controls">
                  {saveStatus ? <span className={`save-status ${saveState}`}>{saveStatus}</span> : null}
                  <button type="submit" className="primary-action save-action" disabled={!canSave}>
                    {isSaving ? <span className="button-spinner" aria-hidden="true" /> : null}
                    {isSaving ? "Сохраняю..." : "Сохранить"}
                  </button>
                </div>
              </div>
              {isSaving ? <div className="save-progress" aria-label="Сохранение выполняется" /> : null}

              <article className="editor-card">
                <label htmlFor="channel-url">Ссылка на канал</label>
                <input
                  id="channel-url"
                  value={draft.requiredChannelUrl ?? ""}
                  onChange={(event) => setDraft({ ...draft, requiredChannelUrl: event.target.value })}
                  placeholder="https://t.me/channel"
                />
              </article>

              {messageFields.map((field) => (
                <article className="editor-card" key={field.key}>
                  <label htmlFor={field.key}>{field.label}</label>
                  <textarea
                    id={field.key}
                    value={draft.messages[field.key]}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        messages: {
                          ...draft.messages,
                          [field.key]: event.target.value
                        }
                      })
                    }
                    rows={field.key.endsWith("Button") || field.key === "deliveredPrefix" ? 2 : 6}
                  />
                  {field.mediaKey ? (
                    <PathUpload
                      label="Фото к сообщению"
                      value={draft.media[field.mediaKey] ?? ""}
                      accept="image/jpeg,image/png,image/webp"
                      onPathChange={(filePath) =>
                        setDraft({
                          ...draft,
                          media: {
                            ...draft.media,
                            [field.mediaKey!]: filePath
                          }
                        })
                      }
                      onUpload={(file, onPath) => void handleUpload(file, onPath)}
                    />
                  ) : null}
                </article>
              ))}
            </section>

            <section className="editor-section">
              <div className="section-heading">
                <h2>Материалы</h2>
                <button
                  type="button"
                  className="secondary-action"
                  onClick={() => setDraft({ ...draft, guides: [...draft.guides, createEmptyGuide()] })}
                >
                  Добавить
                </button>
              </div>

              <article className="editor-card">
                <PathUpload
                  label="Фото экрана выбора подарка"
                  value={draft.selectionPhotoPath ?? ""}
                  accept="image/jpeg,image/png,image/webp"
                  onPathChange={(filePath) => setDraft({ ...draft, selectionPhotoPath: filePath })}
                  onUpload={(file, onPath) => void handleUpload(file, onPath)}
                />
              </article>

              {draft.guides.map((guide, index) => (
                <GuideEditor
                  key={`${guide.id}-${index}`}
                  guide={guide}
                  index={index}
                  onChange={(nextGuide) =>
                    setDraft({
                      ...draft,
                      guides: draft.guides.map((item, itemIndex) => (itemIndex === index ? nextGuide : item))
                    })
                  }
                  onRemove={() =>
                    setDraft({
                      ...draft,
                      guides: draft.guides.filter((_item, itemIndex) => itemIndex !== index)
                    })
                  }
                  onUpload={(file, onPath) => void handleUpload(file, onPath)}
                />
              ))}

              {uploadStatus ? <p className="setup-status">{uploadStatus}</p> : null}
            </section>
          </form>
        )}
      </section>
    </main>
  );
}

function StatsPanel({
  stats,
  isLoading,
  onRefresh
}: {
  stats?: AdminStatsResponse;
  isLoading: boolean;
  onRefresh: () => void;
}) {
  const [selectedError, setSelectedError] = useState<AdminStatsResponse["recentErrors"][number] | null>(null);
  const maxFunnel = Math.max(...(stats?.funnel.map((step) => step.count) ?? [0]), 1);
  const recentErrors = stats?.recentErrors ?? [];

  return (
    <section className="stats-layout">
      <div className="section-heading">
        <h2>Статистика</h2>
        <button type="button" className="secondary-action" onClick={onRefresh}>
          Обновить
        </button>
      </div>

      {isLoading ? <div className="save-progress" aria-label="Загрузка статистики" /> : null}

      <div className="stats-grid">
        <MetricCard label="Пользователи" value={stats?.overview.totalUsers ?? 0} />
        <MetricCard label="/start" value={stats?.overview.starts ?? 0} />
        <MetricCard label="Проверки" value={stats?.overview.subscriptionChecks ?? 0} />
        <MetricCard label="Подписка ok" value={stats?.overview.subscriptionVerified ?? 0} />
        <MetricCard label="Клики подарков" value={stats?.overview.guideClicks ?? 0} />
        <MetricCard label="Файлы отправлены" value={stats?.overview.guideDelivered ?? 0} />
        <MetricCard label="События" value={stats?.overview.totalEvents ?? 0} />
        <MetricCard label="Ошибки" value={stats?.overview.errors ?? 0} tone={stats?.overview.errors ? "danger" : "normal"} />
      </div>

      <div className="stats-two-column">
        <article className="editor-card">
          <h3>Воронка</h3>
          <div className="funnel-list">
            {(stats?.funnel ?? []).map((step) => (
              <div className="funnel-row" key={step.id}>
                <div className="funnel-label">
                  <span>{step.label}</span>
                  <strong>{step.count}</strong>
                </div>
                <div className="funnel-bar">
                  <span style={{ width: `${Math.max((step.count / maxFunnel) * 100, step.count ? 8 : 0)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="editor-card">
          <h3>По дням</h3>
          <div className="daily-list">
            {(stats?.daily ?? []).map((point) => (
              <div className="daily-row" key={point.date}>
                <span>{point.date}</span>
                <span>{point.newUsers} новых</span>
                <strong>{point.events} событий</strong>
              </div>
            ))}
            {!stats?.daily.length ? <p className="setup-status">Пока нет событий.</p> : null}
          </div>
        </article>
      </div>

      <article className="editor-card">
        <div className="section-heading">
          <h3>Ошибки</h3>
          <span className="list-count">{recentErrors.length}</span>
        </div>
        <div className="error-list">
          {recentErrors.map((event) => (
            <button type="button" className="error-list-row" key={event.id} onClick={() => setSelectedError(event)}>
              <span>{new Date(event.createdAt).toLocaleString()}</span>
              <strong>{event.eventType}</strong>
              <span>{event.username ?? event.userId}</span>
              <span>{event.guideId ?? ""}</span>
            </button>
          ))}
          {!recentErrors.length ? <p className="setup-status">Пока нет ошибок.</p> : null}
        </div>
      </article>

      <article className="editor-card">
        <h3>Последние события</h3>
        <div className="event-table">
          {(stats?.recentEvents ?? []).map((event) => (
            <div className="event-row" key={event.id}>
              <span>{new Date(event.createdAt).toLocaleString()}</span>
              <strong>{event.eventType}</strong>
              <span>{event.username ?? event.userId}</span>
              <span>{event.guideId ?? ""}</span>
            </div>
          ))}
          {!stats?.recentEvents.length ? <p className="setup-status">Пока нет событий.</p> : null}
        </div>
      </article>

      {selectedError ? <ErrorDetailsDialog event={selectedError} onClose={() => setSelectedError(null)} /> : null}
    </section>
  );
}

function ErrorDetailsDialog({
  event,
  onClose
}: {
  event: AdminStatsResponse["recentErrors"][number];
  onClose: () => void;
}) {
  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <section
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="error-details-title"
        onClick={(clickEvent) => clickEvent.stopPropagation()}
      >
        <div className="section-heading">
          <h3 id="error-details-title">Детали ошибки</h3>
          <button type="button" className="secondary-action" onClick={onClose}>
            Закрыть
          </button>
        </div>
        <dl className="details-list">
          <div>
            <dt>Время</dt>
            <dd>{new Date(event.createdAt).toLocaleString()}</dd>
          </div>
          <div>
            <dt>Тип</dt>
            <dd>{event.eventType}</dd>
          </div>
          <div>
            <dt>Пользователь</dt>
            <dd>{event.username ?? event.userId}</dd>
          </div>
          <div>
            <dt>User ID</dt>
            <dd>{event.userId}</dd>
          </div>
          <div>
            <dt>Chat ID</dt>
            <dd>{event.chatId}</dd>
          </div>
          {event.guideId ? (
            <div>
              <dt>Материал</dt>
              <dd>{event.guideId}</dd>
            </div>
          ) : null}
          <div>
            <dt>Metadata</dt>
            <dd>
              <pre>{formatMetadata(event.metadata)}</pre>
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}

function formatMetadata(metadata: Record<string, unknown> | undefined): string {
  if (!metadata || !Object.keys(metadata).length) {
    return "Нет данных";
  }
  return JSON.stringify(metadata, null, 2);
}

function MetricCard({ label, value, tone = "normal" }: { label: string; value: number; tone?: "normal" | "danger" }) {
  return (
    <article className={`metric-card ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function GuideEditor({
  guide,
  index,
  onChange,
  onRemove,
  onUpload
}: {
  guide: GuideBotAdminGuide;
  index: number;
  onChange: (guide: GuideBotAdminGuide) => void;
  onRemove: () => void;
  onUpload: (file: File | undefined, onPath: (filePath: string) => void) => void;
}) {
  return (
    <article className="editor-card">
      <div className="section-heading">
        <h3>Материал {index + 1}</h3>
        <button type="button" className="secondary-action danger-action" onClick={onRemove}>
          Удалить
        </button>
      </div>
      <div className="field-grid">
        <label>
          ID
          <input value={guide.id} onChange={(event) => onChange({ ...guide, id: event.target.value })} />
        </label>
        <label>
          Префикс
          <input
            value={guide.buttonPrefix ?? ""}
            onChange={(event) => onChange({ ...guide, buttonPrefix: event.target.value })}
          />
        </label>
      </div>
      <label>
        Название кнопки
        <input value={guide.title} onChange={(event) => onChange({ ...guide, title: event.target.value })} />
      </label>
      <PathUpload
        label="Файл материала"
        value={guide.filePath}
        accept="application/pdf"
        onPathChange={(filePath) => onChange({ ...guide, filePath })}
        onUpload={onUpload}
      />
      <label>
        Ссылка на пост Telegram
        <input
          value={guide.telegramMessageLink ?? ""}
          onChange={(event) => onChange({ ...guide, telegramMessageLink: event.target.value })}
          placeholder="https://t.me/channel/123"
        />
      </label>
      <label>
        Telegram file_id
        <input
          value={guide.telegramFileId ?? ""}
          onChange={(event) => onChange({ ...guide, telegramFileId: event.target.value })}
        />
      </label>
    </article>
  );
}

function PathUpload({
  label,
  value,
  accept,
  onPathChange,
  onUpload
}: {
  label: string;
  value: string;
  accept: string;
  onPathChange: (filePath: string) => void;
  onUpload: (file: File | undefined, onPath: (filePath: string) => void) => void;
}) {
  return (
    <div className="path-upload">
      <label>
        {label}
        <input value={value} onChange={(event) => onPathChange(event.target.value)} placeholder="Путь к файлу" />
      </label>
      <input type="file" accept={accept} onChange={(event) => onUpload(event.target.files?.[0], onPathChange)} />
    </div>
  );
}

function createEmptyGuide(): GuideBotAdminGuide {
  return {
    id: "",
    title: "",
    filePath: "",
    telegramFileId: "",
    telegramMessageLink: "",
    buttonPrefix: ""
  };
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

function isUnauthorizedError(error: unknown): boolean {
  return error instanceof ApiRequestError && error.status === 401;
}
