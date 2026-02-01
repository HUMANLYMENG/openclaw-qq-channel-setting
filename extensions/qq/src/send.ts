import type { ClawdbotConfig } from "clawdbot/plugin-sdk";

export type QqTargetKind = "private" | "group";

export type QqTarget = {
  kind: QqTargetKind;
  id: string;
};

export type QqHttpConfig = {
  httpUrl: string;
  accessToken?: string;
};

function readString(value: unknown): string | undefined {
  if (typeof value === "string") return value.trim() || undefined;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}

export function resolveQqHttpConfig(cfg: ClawdbotConfig): QqHttpConfig {
  const channel = (cfg.channels ?? {}) as Record<string, unknown>;
  const qq = (channel.qq ?? {}) as Record<string, unknown>;
  const httpUrl = readString(qq.httpUrl) ?? "http://127.0.0.1:3000";
  const accessToken = readString(qq.accessToken);
  return { httpUrl, accessToken };
}

function coerceId(value: string): number | string {
  const parsed = Number.parseInt(value, 10);
  if (Number.isFinite(parsed)) return parsed;
  return value;
}

export async function sendQqText(params: {
  cfg: ClawdbotConfig;
  target: QqTarget;
  text: string;
}): Promise<{ ok: boolean; messageId?: string | number; raw?: unknown }> {
  const { cfg, target, text } = params;
  const trimmed = text.trim();
  if (!trimmed) return { ok: false };

  const { httpUrl, accessToken } = resolveQqHttpConfig(cfg);
  const endpoint = target.kind === "group" ? "/send_group_msg" : "/send_private_msg";
  const url = new URL(endpoint, httpUrl).toString();
  const payload =
    target.kind === "group"
      ? { group_id: coerceId(target.id), message: trimmed }
      : { user_id: coerceId(target.id), message: trimmed };

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  let data: any = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok || !data || data.status !== "ok") {
    const detail = data ? JSON.stringify(data) : await response.text().catch(() => "");
    throw new Error(`NapCat send failed (${response.status}): ${detail}`);
  }

  const messageId = data?.data?.message_id ?? data?.message_id;
  return { ok: true, messageId, raw: data };
}
