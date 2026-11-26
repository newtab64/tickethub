// apps/web/src/components/ui/image-placeholder.tsx
import {
  Music,
  Trophy,
  Drama,
  Building2,
  Landmark,
  Calendar,
  Layers,
  type LucideIcon,
} from "lucide-react";

interface ImagePlaceholderProps {
  type?: "event" | "venue";
  category?: string;
  className?: string;
  iconClassName?: string;
  title?: string;
}

export function ImagePlaceholder({
  type = "event",
  category = "",
  className = "",
  iconClassName = "size-6",
  title,
}: ImagePlaceholderProps) {
  let Icon: LucideIcon = Calendar;
  const lowerCat = category.toLowerCase();

  if (
    lowerCat.includes("nhạc") ||
    lowerCat.includes("concert") ||
    lowerCat.includes("music")
  ) {
    Icon = Music;
  } else if (
    lowerCat.includes("thao") ||
    lowerCat.includes("bóng") ||
    lowerCat.includes("sport") ||
    lowerCat.includes("vba") ||
    lowerCat.includes("v-league")
  ) {
    Icon = Trophy;
  } else if (
    lowerCat.includes("kịch") ||
    lowerCat.includes("sân khấu") ||
    lowerCat.includes("theater") ||
    lowerCat.includes("drama")
  ) {
    Icon = Drama;
  } else if (
    lowerCat.includes("stadium") ||
    lowerCat.includes("vận động") ||
    lowerCat.includes("quốc gia")
  ) {
    Icon = Landmark;
  } else if (
    lowerCat.includes("arena") ||
    lowerCat.includes("thi đấu") ||
    type === "venue"
  ) {
    Icon = Building2;
  } else if (lowerCat.includes("sơ đồ")) {
    Icon = Layers;
  }

  return (
    <div
      title={title}
      className={`size-full flex flex-col items-center justify-center bg-secondary text-muted-foreground border border-border select-none ${className}`}
    >
      <Icon className={`${iconClassName} stroke-[1.75]`} aria-hidden="true" />
    </div>
  );
}
