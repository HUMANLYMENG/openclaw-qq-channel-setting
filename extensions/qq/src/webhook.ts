import type { IncomingMessage, ServerResponse } from "node:http";
import type { ClawdbotConfig, PluginRuntime } from "clawdbot/plugin-sdk";

import { sendQqText } from "./send.js";

// Message queue to prevent concurrent processing of messages from the same chat
const chatQueues = new Map<string, Promise<void>>();

async function enqueueForChat(chatId: string, task: () => Promise<void>): Promise<void> {
  const existing = chatQueues.get(chatId) ?? Promise.resolve();
  const newPromise = existing.then(task, task);
  chatQueues.set(chatId, newPromise);
  
  // Clean up after task completes
  newPromise.finally(() => {
    if (chatQueues.get(chatId) === newPromise) {
      chatQueues.delete(chatId);
    }
  });
  
  return newPromise;
}

export type QqWebhookEvent = {
  post_type?: string;
  message_type?: string;
  user_id?: number | string;
  group_id?: number | string;
  message?: unknown;
  raw_message?: string;
  message_id?: number | string;
  sender?: {
    user_id?: number | string;
    nickname?: string;
    card?: string;
  };
  self_id?: number | string;
  time?: number;
};

type QqLogger = {
  info?: (message: string) => void;
  warn?: (message: string) => void;
  error?: (message: string) => void;
  debug?: (message: string) => void;
};

function readString(value: unknown): string | undefined {
  if (typeof value === "string") return value.trim() || undefined;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}

function readBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  return undefined;
}

function parseTimestamp(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value * 1000;
  return undefined;
}

function extractMessageFromSegments(segments: any[], selfId?: string): {
  text: string;
  mentioned: boolean;
} {
  let mentioned = false;
  const parts: string[] = [];
  for (const seg of segments) {
    if (!seg || typeof seg !== "object") continue;
    const type = String(seg.type || "");
    const data = (seg.data ?? {}) as Record<string, unknown>;
    if (type === "text") {
      const text = readString(data.text) ?? "";
      parts.push(text);
    } else if (type === "at") {
      const qq = readString(data.qq);
      if (qq && selfId && qq === selfId) {
        mentioned = true;
        continue;
      }
      if (qq) parts.push(`@${qq}`);
    } else if (type === "image") {
      parts.push("[image]");
    } else if (type === "face") {
      parts.push("[face]");
    }
  }
  return { text: parts.join("").trim(), mentioned };
}

function stripCqAtSelf(text: string, selfId?: string): { text: string; mentioned: boolean } {
  if (!selfId) return { text: text.trim(), mentioned: false };
  const cqPattern = new RegExp(`\\[CQ:at,qq=${selfId}\\]`, "g");
  const mentioned = cqPattern.test(text) || text.includes(`@${selfId}`);
  const cleaned = text.replace(cqPattern, "").replace(`@${selfId}`, "").trim();
  return { text: cleaned, mentioned };
}

function extractIncomingText(event: QqWebhookEvent, selfId?: string): { text: string; mentioned: boolean } {
  if (Array.isArray(event.message)) {
    return extractMessageFromSegments(event.message, selfId);
  }
  if (typeof event.message === "string") {
    return stripCqAtSelf(event.message, selfId);
  }
  if (typeof event.raw_message === "string") {
    return stripCqAtSelf(event.raw_message, selfId);
  }
  return { text: "", mentioned: false };
}

function resolveWebhookPath(cfg: ClawdbotConfig): string {
  const qq = (cfg.channels ?? {}).qq as Record<string, unknown> | undefined;
  const path = readString(qq?.webhookPath);
  return path ? (path.startsWith("/") ? path : `/${path}`) : "/qq/webhook";
}

async function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    req.on("error", reject);
  });
}

async function deliverQqReply(params: {
  cfg: ClawdbotConfig;
  chatId: string;
  isGroup: boolean;
  payload: { text?: string; mediaUrls?: string[]; mediaUrl?: string };
}): Promise<void> {
  const { cfg, chatId, isGroup, payload } = params;
  const text = payload.text ?? "";
  const mediaList = payload.mediaUrls?.length
    ? payload.mediaUrls
    : payload.mediaUrl
      ? [payload.mediaUrl]
      : [];

  const mediaBlock = mediaList.length
    ? mediaList.map((url) => `Attachment: ${url}`).join("\n")
    : "";
  const combined = text.trim()
    ? mediaBlock
      ? `${text.trim()}\n\n${mediaBlock}`
      : text.trim()
    : mediaBlock;

  if (!combined.trim()) return;

  await sendQqText({
    cfg,
    target: { kind: isGroup ? "group" : "private", id: chatId },
    text: combined,
  });
}

