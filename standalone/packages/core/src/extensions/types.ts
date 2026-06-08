export interface ExtensionContext {
  now(): Date;
}

export interface ExtensionCommandRequest {
  userId: string;
  payload?: unknown;
}

export interface ExtensionCommandResponse {
  text: string;
  metadata?: Record<string, unknown>;
}

export interface ExtensionCommand {
  name: string;
  description: string;
  handle(request: ExtensionCommandRequest): Promise<ExtensionCommandResponse>;
}

export interface ExtensionJob {
  name: string;
  description: string;
  schedule: "manual" | "interval" | "cron";
}

export interface ExtensionModule {
  id: string;
  name: string;
  description: string;
  commands?: ExtensionCommand[];
  jobs?: ExtensionJob[];
  registerServices?(context: ExtensionContext): void;
}
