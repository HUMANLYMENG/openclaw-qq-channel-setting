import type { ClawdbotPluginApi } from "clawdbot/plugin-sdk";
import { emptyPluginConfigSchema } from "clawdbot/plugin-sdk";

import { qqPlugin, registerQqWebhookRoute } from "./src/channel.js";
import { setQqRuntime } from "./src/runtime.js";

const plugin = {
  id: "qq",
  name: "QQ",
  description: "QQ channel plugin via NapCat/OneBot11",
  configSchema: emptyPluginConfigSchema(),
  register(api: ClawdbotPluginApi) {
    setQqRuntime(api.runtime);
    api.registerChannel({ plugin: qqPlugin });
    registerQqWebhookRoute(api);
  },
};

export default plugin;
