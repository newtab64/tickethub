"use client";

import { MyTicketsLink } from "@/shared/ui/site-header";
import { showsMyTickets } from "../domain/account-menu";
import { AccountMenu } from "./account-menu";
import { useSession } from "./session-provider";

/** Góc phải dùng chung của header: "Vé của tôi" và menu tài khoản. */
export function HeaderActions({
  ticketsCurrent,
  ticketsClassName,
  allowLogout,
}: {
  ticketsCurrent?: boolean;
  ticketsClassName?: string;
  allowLogout?: boolean;
}) {
  const { user } = useSession();
  return (
    <>
      {showsMyTickets(user?.role ?? null) && (
        <MyTicketsLink current={ticketsCurrent} className={ticketsClassName} />
      )}
      <AccountMenu allowLogout={allowLogout} />
    </>
  );
}
