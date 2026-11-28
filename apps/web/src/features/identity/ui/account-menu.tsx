"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { accountMenuItems } from "../domain/account-menu";
import { useSession } from "./session-provider";

const ITEM =
  "flex min-h-11 w-full items-center rounded-2xl px-4 text-left text-[15px] hover:bg-muted focus-visible:bg-muted";

/** Góc phải header: menu tài khoản, hoặc nút đăng nhập khi chưa đăng nhập. */
export function AccountMenu({
  allowLogout = true,
}: {
  /** Trang đang giữ ghế tắt đăng xuất để không để lại chỗ giữ treo. */
  allowLogout?: boolean;
}) {
  const { user, isLoading, logout } = useSession();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      trigger.current?.focus();
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Giữ sẵn một ô trong lúc phiên đang được đọc.
  if (isLoading) return <span aria-hidden="true" className="size-11" />;
  if (!user) {
    return (
      <Link
        href="/auth"
        className="flex h-11 items-center rounded-full bg-primary px-6 text-[15px] font-semibold whitespace-nowrap text-primary-foreground hover:bg-primary-strong max-[359px]:px-3 max-[359px]:text-[13px]"
      >
        Đăng nhập
      </Link>
    );
  }

  const name = user.fullName?.trim() || user.email;
  return (
    <div
      ref={root}
      className="relative"
      onBlur={(event) => {
        // Safari không đặt focus khi bấm chuột: không rõ đích thì giữ menu.
        const next = event.relatedTarget;
        if (next && !event.currentTarget.contains(next)) setOpen(false);
      }}
    >
      <button
        ref={trigger}
        type="button"
        aria-label="Tài khoản"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="group flex h-11 cursor-pointer items-center gap-1 rounded-full px-1"
      >
        <span className="flex size-9 items-center justify-center rounded-full bg-fill text-[13px] font-semibold group-hover:bg-fill-hover">
          {name.charAt(0).toUpperCase()}
        </span>
        <ChevronDown
          aria-hidden="true"
          className={`size-3.5 stroke-[3] transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div
          id="account-menu"
          // -right-1.5 bù padding phải của header để hai mép phải trùng nhau.
          className="absolute top-14 -right-1.5 z-40 w-66 rounded-3xl bg-popover p-2 shadow-sheet ring-1 ring-foreground/5"
        >
          <div className="mb-2 border-b border-border px-4 pt-2 pb-4">
            <p className="truncate text-[15px] font-semibold">{name}</p>
            <p className="truncate text-[13px] text-muted-foreground">
              {user.email}
            </p>
          </div>
          {accountMenuItems(user.role).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={ITEM}
            >
              {item.label}
            </Link>
          ))}
          {allowLogout && (
            <button
              type="button"
              className={`${ITEM} cursor-pointer text-destructive`}
              onClick={async () => {
                setOpen(false);
                await logout();
                router.push("/auth");
              }}
            >
              Đăng xuất
            </button>
          )}
        </div>
      )}
    </div>
  );
}
