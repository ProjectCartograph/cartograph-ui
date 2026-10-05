import { Compass } from "lucide-react";

import { SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { copy } from "@/copy";
import { useTour } from "./tourContext";

/** The rail's way into the guided tour, at any time. */
export function TourEntry() {
  const tour = useTour();
  return (
    <SidebarMenuItem>
      <SidebarMenuButton tooltip={copy.tour.rail} onClick={() => tour.start()} isActive={tour.at !== null} data-slot="tour-entry">
        <Compass />
        <span>{copy.tour.rail}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
