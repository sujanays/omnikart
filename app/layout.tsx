import type { Metadata, Viewport } from "next";
import "@/app/globals.css";
import { AssistantProvider, FlashEdge } from "@/assistant/components/AssistantProvider";
import { AssistantDock } from "@/assistant/components/AssistantDock";
import { FocusView } from "@/assistant/components/FocusView";
import { CalmCard, ScanBanner } from "@/assistant/components/Overlays";

export const metadata: Metadata = {
  title: { default: "Haat with Omnikart: a shopping guide you can talk to", template: "%s · Haat with Omnikart" },
  description: "A demo store in English, Hindi and Telugu, with Omnikart, a voice shopping guide made for blind, low-vision, hand-motor and older shoppers.",
};

// No maximum-scale: shoppers must be able to pinch-zoom.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#131921",
};

/**
 * Two layers on one page. The store (app/(store), store/, store.css) is the reference platform.
 * Omnikart (assistant/, mounted below) sits on top of it and talks to it only through contract/: HTTP and page events.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  // NEXT_PUBLIC_ASSISTANT=off serves the store on its own: no guide, no microphone, nothing of ours on the page.
  if (process.env.NEXT_PUBLIC_ASSISTANT === "off") {
    return (
      <html lang="en">
        <body>{children}</body>
      </html>
    );
  }
  return (
    <html lang="en">
      <body data-dock="open">
        <AssistantProvider>
          {children}
          <AssistantDock />
          <FocusView />
          <CalmCard />
          <ScanBanner />
          <FlashEdge />
        </AssistantProvider>
      </body>
    </html>
  );
}
