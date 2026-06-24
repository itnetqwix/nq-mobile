/**
 * Integration-style tests for scheduled booking API helpers (mobile).
 */
import { holdScheduledSlot, validateSlotRange } from "../scheduledBookingApi";
import { apiClient } from "../../../api/client";

jest.mock("../../../api/client", () => ({
  apiClient: {
    post: jest.fn(),
  },
}));

const mockPost = apiClient.post as jest.Mock;

describe("scheduledBookingApi integration", () => {
  beforeEach(() => {
    mockPost.mockReset();
  });

  it("holdScheduledSlot posts expected payload", async () => {
    mockPost.mockResolvedValue({
      data: { data: { held: true, expiresInMinutes: 10 } },
    });
    const result = await holdScheduledSlot({
      trainerId: "t1",
      bookedDateIso: "2026-12-15",
      traineeTimeZone: "America/New_York",
      from: "14:00",
      to: "14:30",
    });
    expect(mockPost).toHaveBeenCalledWith(
      "/trainee/hold-scheduled-slot",
      expect.objectContaining({
        trainer_id: "t1",
        session_start_time: "14:00",
        session_end_time: "14:30",
      })
    );
    expect(result.held).toBe(true);
  });

  it("validateSlotRange posts exact slot window", async () => {
    mockPost.mockResolvedValue({
      data: { data: { isAvailable: true } },
    });
    await validateSlotRange({
      trainerId: "t1",
      bookedDateIso: "2026-12-15",
      traineeTimeZone: "America/New_York",
      from: "14:00",
      to: "15:00",
    });
    expect(mockPost).toHaveBeenCalledWith(
      "/trainee/check-slot",
      expect.objectContaining({
        slotTime: { from: "14:00", to: "15:00" },
      })
    );
  });
});
