"use client";

import { useState, useRef, useEffect, useId } from "react";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/shared/lib/utils";

export interface SelectOption {
  value: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
}

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
  disabled?: boolean;
  id?: string;
  /** Ô nằm thẳng trên nền xám: nền trắng, viền và bóng. */
  surface?: boolean;
  /** Danh sách mở ra canh theo mép trái hoặc phải của ô. */
  align?: "start" | "end";
}

export function CustomSelect({
  value,
  onChange,
  options,
  placeholder = "Chọn một mục",
  ariaLabel,
  className = "",
  disabled = false,
  id: customId,
  surface = false,
  align = "start",
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listboxRef = useRef<HTMLUListElement>(null);
  const autoId = useId();
  const id = customId || autoId;

  const selectedOption = options.find((opt) => opt.value === value);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (!isOpen) {
      if (
        e.key === "Enter" ||
        e.key === " " ||
        e.key === "ArrowDown" ||
        e.key === "ArrowUp"
      ) {
        e.preventDefault();
        setIsOpen(true);
        const idx = options.findIndex((opt) => opt.value === value);
        setFocusedIndex(idx >= 0 ? idx : 0);
      }
      return;
    }

    switch (e.key) {
      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        break;
      case "ArrowDown":
        e.preventDefault();
        setFocusedIndex((prev) => (prev < options.length - 1 ? prev + 1 : 0));
        break;
      case "ArrowUp":
        e.preventDefault();
        setFocusedIndex((prev) => (prev > 0 ? prev - 1 : options.length - 1));
        break;
      case "Home":
        e.preventDefault();
        setFocusedIndex(0);
        break;
      case "End":
        e.preventDefault();
        setFocusedIndex(options.length - 1);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        if (focusedIndex >= 0 && focusedIndex < options.length) {
          const opt = options[focusedIndex];
          if (opt) {
            onChange(opt.value);
            setIsOpen(false);
          }
        }
        break;
      case "Tab":
        setIsOpen(false);
        break;
    }
  };

  return (
    <div
      className={`relative inline-block max-w-full ${className}`}
      ref={containerRef}
    >
      <button
        type="button"
        id={id}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={`${id}-listbox`}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            setIsOpen((prev) => !prev);
            const idx = options.findIndex((opt) => opt.value === value);
            setFocusedIndex(idx >= 0 ? idx : 0);
          }
        }}
        onKeyDown={handleKeyDown}
        aria-activedescendant={
          isOpen && focusedIndex >= 0
            ? `${id}-option-${focusedIndex}`
            : undefined
        }
        className={cn(
          "flex h-12 w-full cursor-pointer items-center justify-between gap-2 rounded-full bg-field px-5 text-left text-[15px] text-foreground transition-colors focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-solid disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none",
          surface &&
            "h-11 bg-background px-4 font-semibold shadow-md ring-1 ring-control-border hover:bg-muted",
          isOpen && "outline-2 outline-primary outline-solid",
        )}
      >
        <span className="flex min-w-0 items-center gap-2">
          {selectedOption ? (
            <>
              {selectedOption.icon && (
                <selectedOption.icon className="size-4 text-muted-foreground shrink-0" />
              )}
              <span className="truncate font-normal text-foreground">
                {selectedOption.label}
              </span>
            </>
          ) : (
            <span className="truncate text-muted-foreground">
              {placeholder}
            </span>
          )}
        </span>
        <ChevronDown
          className={`size-4 text-muted-foreground transition-transform duration-200 shrink-0 ${
            isOpen ? "rotate-180" : ""
          }`}
          aria-hidden="true"
        />
      </button>

      {isOpen && (
        <ul
          id={`${id}-listbox`}
          ref={listboxRef}
          role="listbox"
          aria-labelledby={id}
          tabIndex={-1}
          className={cn(
            "absolute z-50 mt-2 max-h-96 w-full min-w-60 overflow-y-auto rounded-3xl bg-popover p-2 text-[15px] text-popover-foreground shadow-sheet ring-1 ring-foreground/5 focus:outline-none",
            align === "end" ? "right-0" : "left-0",
            // Ô lọc trên nền xám hẹp hơn danh sách nên cho danh sách rộng riêng.
            surface && "min-w-75",
          )}
        >
          {options.map((opt, idx) => {
            const isSelected = opt.value === value;
            const isFocused = idx === focusedIndex;

            return (
              <li
                key={opt.value}
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                onMouseEnter={() => setFocusedIndex(idx)}
                id={`${id}-option-${idx}`}
                className={cn(
                  "flex min-h-11 cursor-pointer items-center justify-between rounded-2xl px-4 py-2",
                  isFocused && "bg-muted",
                  isSelected && "font-semibold",
                )}
              >
                <div className="flex min-w-0 items-center gap-2">
                  {opt.icon && (
                    <opt.icon className="size-4 shrink-0 text-muted-foreground" />
                  )}
                  <span className="break-words">{opt.label}</span>
                </div>
                {isSelected && <Check className="ml-2 size-4 shrink-0" />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
