import type { ExtensionModule } from "./types";

export function createExampleExtension(): ExtensionModule {
  return {
    id: "example",
    name: "Example Extension",
    description: "Placeholder extension showing command and job registration without Telegram coupling.",
    commands: [
      {
        name: "example.ping",
        description: "Return a deterministic extension response.",
        async handle(request) {
          return {
            text: `Example extension is available for ${request.userId}.`,
            metadata: {
              extension: "example"
            }
          };
        }
      }
    ],
    jobs: [
      {
        name: "example.daily-check",
        description: "Placeholder scheduled job registration.",
        schedule: "manual"
      }
    ]
  };
}
