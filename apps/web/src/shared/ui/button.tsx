import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/shared/lib/utils";
import { Slot } from "radix-ui";

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-2 rounded-full border border-transparent bg-clip-padding text-[15px] font-semibold whitespace-nowrap transition-colors outline-none select-none cursor-pointer motion-reduce:transition-none disabled:pointer-events-none disabled:cursor-default disabled:opacity-50 focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary-strong",
        outline:
          "bg-fill text-foreground hover:bg-fill-hover aria-expanded:bg-fill-hover",
        secondary:
          "bg-fill text-foreground hover:bg-fill-hover aria-expanded:bg-fill-hover",
        // Cho nút nằm thẳng trên nền xám, nơi nền fill bị chìm.
        surface:
          "bg-background text-foreground shadow-md ring-1 ring-control-border hover:bg-muted",
        ghost: "text-foreground hover:bg-fill aria-expanded:bg-fill",
        destructive: "text-destructive hover:bg-destructive/10",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-6",
        lg: "h-12 px-6",
        icon: "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
