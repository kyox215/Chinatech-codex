# Memory Delta

## Device Unlock Pattern Rule

- RepairDesk app-level device unlock pattern passwords should use 4-9 unique 3x3 points.
- Repeated taps should not append or renumber selected dots.
- UI must show clear start/end information, and Save should be disabled until the pattern is valid.

## Migration Note

- The app-level rule has been tightened, but database validator parity was intentionally left for a separate migration task.
