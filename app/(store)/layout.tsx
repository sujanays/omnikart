import "@/app/store.css";
import { StoreFooter, StoreHeader } from "@/store/components/StoreChrome";
import { StoreBridge } from "@/store/client/StoreBridge";

/** The reference store. It knows nothing about Omnikart; the guide docks on top of it. */
export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="store">
      <StoreBridge />
      <StoreHeader />
      <main id="main" tabIndex={-1}>
        {children}
      </main>
      <StoreFooter />
    </div>
  );
}
