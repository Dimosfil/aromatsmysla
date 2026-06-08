import type { FastifyInstance } from "fastify";
import type { ExtensionModule } from "@telegram-bot-template/core";

interface ExtensionCommandBody {
  userId?: string;
  payload?: unknown;
}

export async function registerExtensions(server: FastifyInstance, extensions: ExtensionModule[]): Promise<void> {
  const context = {
    now: () => new Date()
  };

  for (const extension of extensions) {
    extension.registerServices?.(context);
  }

  server.get("/extensions", async () => {
    return {
      extensions: extensions.map((extension) => ({
        id: extension.id,
        name: extension.name,
        description: extension.description,
        commands: extension.commands?.map((command) => ({
          name: command.name,
          description: command.description
        })) ?? [],
        jobs: extension.jobs ?? []
      }))
    };
  });

  for (const extension of extensions) {
    for (const command of extension.commands ?? []) {
      server.post<{ Body: ExtensionCommandBody }>(`/extensions/${extension.id}/commands/${command.name}`, async (request) => {
        return command.handle({
          userId: request.body.userId ?? "anonymous",
          payload: request.body.payload
        });
      });
    }
  }
}
