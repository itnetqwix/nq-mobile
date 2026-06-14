jest.mock("../../store/store", () => ({
  store: {
    getState: () => ({ auth: { accountType: null } }),
  },
}));

import { QueryClient } from "@tanstack/react-query";
import {
  patchSessionInQueryCaches,
  upsertSessionInQueryCaches,
} from "../queryInvalidation";
import { queryKeys } from "../queryKeys";

describe("queryInvalidation session cache helpers", () => {
  let client: QueryClient;

  beforeEach(() => {
    client = new QueryClient();
    client.setQueryData(queryKeys.sessions.list("upcoming"), [
      { _id: "a", status: "pending" },
      { _id: "b", status: "confirm" },
    ]);
    client.setQueryData(queryKeys.scheduledMeetings, [
      { _id: "b", status: "confirm" },
    ]);
  });

  it("patches a session row across session queries", () => {
    patchSessionInQueryCaches(client, "a", { status: "confirmed" });
    const upcoming = client.getQueryData<{ _id: string; status: string }[]>(
      queryKeys.sessions.list("upcoming")
    );
    expect(upcoming?.[0].status).toBe("confirmed");
    expect(upcoming?.[1].status).toBe("confirm");
  });

  it("upserts a new session at the front", () => {
    upsertSessionInQueryCaches(client, { _id: "c", status: "pending" });
    const upcoming = client.getQueryData<{ _id: string }[]>(
      queryKeys.sessions.list("upcoming")
    );
    expect(upcoming?.[0]._id).toBe("c");
    expect(upcoming).toHaveLength(3);
  });

  it("merges when upserting an existing id", () => {
    upsertSessionInQueryCaches(client, { _id: "b", status: "completed" });
    const meetings = client.getQueryData<{ _id: string; status: string }[]>(
      queryKeys.scheduledMeetings
    );
    expect(meetings).toHaveLength(1);
    expect(meetings?.[0].status).toBe("completed");
  });
});
