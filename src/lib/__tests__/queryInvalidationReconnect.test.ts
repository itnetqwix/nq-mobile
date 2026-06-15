import { QueryClient } from "@tanstack/react-query";
import { invalidateOnSocketReconnect } from "../queryInvalidation";
import { queryKeys } from "../queryKeys";

jest.mock("../../store/store", () => ({
  store: {
    getState: () => ({ auth: { accountType: "Trainee" } }),
  },
}));

describe("invalidateOnSocketReconnect", () => {
  it("skips sessions.upcoming when fetched within 30s", () => {
    const client = new QueryClient();
    client.setQueryData(queryKeys.sessions.upcoming, [{ _id: "a" }]);
    const query = client.getQueryCache().find({ queryKey: queryKeys.sessions.upcoming });
    if (query) {
      query.setState({
        ...query.state,
        dataUpdatedAt: Date.now(),
      });
    }

    invalidateOnSocketReconnect(client);

    expect(query?.state.isInvalidated).not.toBe(true);
  });
});
