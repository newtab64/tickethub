"use client";

import { Suspense } from "react";

import { EventsHeader } from "./events-header";
import { EventsSummaryStrip } from "./events-summary-strip";
import { EventsToolbar } from "./events-toolbar";
import { EventsTableViews } from "./events-table-views";
import { EventsDevSwitcher } from "./events-dev-switcher";
import { useOrganizerEventsScreen } from "./use-organizer-events-screen";

function OrganizerEventsContent() {
  const vm = useOrganizerEventsScreen();

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-8 space-y-6">
      <EventsHeader />
      <EventsSummaryStrip vm={vm} />
      <EventsToolbar vm={vm} />
      <EventsTableViews vm={vm} />
      <EventsDevSwitcher vm={vm} />
    </div>
  );
}

export function OrganizerEventsPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-[1200px] mx-auto px-4 py-8 text-xs text-muted-foreground">
          Đang tải trang sự kiện...
        </div>
      }
    >
      <OrganizerEventsContent />
    </Suspense>
  );
}
