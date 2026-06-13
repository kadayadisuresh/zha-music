import { apiClient } from "@/lib/api/client";

export const blendService = {
  getBlends: async () => {
    // Backend route: GET /blend/list (requires auth). Fall back to an empty
    // list on error so the page renders its empty state instead of crashing.
    try {
      return await apiClient<unknown[]>("/blend/list");
    } catch {
      return [];
    }
  },
  sendInvite: async (toUserId: number) => {
    return apiClient("/blend/invite", {
      method: "POST",
      body: JSON.stringify({ to_user_id: toUserId }),
    });
  },
  acceptInvite: async (inviteId: number) => {
    return apiClient(`/blend/accept/${inviteId}`, {
      method: "POST",
    });
  },
};
