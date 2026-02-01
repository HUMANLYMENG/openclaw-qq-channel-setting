import type { ChannelPlugin, ClawdbotConfig, ClawdbotPluginApi } from "clawdbot/plugin-sdk";

import { sendQqText } from "./send.js";
import { createQqWebhookHandler, getConfiguredWebhookPath } from "./webhook.js";

const DEFAULT_ACCOUNT_ID = "default";

function readString(value: unknown): string | undefined {
  if (typeof value === "string") return value.trim() || undefined;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}

function resolveAccountIds(cfg: ClawdbotConfig): string[] {
  const channel = (cfg.channels ?? {}) as Record<string, unknown>;
  const qq = (channel.qq ?? {}) as Record<string, unknown>;
  const accounts = (qq.accounts ?? {}) as Record<string, unknown>;
  const ids = Object.keys(accounts);
  return ids.length ? ids : [DEFAULT_ACCOUNT_ID];
}

function parseOutboundTarget(raw: string): { kind: "private" | "group"; id: string } {
  const trimmed = raw.trim();
  const lowered = trimmed.toLowerCase();
  if (lowered.startsWith("qq:group:")) {
    return { kind: "group", id: trimmed.slice("qq:group:".length) };
  }
  if (lowered.startsWith("group:")) {
    return { kind: "group", id: trimmed.slice("group:".length) };
  }
  if (lowered.startsWith("qq:user:")) {
    return { kind: "private", id: trimmed.slice("qq:user:".length) };
  }
  if (lowered.startsWith("user:")) {
    return { kind: "private", id: trimmed.slice("user:".length) };
  }
  if (lowered.startsWith("qq:")) {
    return { kind: "private", id: trimmed.slice("qq:".length) };
  }
  return { kind: "private", id: trimmed };
}

export const qqPlugin: ChannelPlugin<any> = {
  id: "qq",
  meta: {
    id: "qq",
    label: "QQ",
    selectionLabel: "QQ (NapCat)",
    docsPath: "/channels/qq",
    blurb: "QQ channel plugin via NapCat/OneBot11 webhook.",
    order: 90,
  },
  capabilities: {
    chatTypes: ["direct", "group"],
    media: false,
    reactions: false,
    threads: false,
    nativeCommands: false,
    blockStreaming: true,
  },
  reload: { configPrefixes: ["channels.qq"] },
  config: {
    listAccountIds: (cfg) => resolveAccountIds(cfg),
    resolveAccount: (cfg, accountId) => {
      const channel = (cfg.channels ?? {}) as Record<string, unknown>;
      const qq = (channel.qq ?? {}) as Record<string, unknown>;
      const accounts = (qq.accounts ?? {}) as Record<string, any>;
      const resolvedId = accountId ?? resolveAccountIds(cfg)[0] ?? DEFAULT_ACCOUNT_ID;
      const accountConfig = accounts[resolvedId] ?? qq;
      return {
        accountId: resolvedId,
        name: readString(accountConfig?.name),
        enabled: accountConfig?.enabled !== false,
        config: accountConfig,
      };
    },
    defaultAccountId: () => DEFAULT_ACCOUNT_ID,
    isConfigured: (account) => Boolean(readString(account.config?.httpUrl)),
    describeAccount: (account) => ({
      accountId: account.accountId,
      name: account.name,
      enabled: account.enabled,
      configured: Boolean(readString(account.config?.httpUrl)),
    }),
  },
  messaging: {
    normalizeTarget: (target) => target.trim(),
    targetResolver: {
      looksLikeId: (target) => /^\d+$/.test(target),
      hint: "<qq-id or group-id>",
    },
  },
  outbound: {
    deliveryMode: "direct",
    sendText: async ({ cfg, to, text }) => {
      const target = parseOutboundTarget(to);
      const result = await sendQqText({ cfg, target, text });
      return { channel: "qq", ...result };
    },
  },
};

export function registerQqWebhookRoute(api: ClawdbotPluginApi): void {
  const path = getConfiguredWebhookPath(api.runtime);
  api.registerHttpRoute({
    path,
    handler: createQqWebhookHandler({ runtime: api.runtime, log: api.logger }),
  });
  api.logger.info?.(`[qq] webhook registered at ${path}`);
}
