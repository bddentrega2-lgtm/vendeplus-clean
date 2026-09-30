"use client";
import { Star } from "lucide-react";
import { useEffect, useState } from "react";
type Summary = { average: number; count: number };
export function StoreRating({ summary, storeId }: { summary?: Summary | null; storeId?: string }) {
  const [loaded, setLoaded] = useState<Summary | null>(null);
  useEffect(() => {
    if (!storeId || summary !== undefined) return;
    const controller = new AbortController();
    void fetch(`/api/marketplace/ratings?store=${encodeURIComponent(storeId)}`, { signal: controller.signal })
      .then(async response => { if (response.ok) setLoaded((await response.json()).rating); }).catch(() => {});
    return () => controller.abort();
  }, [storeId, summary]);
  const rating = summary === undefined ? loaded : summary;
  return rating?.count ? <span className="buyer-store-rating" aria-label={`${rating.average.toFixed(1)} de 5, ${rating.count} calificaciones`}><Star size={15} fill="currentColor" />{rating.average.toFixed(1)} <span>({rating.count})</span></span> : null;
}
