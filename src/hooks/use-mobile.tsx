import * as React from "react";

export const MOBILE_BREAKPOINT = 768;
export const COMPACT_WORKSPACE_BREAKPOINT = 1024;

function useViewportBelow(breakpoint: number) {
  const [matches, setMatches] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const onChange = () => {
      setMatches(window.innerWidth < breakpoint);
    };
    mql.addEventListener("change", onChange);
    onChange();
    return () => mql.removeEventListener("change", onChange);
  }, [breakpoint]);

  return !!matches;
}

export function useIsMobile() {
  return useViewportBelow(MOBILE_BREAKPOINT);
}

// Touch-first iPad widths use the drawer shell without changing the meaning of "mobile"
// for existing high-risk consumers such as store lifecycle actions.
export function useIsCompactWorkspace() {
  return useViewportBelow(COMPACT_WORKSPACE_BREAKPOINT);
}
