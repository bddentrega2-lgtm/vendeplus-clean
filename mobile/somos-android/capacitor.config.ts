import type { CapacitorConfig } from "@capacitor/cli";
import { resolveAndroidIdentity, resolveAndroidServer } from "./server-config";

const config: CapacitorConfig = {
  ...resolveAndroidIdentity(process.env),
  webDir: "www",
  server: resolveAndroidServer(process.env),
  android: {
    allowMixedContent: false,
    backgroundColor: "#143D42",
  },
};

export default config;
