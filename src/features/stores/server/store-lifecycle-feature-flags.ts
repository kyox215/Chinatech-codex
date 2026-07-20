type StoreLifecycleFeatureEnvironment = {
  STORE_LIFECYCLE_ENFORCEMENT_ENABLED?: string;
  STORE_LIFECYCLE_MUTATIONS_ENABLED?: string;
  STORE_LIFECYCLE_EXPORT_WORKER_ENABLED?: string;
  STORE_LIFECYCLE_PURGE_WORKER_ENABLED?: string;
  STORE_LIFECYCLE_PURGE_SCHEDULING_ENABLED?: string;
};

export function isStoreLifecycleEnforcementEnabled(
  env: StoreLifecycleFeatureEnvironment = process.env as StoreLifecycleFeatureEnvironment,
) {
  return env.STORE_LIFECYCLE_ENFORCEMENT_ENABLED === "1";
}

export function isStoreLifecycleExportWorkerEnabled(
  env: StoreLifecycleFeatureEnvironment = process.env as StoreLifecycleFeatureEnvironment,
) {
  return env.STORE_LIFECYCLE_EXPORT_WORKER_ENABLED === "1";
}

export function isStoreLifecyclePurgeWorkerEnabled(
  env: StoreLifecycleFeatureEnvironment = process.env as StoreLifecycleFeatureEnvironment,
) {
  return env.STORE_LIFECYCLE_PURGE_WORKER_ENABLED === "1";
}

export function isStoreLifecyclePurgeSchedulingEnabled(
  env: StoreLifecycleFeatureEnvironment = process.env as StoreLifecycleFeatureEnvironment,
) {
  return env.STORE_LIFECYCLE_PURGE_SCHEDULING_ENABLED === "1";
}

export function isStoreLifecycleMutationEnabled(
  env: StoreLifecycleFeatureEnvironment = process.env as StoreLifecycleFeatureEnvironment,
) {
  return env.STORE_LIFECYCLE_MUTATIONS_ENABLED === "1";
}

/**
 * Lifecycle mutations are only safe when the ordinary request enforcement is
 * already active. Keeping this dependency in code prevents a flag-ordering
 * mistake from opening a close path without protecting the rest of the app.
 */
export function isStoreLifecycleMutationSafeEnabled(
  env: StoreLifecycleFeatureEnvironment = process.env as StoreLifecycleFeatureEnvironment,
) {
  return isStoreLifecycleEnforcementEnabled(env) && isStoreLifecycleMutationEnabled(env);
}
