import { HomePage, fetchPublicEvents } from "@/features/event";

// Danh sach su kien doc luc co yeu cau: build khong can API.
export const dynamic = "force-dynamic";

export default async function Page() {
  return <HomePage events={await fetchPublicEvents()} />;
}
