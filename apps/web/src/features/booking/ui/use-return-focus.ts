import { useRef } from "react";

/**
 * Hộp thoại mở bằng state (không có Dialog.Trigger) nên Radix không biết trả
 * tiêu điểm về đâu: ghi lại phần tử đang focus lúc mở.
 */
export function useReturnFocus() {
  const opener = useRef<Element | null>(null);
  return {
    onOpenAutoFocus: () => {
      opener.current = document.activeElement;
    },
    onCloseAutoFocus: (event: Event) => {
      event.preventDefault();
      if (opener.current instanceof HTMLElement) opener.current.focus();
    },
  };
}
