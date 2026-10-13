namespace ChinaTech.OfficeAssistant;

public enum PrimaryOperation { InstallActivate, Resume, Activate }

/// <summary>Selects a suggested operation only. Fresh inspection and all worker gates still apply.</summary>
public static class PresentationPolicy {
 public static int? DisplayPercentage(JobProgress? progress) {
  if (progress == null || ProgressPolicy.Percentage(progress) is not { } percentage) return null;
  return progress.Total == progress.Completed ? 100 : Math.Min(99, (int)Math.Floor(percentage));
 }
 public static PrimaryOperation Primary(JobRecord? job, Inventory? inventory, bool ownsJob) {
  if (!ownsJob || job == null) return PrimaryOperation.InstallActivate;
  if (job.Status == JobStatus.InstalledUnlicensed && inventory != null && (job.Schema == 1 ? inventory.TargetInstalled : OfficeSelection.InstalledForSelection(inventory, OfficeSelection.Selected(job))))
   return PrimaryOperation.Activate;
  if (job.Action == ActionKind.InstallActivate && job.Installed && job.Status is JobStatus.Failed or JobStatus.Cancelled or JobStatus.ComponentMissing
   && (job.Stage is Stage.Components or Stage.Activate || job.InstallerExitCode == 0))
   return PrimaryOperation.Resume;
  return PrimaryOperation.InstallActivate;
 }
}
