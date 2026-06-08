import { buildServer } from "./server";
import { SqliteSessionRepository } from "./storage/SqliteSessionRepository";

const smokeSessionDatabasePath = `data/smoke-sessions-${process.pid}-${Date.now()}.sqlite3`;
const server = buildServer({
  configOptions: {
    loadEnvFile: false
  },
  sqliteSessionPath: smokeSessionDatabasePath
});

const health = await server.inject({
  method: "GET",
  url: "/health"
});

if (health.statusCode !== 200) {
  throw new Error(`Expected /health 200, got ${health.statusCode}`);
}

const telegram = await server.inject({
  method: "POST",
  url: "/telegram/inbound",
  payload: {
    chatId: "demo-chat",
    userId: "demo-user",
    username: "founder",
    text: "/start"
  }
});

if (telegram.statusCode !== 200) {
  throw new Error(`Expected /telegram/inbound 200, got ${telegram.statusCode}`);
}

const body = telegram.json<{ status: string; text: string }>();
if (body.status !== "handled" || !body.text.includes("founder")) {
  throw new Error(`Unexpected Telegram response: ${telegram.body}`);
}

const ozon = await server.inject({
  method: "POST",
  url: "/telegram/inbound",
  payload: {
    chatId: "demo-chat",
    userId: "demo-user",
    username: "founder",
    text: "/ozon"
  }
});

if (ozon.statusCode !== 200) {
  throw new Error(`Expected /telegram/inbound /ozon 200, got ${ozon.statusCode}`);
}

const ozonBody = ozon.json<{ status: string; text: string }>();
if (ozonBody.status !== "handled" || !ozonBody.text.includes("https://www.ozon.ru/")) {
  throw new Error(`Unexpected Ozon response: ${ozon.body}`);
}

const lead = await server.inject({
  method: "POST",
  url: "/telegram/inbound",
  payload: {
    chatId: "demo-chat",
    userId: "demo-user",
    username: "founder",
    text: "/lead Need a callback tomorrow"
  }
});

if (lead.statusCode !== 200) {
  throw new Error(`Expected /telegram/inbound /lead 200, got ${lead.statusCode}`);
}

const leadBody = lead.json<{ status: string; text: string }>();
if (leadBody.status !== "handled" || !leadBody.text.includes("Lead captured")) {
  throw new Error(`Unexpected lead response: ${lead.body}`);
}

const leads = await server.inject({
  method: "GET",
  url: "/leads?limit=1"
});

if (leads.statusCode !== 200 || !leads.body.includes("Need a callback tomorrow")) {
  throw new Error(`Unexpected leads response: ${leads.body}`);
}

const leadId = leads.json<{ leads: Array<{ id: string }> }>().leads[0]?.id;
if (!leadId) {
  throw new Error(`Expected smoke lead id: ${leads.body}`);
}

const leadDetail = await server.inject({
  method: "GET",
  url: `/leads/${encodeURIComponent(leadId)}`
});

if (leadDetail.statusCode !== 200 || !leadDetail.body.includes("Need a callback tomorrow")) {
  throw new Error(`Unexpected lead detail response: ${leadDetail.body}`);
}

const sessions = new SqliteSessionRepository({
  databasePath: smokeSessionDatabasePath
});
const persistedSession = await sessions.findByUserId("demo-user");

if (persistedSession?.lastIntent !== "start:new") {
  throw new Error(`Expected persisted demo-user session, got ${JSON.stringify(persistedSession)}`);
}

await sessions.close();
await server.close();

console.log("API smoke check passed");
