import { resolveFriendUser } from "../resolveFriendUser";

describe("resolveFriendUser", () => {
  it("returns receiver user id when the current user is the sender", () => {
    const resolved = resolveFriendUser(
      {
        _id: "friendship-1",
        senderId: { _id: "user-current", fullname: "Current User" },
        receiverId: {
          _id: "user-friend",
          fullname: "Friend User",
          profile_picture: "friend.jpg",
        },
      },
      "user-current"
    );

    expect(resolved).toEqual({
      id: "user-friend",
      name: "Friend User",
      email: "",
      avatar: "friend.jpg",
    });
  });

  it("returns sender user id when the current user is the receiver", () => {
    const resolved = resolveFriendUser(
      {
        _id: "friendship-2",
        senderId: { _id: "user-friend", fullName: "Sender Friend" },
        receiverId: { _id: "user-current", fullname: "Current User" },
      },
      "user-current"
    );

    expect(resolved?.id).toBe("user-friend");
    expect(resolved?.name).toBe("Sender Friend");
  });

  it("does not use the friendship document id when nested user ids exist", () => {
    const resolved = resolveFriendUser(
      {
        _id: "friendship-document-id",
        senderId: "user-current",
        receiverId: "user-friend",
      },
      "user-current"
    );

    expect(resolved?.id).toBe("user-friend");
  });

  it("supports legacy flat user rows", () => {
    const resolved = resolveFriendUser({
      _id: "flat-user",
      fullname: "Flat Friend",
      avatar: "flat.png",
    });

    expect(resolved).toEqual({
      id: "flat-user",
      name: "Flat Friend",
      email: "",
      avatar: "flat.png",
    });
  });
});
