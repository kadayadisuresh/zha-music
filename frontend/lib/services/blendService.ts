export const blendService = {
  getBlends: async () => {
    const res = await fetch("/api/blend/list");
    return res.json();
  },
  sendInvite: async (toUserId: number) => {
    const res = await fetch("/api/blend/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to_user_id: toUserId }),
    });
    return res.json();
  },
  acceptInvite: async (inviteId: number) => {
    const res = await fetch(`/api/blend/accept/${inviteId}`, {
      method: "POST",
    });
    return res.json();
  },
};
