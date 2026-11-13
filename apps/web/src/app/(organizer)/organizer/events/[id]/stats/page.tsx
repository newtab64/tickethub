import { OrganizerOperationsPage } from "@/features/organizer";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <OrganizerOperationsPage view="reports" initialEventId={id} />;
}
