"use client";

import Image from "next/image";
import { useState } from "react";
import { ImagePlaceholder } from "@/shared/ui/image-placeholder";

export function EventPoster({
  event,
  sizes,
  labeled = false,
  eager = false,
  imageClassName = "",
}: {
  event: { id: string; title: string; bannerUrl?: string | null };
  sizes: string;
  labeled?: boolean;
  eager?: boolean;
  imageClassName?: string;
}) {
  const banner = event.bannerUrl?.trim();
  const src =
    banner && /^(\/[^/\\]|https?:\/\/)/i.test(banner) ? banner : undefined;
  const [failedSrc, setFailedSrc] = useState<string>();

  if (!src || failedSrc === src) {
    return <ImagePlaceholder iconClassName="size-7 sm:size-10" />;
  }

  return (
    <Image
      src={src}
      alt={labeled ? `Ảnh sự kiện ${event.title}` : ""}
      fill
      sizes={sizes}
      unoptimized={!src.startsWith("/")}
      className={`object-cover transition-transform duration-300 motion-safe:group-hover:scale-[1.03] ${imageClassName}`}
      loading={eager ? "eager" : undefined}
      fetchPriority={eager ? "high" : undefined}
      quality={eager ? 60 : undefined}
      onError={() => setFailedSrc(src)}
    />
  );
}
