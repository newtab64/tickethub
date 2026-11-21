import type { GetTicketQrResponse, MyTicketItem } from "@tickethub/shared";
import { apiClient, getAccessToken } from "@/shared/api/client";

export async function fetchBuyerTickets(
  limit = 20,
): Promise<MyTicketItem[] | null> {
  if (!getAccessToken()) return null;
  try {
    const res = await apiClient<MyTicketItem[] | { items: MyTicketItem[] }>(
      `/tickets/my-tickets?limit=${limit}`,
    );
    if (Array.isArray(res)) return res;
    return Array.isArray(res?.items) ? res.items : null;
  } catch {
    return null;
  }
}

export async function fetchDynamicTicketQr(
  ticketId: string,
): Promise<GetTicketQrResponse | null> {
  if (!getAccessToken()) return null;
  try {
    return await apiClient<GetTicketQrResponse>(`/tickets/${ticketId}/qr`);
  } catch {
    return null;
  }
}
