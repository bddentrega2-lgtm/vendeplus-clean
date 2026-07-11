import { createHash } from "crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, RateLimitBucket>();

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  source: "database" | "memory" | "memory_fallback";
};

type RateLimitOptions = {
  key: string;
  limit: number;
  windowMs: number;
};

export function getClientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const candidate = forwardedFor?.split(",")[0]?.trim() || realIp || "unknown";

  return candidate.replace(/[^a-zA-Z0-9:._-]/g, "").slice(0, 80) || "unknown";
}

export function checkRateLimit({
  key,
  limit,
  windowMs,
}: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return {
      allowed: true,
      remaining: limit - 1,
      resetAt: now + windowMs,
      source: "memory",
    };
  }

  if (existing.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: existing.resetAt,
      source: "memory",
    };
  }

  existing.count += 1;
  buckets.set(key, existing);

  return {
    allowed: true,
    remaining: Math.max(0, limit - existing.count),
    resetAt: existing.resetAt,
    source: "memory",
  };
}

function hashRateLimitKey(key: string) {
  return createHash("sha256").update(key).digest("hex");
}

export async function checkDistributedRateLimit(
  options: RateLimitOptions
): Promise<RateLimitResult> {
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.rpc("check_rate_limit", {
      p_key_hash: hashRateLimitKey(options.key),
      p_limit: options.limit,
      p_window_seconds: Math.max(1, Math.ceil(options.windowMs / 1000)),
    });

    if (error) throw error;

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) throw new Error("Rate limit sin respuesta.");

    return {
      allowed: Boolean(row.allowed),
      remaining: Math.max(0, Number(row.remaining || 0)),
      resetAt: new Date(row.reset_at).getTime(),
      source: "database",
    };
  } catch {
    const fallback = checkRateLimit(options);
    return {
      ...fallback,
      source: "memory_fallback",
    };
  }
}

export function rateLimitHeaders(result: RateLimitResult, limit: number) {
  const retryAfter = Math.max(
    1,
    Math.ceil((result.resetAt - Date.now()) / 1000)
  );

  return {
    "Retry-After": String(retryAfter),
    "X-RateLimit-Limit": String(limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
  };
}
