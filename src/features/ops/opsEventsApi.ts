import { apiClient } from "../../api/client";

export type ReportOpsEventInput = {
  event_type: string;
  category?: string;
  severity?: string;
  session_id?: string;
  title?: string;
  summary?: string;
  payload?: Record<string, unknown>;
  correlation_id?: string;
};

/** Fire-and-forget client ops telemetry. */
export function reportOpsEvent(input: ReportOpsEventInput): void {
  void apiClient
    .post("/ops/events/report", {
      ...input,
      client: {
        platform: "react-native",
      },
    })
    .catch((err) => {
      console.warn("[opsEventsApi]", input.event_type, err?.message);
    });
}
