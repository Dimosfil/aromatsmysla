import assert from "node:assert/strict";
import { loadApiConfig } from "../config";
import { buildServer } from "../server";

const validToken = "123456789:abcdefghijklmnopqrstuvwxyz";

async function testTelegramConfigRoutes() {
  const fetchCalls: Array<{ url: string; init?: RequestInit }> = [];
  const telegramFetch: typeof fetch = async (url, init) => {
    fetchCalls.push({
      url: String(url),
      init
    });
    return new Response(JSON.stringify({ ok: true, result: [] }), {
      status: 200,
      headers: {
        "content-type": "application/json"
      }
    });
  };

  const server = buildServer({
    configOptions: {
      loadEnvFile: false
    },
    sqliteSessionPath: `data/test-telegram-config-${process.pid}-${Date.now()}.sqlite3`,
    telegramFetch,
    telegramPollIntervalMs: 25,
    telegramRetryDelayMs: 1
  });

  try {
    const initialStatus = await server.inject({
      method: "GET",
      url: "/telegram/config"
    });
    assert.equal(initialStatus.statusCode, 200);
    assert.deepEqual(initialStatus.json(), {
      configured: false,
      polling: false,
      maskedToken: null,
      lastError: null,
      tokenSource: "none",
      restartPersistent: false
    });

    const invalidToken = await server.inject({
      method: "POST",
      url: "/telegram/config",
      payload: {
        token: "not-a-token"
      }
    });
    assert.equal(invalidToken.statusCode, 400);
    assert.match(invalidToken.json<{ error: string }>().error, /Invalid Telegram bot token format/);

    const configured = await server.inject({
      method: "POST",
      url: "/telegram/config",
      payload: {
        token: validToken
      }
    });
    assert.equal(configured.statusCode, 200);
    assert.deepEqual(configured.json(), {
      configured: true,
      polling: true,
      maskedToken: "123456789:********wxyz",
      lastError: null,
      tokenSource: "runtime",
      restartPersistent: false
    });

    await waitFor(() => fetchCalls.some((call) => call.url.endsWith("/getUpdates")));
    const pollCall = fetchCalls.find((call) => call.url.endsWith("/getUpdates"));
    assert.ok(pollCall, "Expected polling gateway to call getUpdates.");
    assert.equal(pollCall.init?.method, "POST");
    assert.match(String(pollCall.init?.body), /allowed_updates/);
  } finally {
    await server.close();
  }
}

async function testInboundWorkflowWithoutTelegramApi() {
  const fetchCalls: string[] = [];
  const server = buildServer({
    configOptions: {
      loadEnvFile: false
    },
    sqliteSessionPath: `data/test-inbound-${process.pid}-${Date.now()}.sqlite3`,
    telegramFetch: async (url) => {
      fetchCalls.push(String(url));
      throw new Error("Telegram API should not be called by inbound route.");
    }
  });

  try {
    const response = await server.inject({
      method: "POST",
      url: "/telegram/inbound",
      payload: {
        chatId: "demo-chat",
        userId: "demo-user",
        username: "founder",
        text: "/start"
      }
    });

    assert.equal(response.statusCode, 200);
    const body = response.json<{ status: string; text: string }>();
    assert.equal(body.status, "handled");
    assert.match(body.text, /founder/);
    assert.deepEqual(fetchCalls, []);
  } finally {
    await server.close();
  }
}

async function testMockAiWorkflow() {
  const server = buildServer({
    config: loadApiConfig({
      env: {
        AI_PROVIDER: "mock"
      },
      loadEnvFile: false
    }),
    sqliteSessionPath: `data/test-ai-router-${process.pid}-${Date.now()}.sqlite3`
  });

  try {
    const response = await server.inject({
      method: "POST",
      url: "/telegram/inbound",
      payload: {
        chatId: "demo-chat",
        userId: "demo-ai-user",
        username: "founder",
        text: "/start"
      }
    });

    assert.equal(response.statusCode, 200);
    const body = response.json<{ status: string; text: string }>();
    assert.equal(body.status, "handled");
    assert.match(body.text, /AI hint \(start\.reply\.v1\)/);
  } finally {
    await server.close();
  }
}