async function handleQqEvent(params: {
  runtime: PluginRuntime;
  log?: QqLogger;
  event: QqWebhookEvent;
}): Promise<void> {
  const { runtime, log, event } = params;
  if (event.post_type !== "message") return;

  const cfg = runtime.config.loadConfig() as ClawdbotConfig;
  const qqCfg = (cfg.channels ?? {}).qq as Record<string, unknown> | undefined;
  if (qqCfg && qqCfg.enabled === false) return;

  const messageType = readString(event.message_type) ?? "";
  const isGroup = messageType === "group";
  if (!isGroup && messageType !== "private") return;

  const senderId = readString(event.user_id);
  if (!senderId) return;

  const selfId = readString(qqCfg?.selfId) ?? readString(event.self_id);
  if (selfId && senderId === selfId) return;

  const { text, mentioned } = extractIncomingText(event, selfId);
  if (!text.trim()) return;

  const requireMention = readBoolean(qqCfg?.requireMention) ?? (isGroup ? true : false);
  if (isGroup && requireMention && !mentioned) {
    return;
  }

  const chatId = isGroup ? readString(event.group_id) : senderId;
  if (!chatId) return;

  const senderName = readString(event.sender?.card) ?? readString(event.sender?.nickname);
  const timestamp = parseTimestamp(event.time) ?? Date.now();

  const core = runtime;
  const route = core.channel.routing.resolveAgentRoute({
    cfg,
    channel: "qq",
    accountId: "default",
    peer: { kind: isGroup ? "group" : "dm", id: chatId },
  });

  const fromLabel = isGroup ? `group:${chatId}` : senderName || `user:${senderId}`;
  const storePath = core.channel.session.resolveStorePath(cfg.session?.store, {
    agentId: route.agentId,
  });
  const envelopeOptions = core.channel.reply.resolveEnvelopeFormatOptions(cfg);
  const previousTimestamp = core.channel.session.readSessionUpdatedAt({
    storePath,
    sessionKey: route.sessionKey,
  });
  const body = core.channel.reply.formatAgentEnvelope({
    channel: "QQ",
    from: fromLabel,
    timestamp,
    previousTimestamp,
    envelope: envelopeOptions,
    body: text,
  });

  const ctxPayload = core.channel.reply.finalizeInboundContext({
    Body: body,
    RawBody: text,
    CommandBody: text,
    From: isGroup ? `qq:group:${chatId}` : `qq:${senderId}`,
    To: `qq:${chatId}`,
    SessionKey: route.sessionKey,
    AccountId: route.accountId,
    ChatType: isGroup ? "group" : "direct",
    ConversationLabel: fromLabel,
    SenderName: senderName || undefined,
    SenderId: senderId,
    Provider: "qq",
    Surface: "qq",
    WasMentioned: isGroup ? mentioned : undefined,
    MessageSid: readString(event.message_id),
    Timestamp: timestamp,
    OriginatingChannel: "qq",
    OriginatingTo: `qq:${chatId}`,
    CommandAuthorized: true,
  });

  await core.channel.session.recordInboundSession({
    storePath,
    sessionKey: ctxPayload.SessionKey ?? route.sessionKey,
    ctx: ctxPayload,
    onRecordError: (err) => {
      log?.error?.(`qq: failed updating session meta: ${String(err)}`);
    },
  });

  await core.channel.reply.dispatchReplyWithBufferedBlockDispatcher({
    ctx: ctxPayload,
    cfg,
    dispatcherOptions: {
      deliver: async (payload) => {
        await deliverQqReply({
          cfg,
          chatId,
          isGroup,
          payload: payload as { text?: string; mediaUrls?: string[]; mediaUrl?: string },
        });
      },
      onError: (err, info) => {
        log?.error?.(`qq ${info.kind} reply failed: ${String(err)}`);
      },
    },
  });
}

export function createQqWebhookHandler(params: {
  runtime: PluginRuntime;
  log?: QqLogger;
}) {
  const { runtime, log } = params;
  return async (req: IncomingMessage, res: ServerResponse) => {
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.end("Method Not Allowed");
      return;
    }

    let body = "";
    try {
      body = await readBody(req);
    } catch (err) {
      log?.error?.(`qq webhook read failed: ${String(err)}`);
      res.statusCode = 400;
      res.end("Bad Request");
      return;
    }

    let event: QqWebhookEvent | null = null;
    try {
      event = JSON.parse(body) as QqWebhookEvent;
    } catch (err) {
      log?.warn?.(`qq webhook invalid JSON: ${String(err)}`);
      res.statusCode = 400;
      res.end("Bad Request");
      return;
    }

    res.statusCode = 200;
    res.end("ok");

    if (!event) return;
    
    // Extract chatId early to queue messages per chat
    const messageType = readString(event.message_type) ?? "";
    const isGroup = messageType === "group";
    const senderId = readString(event.user_id);
    const chatId = isGroup ? readString(event.group_id) : senderId;
    
    if (!chatId) return;
    
    // Queue the message processing for this chat to prevent concurrent streaming conflicts
    setImmediate(() => {
      void enqueueForChat(chatId, async () => {
        await handleQqEvent({ runtime, log, event });
      }).catch((err) => {
        log?.error?.(`qq webhook handler failed: ${String(err)}`);
      });
    });
  };
}

export function getConfiguredWebhookPath(runtime: PluginRuntime): string {
  try {
    const cfg = runtime.config.loadConfig() as ClawdbotConfig;
    return resolveWebhookPath(cfg);
  } catch {
    return "/qq/webhook";
  }
}
