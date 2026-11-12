import type { VenueMapKey } from "@/features/venue";
import type { EventItem } from "./event.types";

export function getEventVenueMapKey(event: EventItem): VenueMapKey {
  if (event.category === "SPORT") {
    if (event.id.includes("vba") || event.id.includes("saigon-heat")) {
      return "arena-basketball";
    }
    return "stadium-football";
  }
  if (event.category === "THEATER") {
    return "theater";
  }
  if (
    event.id === "evt-ha-anh-tuan-sketch-a-rose" ||
    event.id === "evt-nhung-thanh-pho-mo-mang" ||
    event.id === "evt-my-tam-tri-am"
  ) {
    return "stadium-concert";
  }
  return "arena-t-stage";
}
