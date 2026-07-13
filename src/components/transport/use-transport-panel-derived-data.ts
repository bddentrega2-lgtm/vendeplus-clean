import { useMemo } from "react";
import { getTransportAgencyConfigIssues, getTransportAgencyRateFromRelation } from "@/lib/transport";
import { connectionEnded, type Agency } from "@/components/transport/transport-panel-helpers";

export function useTransportPanelDerivedData({
  agency,
  requests,
  connections,
  nowMs,
}: {
  agency: Agency | null;
  requests: any[];
  connections: any[];
  nowMs: number;
}) {
  const rate = useMemo(
    () => getTransportAgencyRateFromRelation(agency?.transport_agency_rates) || {},
    [agency?.transport_agency_rates]
  );

  const zones = useMemo(
    () =>
      [...(agency?.transport_agency_zones || [])]
        .filter((zone) => zone.is_active !== false)
        .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0)),
    [agency?.transport_agency_zones]
  );

  const distanceRates = useMemo(
    () =>
      [...(agency?.transport_agency_distance_rates || [])]
        .filter((entry) => entry.is_active !== false)
        .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0)),
    [agency?.transport_agency_distance_rates]
  );

  const pendingRequests = useMemo(
    () => requests.filter((entry) => entry.status === "pending"),
    [requests]
  );

  const configIssues = useMemo(
    () =>
      agency
        ? getTransportAgencyConfigIssues({
            agency,
            rate,
            zones,
            distanceRates,
          })
        : [],
    [agency, rate, zones, distanceRates]
  );

  const activeConnectionsCount = useMemo(
    () =>
      connections.filter(
        (entry) => entry.status === "active" && !connectionEnded(entry, nowMs)
      ).length,
    [connections, nowMs]
  );

  return {
    activeConnectionsCount,
    configIssues,
    distanceRates,
    pendingRequests,
    rate,
    zones,
  };
}
