// apps/web/src/components/ui/custom-select.tsx
"use client";

import { useState, useRef, useEffect, useId } from "react";
import { ChevronDown, Check } from "lucide-react";

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
    <div className={`relative inline-block ${className}`} ref={containerRef}>
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
        className={`w-full h-10 px-3 rounded-md border border-input bg-background text-sm text-foreground text-left flex items-center justify-between gap-2 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:opacity-50 disabled:pointer-events-none hover:bg-secondary/40 ${
          isOpen ? "ring-2 ring-ring" : ""
        }`}
      >
        <span className="truncate flex items-center gap-2">
          {selectedOption ? (
            <>
              {selectedOption.icon && (
                <selectedOption.icon className="size-4 text-muted-foreground shrink-0" />
              )}
              <span className="text-foreground font-normal">
                {selectedOption.label}
              </span>
            </>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
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
          className="absolute left-0 mt-1.5 w-full min-w-[200px] max-h-60 overflow-y-auto rounded-md border border-border bg-popover text-popover-foreground shadow-lg py-1 z-50 text-xs focus:outline-none"
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
                className={`flex items-center justify-between px-3 py-2 cursor-pointer transition-colors ${
                  isFocused ? "bg-secondary text-foreground" : "text-foreground"
                } ${isSelected ? "font-semibold bg-accent/30 text-primary" : ""}`}
              >
                <div className="flex items-center gap-2 truncate">
                  {opt.icon && (
                    <opt.icon className="size-3.5 text-muted-foreground shrink-0" />
                  )}
                  <span className="truncate">{opt.label}</span>
                </div>
                {isSelected && (
                  <Check className="size-3.5 text-primary shrink-0 ml-2" />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
