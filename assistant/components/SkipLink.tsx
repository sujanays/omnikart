"use client";

import { useApp } from "@/assistant/client/store";
import { ui } from "@/assistant/client/ui-text";

export function SkipLink() {
  const { lang } = useApp();
  return (
    <a className="skip" href="#main">
      {ui("skip", lang)}
    </a>
  );
}
