import { useCallback, useRef, type MouseEvent, type PointerEvent, type TouchEvent } from "react";

type SetDropdownOpen = (value: boolean | ((current: boolean) => boolean)) => void;

type TouchPointerState = {
  pointerId: number;
  startX: number;
  startY: number;
  moved: boolean;
};

type TouchState = {
  identifier: number;
  startX: number;
  startY: number;
  moved: boolean;
};

const DEFAULT_DRAG_THRESHOLD_PX = 8;

export function useTouchSafeDropdownTrigger(
  setOpen: SetDropdownOpen,
  dragThresholdPx = DEFAULT_DRAG_THRESHOLD_PX,
) {
  const pointerRef = useRef<TouchPointerState | null>(null);
  const touchRef = useRef<TouchState | null>(null);
  const ignoreNextClickRef = useRef(false);

  const clearClickGuardSoon = useCallback(() => {
    window.setTimeout(() => {
      ignoreNextClickRef.current = false;
    }, 0);
  }, []);

  const handlePointerDownCapture = useCallback((event: PointerEvent<HTMLElement>) => {
    if (event.pointerType !== "touch" && event.pointerType !== "pen") return;

    pointerRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
    };
    event.stopPropagation();
  }, []);

  const handlePointerMoveCapture = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      const pointer = pointerRef.current;
      if (!pointer || pointer.pointerId !== event.pointerId) return;

      const distanceX = Math.abs(event.clientX - pointer.startX);
      const distanceY = Math.abs(event.clientY - pointer.startY);
      if (distanceX > dragThresholdPx || distanceY > dragThresholdPx) {
        pointer.moved = true;
      }
      event.stopPropagation();
    },
    [dragThresholdPx],
  );

  const handlePointerUpCapture = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      const pointer = pointerRef.current;
      if (!pointer || pointer.pointerId !== event.pointerId) return;

      event.stopPropagation();
      ignoreNextClickRef.current = true;
      pointerRef.current = null;

      if (!pointer.moved) {
        event.preventDefault();
        setOpen((current) => !current);
      }
      clearClickGuardSoon();
    },
    [clearClickGuardSoon, setOpen],
  );

  const handlePointerCancelCapture = useCallback((event: PointerEvent<HTMLElement>) => {
    const pointer = pointerRef.current;
    if (!pointer || pointer.pointerId !== event.pointerId) return;

    event.stopPropagation();
    pointerRef.current = null;
    ignoreNextClickRef.current = true;
    window.setTimeout(() => {
      ignoreNextClickRef.current = false;
    }, 0);
  }, []);

  const handleTouchStartCapture = useCallback((event: TouchEvent<HTMLElement>) => {
    event.stopPropagation();
    if (pointerRef.current || event.changedTouches.length === 0) return;

    const touch = event.changedTouches[0];
    touchRef.current = {
      identifier: touch.identifier,
      startX: touch.clientX,
      startY: touch.clientY,
      moved: false,
    };
  }, []);

  const handleTouchMoveCapture = useCallback(
    (event: TouchEvent<HTMLElement>) => {
      const touchState = touchRef.current;
      event.stopPropagation();
      if (!touchState) return;

      const touch = findChangedTouch(event, touchState.identifier);
      if (!touch) return;

      const distanceX = Math.abs(touch.clientX - touchState.startX);
      const distanceY = Math.abs(touch.clientY - touchState.startY);
      if (distanceX > dragThresholdPx || distanceY > dragThresholdPx) {
        touchState.moved = true;
      }
    },
    [dragThresholdPx],
  );

  const handleTouchEndCapture = useCallback(
    (event: TouchEvent<HTMLElement>) => {
      const touchState = touchRef.current;
      event.stopPropagation();
      if (!touchState) return;

      const touch = findChangedTouch(event, touchState.identifier);
      if (!touch) return;

      ignoreNextClickRef.current = true;
      touchRef.current = null;

      if (!touchState.moved) {
        event.preventDefault();
        setOpen((current) => !current);
      }
      clearClickGuardSoon();
    },
    [clearClickGuardSoon, setOpen],
  );

  const handleTouchCancelCapture = useCallback(
    (event: TouchEvent<HTMLElement>) => {
      event.stopPropagation();
      touchRef.current = null;
      ignoreNextClickRef.current = true;
      clearClickGuardSoon();
    },
    [clearClickGuardSoon],
  );

  const handleClickCapture = useCallback((event: MouseEvent<HTMLElement>) => {
    if (!ignoreNextClickRef.current) return;

    event.preventDefault();
    event.stopPropagation();
  }, []);

  return {
    onPointerDownCapture: handlePointerDownCapture,
    onPointerMoveCapture: handlePointerMoveCapture,
    onPointerUpCapture: handlePointerUpCapture,
    onPointerCancelCapture: handlePointerCancelCapture,
    onTouchStartCapture: handleTouchStartCapture,
    onTouchMoveCapture: handleTouchMoveCapture,
    onTouchEndCapture: handleTouchEndCapture,
    onTouchCancelCapture: handleTouchCancelCapture,
    onClickCapture: handleClickCapture,
  };
}

function findChangedTouch(event: TouchEvent<HTMLElement>, identifier: number) {
  return Array.from(event.changedTouches).find((touch) => touch.identifier === identifier);
}