async function testExtensionRoutes() {
  const server = buildServer({
    configOptions: {
      loadEnvFile: false
    },
    sqliteSessionPath: `data/test-extensions-${process.pid}-${Date.now()}.sqlite3`
  });

  try {
    const listResponse = await server.inject({
      method: "GET",
      url: "/extensions"
    });
    assert.equal(listResponse.statusCode, 200);
    assert.match(listResponse.body, /example\.ping/);

    const commandResponse = await server.inject({
      method: "POST",
      url: "/extensions/example/commands/example.ping",
      payload: {
        userId: "demo-user"
      }
    });
    assert.equal(commandResponse.statusCode, 200);
    assert.match(commandResponse.json<{ text: string }>().text, /demo-user/);
  } finally {
    await server.close();
  }
}

async function testSessionDebugRoute() {
  const server = buildServer({
    configOptions: {
      loadEnvFile: false
    },
    sqliteSessionPath: `data/test-session-debug-${process.pid}-${Date.now()}.sqlite3`
  });

  try {
    await server.inject({
      method: "POST",
      url: "/telegram/inbound",
      payload: {
        chatId: "demo-chat",
        userId: "debug-user",
        username: "debugger",
        text: "/start"
      }
    });

    const response = await server.inject({
      method: "GET",
      url: "/debug/sessions/debug-user"
    });
    assert.equal(response.statusCode, 200);
    const body = response.json<{ found: boolean; session: { userId: string; lastIntent: string } | null }>();
    assert.equal(body.found, true);
    assert.equal(body.session?.userId, "debug-user");
    assert.equal(body.session?.lastIntent, "start:new");
    assert.doesNotMatch(response.body, /TELEGRAM_BOT_TOKEN|AI_API_KEY/);
  } finally {
    await server.close();
  }
}

async function testLeadCaptureWorkflow() {
  const server = buildServer({
    configOptions: {
      loadEnvFile: false
    },
    sqliteSessionPath: `data/test-leads-${process.pid}-${Date.now()}.sqlite3`
  });

  try {
    const emptyLead = await server.inject({
      method: "POST",
      url: "/telegram/inbound",
      payload: {
        chatId: "lead-chat",
        userId: "lead-user",
        username: "buyer",
        text: "/lead"
      }
    });
    assert.equal(emptyLead.statusCode, 200);
    assert.match(emptyLead.json<{ text: string }>().text, /Send \/lead followed by/);

    const createdLead = await server.inject({
      method: "POST",
      url: "/telegram/inbound",
      payload: {
        chatId: "lead-chat",
        userId: "lead-user",
        username: "buyer",
        text: "/lead Need a demo this week"
      }
    });
    assert.equal(createdLead.statusCode, 200);
    assert.equal(createdLead.json<{ status: string }>().status, "handled");
    assert.match(createdLead.json<{ text: string }>().text, /Lead captured/);

    const response = await server.inject({
      method: "GET",
      url: "/leads?limit=5"
    });
    assert.equal(response.statusCode, 200);
    const body = response.json<{
      leads: Array<{ status: string; userId: string; username?: string; text: string; source: string }>;
    }>();
    assert.equal(body.leads.length, 1);
    assert.equal(body.leads[0]?.status, "new");
    assert.equal(body.leads[0]?.source, "telegram");
    assert.equal(body.leads[0]?.userId, "lead-user");
    assert.equal(body.leads[0]?.username, "buyer");
    assert.equal(body.leads[0]?.text, "Need a demo this week");
    assert.doesNotMatch(response.body, /TELEGRAM_BOT_TOKEN|AI_API_KEY/);

    const leadId = response.json<{ leads: Array<{ id: string }> }>().leads[0]?.id;
    assert.ok(leadId);
    const detail = await server.inject({
      method: "GET",
      url: `/leads/${encodeURIComponent(leadId)}`
    });
    assert.equal(detail.statusCode, 200);
    const detailBody = detail.json<{ found: boolean; lead: { id: string; text: string } | null }>();
    assert.equal(detailBody.found, true);
    assert.equal(detailBody.lead?.id, leadId);
    assert.equal(detailBody.lead?.text, "Need a demo this week");
    assert.doesNotMatch(detail.body, /TELEGRAM_BOT_TOKEN|AI_API_KEY/);
  } finally {
    await server.close();
  }
}

