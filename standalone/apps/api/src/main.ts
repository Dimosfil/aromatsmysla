import { ConfigError, loadApiConfig } from "./config";
import { buildServer } from "./server";

try {
  const config = loadApiConfig();
  const server = buildServer({
    config,
    sqliteSessionPath: config.sqliteSessionPath,
    adminContentOverlayEnabled: true
  });

  await server.listen({
    host: config.host,
    port: config.port
  });
} catch (error) {
  if (error instanceof ConfigError) {
    console.error(error.message);
    process.exit(1);
  }

  throw error;
}
