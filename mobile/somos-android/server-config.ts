type BuildEnvironment = Record<string, string | undefined>;

export function resolveAndroidIdentity(env: BuildEnvironment) {
  if (env.SOMOS_ANDROID_BUYER_STAGING === "1") {
    if (!env.SOMOS_ANDROID_PREVIEW_URL || env.SOMOS_ANDROID_LOCAL === "1") throw new Error("Buyer staging requires an isolated HTTPS preview.");
    resolveAndroidServer(env);
    return { appId: "com.somosve.app.staging", appName: "Somos Pruebas" };
  }
  return { appId: "com.somosve.app", appName: "Somos" };
}

export function resolveAndroidServer(env: BuildEnvironment) {
  const local = env.SOMOS_ANDROID_LOCAL === "1";
  const preview = env.SOMOS_ANDROID_PREVIEW_URL;
  if (local && preview) throw new Error("Choose local or preview, never both.");
  if (preview !== undefined) {
    // Only immutable deployments of this project, never arbitrary bridge origins.
    if (!/^https:\/\/vendeplus-clean-[a-z0-9]{9}-entrega2-s-projects\.vercel\.app\/?$/.test(preview)) {
      throw new Error("SOMOS_ANDROID_PREVIEW_URL must be an exact HTTPS deployment URL for vendeplus-clean.");
    }
    const url = new URL(preview);
    return { url: url.origin, cleartext: false, allowNavigation: [url.hostname] };
  }
  if (local) return { url: "http://localhost:3107", cleartext: true, allowNavigation: ["localhost"] };
  return {
    url: "https://www.somos-ve.com",
    cleartext: false,
    allowNavigation: ["www.somos-ve.com", "somos-ve.com"],
  };
}
