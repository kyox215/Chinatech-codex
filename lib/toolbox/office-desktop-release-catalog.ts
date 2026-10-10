// Candidate becomes selectable only after the release pipeline verifies both public EXE hashes.
export const currentVersion = '0.2.1';
export const previousPublishedVersion = '0.2.0';
// Legacy clients cannot report a trustworthy version. This sentinel keeps their key path during cutover.
export const eligibleMinimumVersions = ['0.0.0', '0.2.0'] as const;
