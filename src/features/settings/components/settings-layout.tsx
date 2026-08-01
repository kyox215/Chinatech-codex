import type { ReactNode } from "react";

import type { SettingsSectionDefinition } from "@/features/settings/model/settings-section-registry";

export interface SettingsLayoutProps {
  activeSection: SettingsSectionDefinition | null;
  rail: ReactNode;
  children: ReactNode;
}

export function SettingsLayout({ activeSection, rail, children }: SettingsLayoutProps) {
  return (
    <div
      data-settings-layout
      className="mx-auto grid w-full min-w-0 max-w-[1232px] gap-3 lg:grid-cols-[clamp(208px,calc(10vw+96px),240px)_minmax(0,1fr)]"
    >
      <aside data-settings-rail className="hidden min-w-0 lg:block">
        <div className="sticky top-[4.25rem] max-h-[calc(100svh-5rem)] overflow-y-auto">{rail}</div>
      </aside>

      <section data-settings-content className="w-full min-w-0 max-w-[980px]">
        {children}
      </section>
    </div>
  );
}