async function testTelegramDiagnosticsRoute() {
  const server = buildServer({
    configOptions: {
      loadEnvFile: false
    },
    sqliteSessionPath: `data/test-telegram-diagnostics-${process.pid}-${Date.now()}.sqlite3`
  });

  try {
    const response = await server.inject({
      method: "GET",
      url: "/debug/telegram/diagnostics"
    });
    assert.equal(response.statusCode, 200);
    const body = response.json<{
      config: { polling: boolean; lastError: string | null };
      cases: Array<{ command: string; status: string; text: string }>;
    }>();

    assert.equal(body.config.polling, false);
    assert.equal(body.config.lastError, null);
    assert.equal(body.cases.find((item) => item.command === "/start")?.status, "handled");
    assert.match(body.cases.find((item) => item.command === "/ozon")?.text ?? "", /https:\/\/www\.ozon\.ru\//);
    assert.match(body.cases.find((item) => item.command === "/lead")?.text ?? "", /Send \/lead followed by/);
    assert.equal(body.cases.find((item) => item.command === "/unknown")?.status, "ignored");
  } finally {
    await server.close();
  }
}

async function testGuideBotWorkflow() {
  const telegramFetch: typeof fetch = async (url, init) => {
    assert.ok(String(url).endsWith("/getChatMember"));
    assert.match(String(init?.body), /guide-user/);
    return new Response(JSON.stringify({ ok: true, result: { status: "member" } }), {
      status: 200,
      headers: {
        "content-type": "application/json"
      }
    });
  };
  const server = buildServer({
    config: loadApiConfig({
      env: {
        TELEGRAM_BOT_TOKEN: validToken,
        GUIDE_BOT_REQUIRED_CHANNEL_ID: "@demo_channel",
        GUIDE_BOT_REQUIRED_CHANNEL_URL: "https://t.me/demo_channel",
        GUIDE_BOT_SELECTION_PHOTO_PATH: "bots/demo/assets/second-screen-photo.jpg",
        GUIDE_BOT_COPY_WELCOME_PROMPT: "Choose your aroma guide:",
        GUIDE_BOT_COPY_SUBSCRIBED_PROMPT: "Choose your aroma guide:",
        GUIDE_BOT_COPY_DELIVERED_PREFIX: "Your aroma guide:",
        GUIDE_BOT_COPY_CHANNEL_BUTTON_TEXT: "Open demo channel",
        GUIDE_BOT_GUIDE_1_ID: "tg",
        GUIDE_BOT_GUIDE_1_TITLE: "Telegram launch guide",
        GUIDE_BOT_GUIDE_1_BUTTON_PREFIX: "🌿",
        GUIDE_BOT_GUIDE_1_FILE_PATH: "guides/telegram-launch.pdf"
      },
      loadEnvFile: false
    }),
    sqliteSessionPath: `data/test-guide-bot-${process.pid}-${Date.now()}.sqlite3`,
    telegramFetch
  });

  try {
    const start = await server.inject({
      method: "POST",
      url: "/telegram/inbound",
      payload: {
        chatId: "guide-chat",
        userId: "guide-user",
        username: "reader",
        text: "/start"
      }
    });
    assert.equal(start.statusCode, 200);
    const startBody = start.json<{
      text: string;
      photoPath?: string;
      inlineKeyboard?: Array<Array<{ text: string; callbackData?: string; url?: string }>>;
    }>();
    assert.match(startBody.text, /Choose your aroma guide/i);
    assert.equal(startBody.inlineKeyboard?.[0]?.[0]?.callbackData, "guide:check_subscription");

    const check = await server.inject({
      method: "POST",
      url: "/telegram/inbound",
      payload: {
        chatId: "guide-chat",
        userId: "guide-user",
        username: "reader",
        text: "guide:check_subscription",
        callbackData: "guide:check_subscription"
      }
    });
    assert.equal(check.statusCode, 200);
    const checkBody = check.json<{
      text: string;
      photoPath?: string;
      inlineKeyboard?: Array<Array<{ text: string; callbackData?: string; url?: string }>>;
    }>();
    assert.match(checkBody.text, /aroma guide/i);
    assert.equal(checkBody.photoPath, "bots/demo/assets/second-screen-photo.jpg");
    assert.equal(checkBody.inlineKeyboard?.[0]?.[0]?.text, "🌿 Telegram launch guide");
    assert.equal(checkBody.inlineKeyboard?.[0]?.[0]?.callbackData, "guide:tg");
    assert.equal(checkBody.inlineKeyboard?.[1]?.[0]?.text, "Open demo channel");
    assert.equal(checkBody.inlineKeyboard?.[1]?.[0]?.url, "https://t.me/demo_channel");

    const chosen = await server.inject({
      method: "POST",
      url: "/telegram/inbound",
      payload: {
        chatId: "guide-chat",
        userId: "guide-user",
        username: "reader",
        text: "guide:tg",
        callbackData: "guide:tg"
      }
    });
    assert.equal(chosen.statusCode, 200);
    const chosenBody = chosen.json<{ text: string; documentPath?: string }>();
    assert.match(chosenBody.text, /Your aroma guide: Telegram launch guide/);
    assert.equal(chosenBody.documentPath, "guides/telegram-launch.pdf");

    const session = await server.inject({
      method: "GET",
      url: "/debug/sessions/guide-user"
    });
    assert.equal(session.statusCode, 200);
    assert.equal(session.json<{ session: { lastIntent: string; selectedGuideId?: string } }>().session.lastIntent, "guide:delivered");
    assert.equal(session.json<{ session: { selectedGuideId?: string } }>().session.selectedGuideId, "tg");
  } finally {
    await server.close();
  }
}

async function testGuideBotSubscriptionCheckFailure() {
  const telegramFetch: typeof fetch = async (url) => {
    assert.ok(String(url).endsWith("/getChatMember"));
    return new Response(JSON.stringify({ ok: false, description: "Bad Request: member list is inaccessible" }), {
      status: 400,
      headers: {
        "content-type": "application/json"
      }
    });
  };
  const server = buildServer({
    config: loadApiConfig({
      env: {
        TELEGRAM_BOT_TOKEN: validToken,
        GUIDE_BOT_REQUIRED_CHANNEL_ID: "@demo_channel",
        GUIDE_BOT_REQUIRED_CHANNEL_URL: "https://t.me/demo_channel",
        GUIDE_BOT_GUIDE_1_ID: "tg",
        GUIDE_BOT_GUIDE_1_TITLE: "Telegram launch guide",
        GUIDE_BOT_GUIDE_1_FILE_PATH: "guides/telegram-launch.pdf"
      },
      loadEnvFile: false
    }),
    sqliteSessionPath: `data/test-guide-bot-error-${process.pid}-${Date.now()}.sqlite3`,
    telegramFetch
  });

  try {
    const start = await server.inject({
      method: "POST",
      url: "/telegram/inbound",
      payload: {
        chatId: "guide-chat",
        userId: "guide-user",
        username: "reader",
        text: "guide:check_subscription",
        callbackData: "guide:check_subscription"
      }
    });
    assert.equal(start.statusCode, 200);
    const body = start.json<{ status: string; text: string }>();
    assert.equal(body.status, "handled");
    assert.match(body.text, /cannot verify/i);
    assert.match(body.text, /https:\/\/t\.me\/demo_channel/);
  } finally {
    await server.close();
  }
}

async function waitFor(predicate: () => boolean): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 1000) {
    if (predicate()) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  throw new Error("Timed out waiting for condition.");
}

await testTelegramConfigRoutes();
await testInboundWorkflowWithoutTelegramApi();
await testMockAiWorkflow();
await testExtensionRoutes();
await testSessionDebugRoute();
await testLeadCaptureWorkflow();
await testTelegramDiagnosticsRoute();
await testGuideBotWorkflow();
await testGuideBotSubscriptionCheckFailure();

console.log("Telegram gateway focused tests passed");
