using System.Diagnostics;

namespace ChinaTech.OfficeAssistant;

public sealed record InstallerServiceState(int ProcessId, uint State, uint ControlsAccepted);
public static class InstallerSafety {
 public static bool IsVerifiedIdleServiceProcess(int processId, InstallerServiceState? service) => service != null
  && service.ProcessId == processId && processId > 0 && service.State == 4 && (service.ControlsAccepted & 1) != 0;

 public static async Task<Inventory> WaitForClearAsync(JobRecord job, Func<Task<Inventory>> inspect,
  Func<Inventory, Task> observe, CancellationToken cancellation, TimeSpan? timeout = null, TimeSpan? interval = null) {
  var elapsed = Stopwatch.StartNew();
  var limit = timeout ?? TimeSpan.FromMinutes(5);
  var delay = interval ?? TimeSpan.FromSeconds(2);
  using var deadline = CancellationTokenSource.CreateLinkedTokenSource(cancellation);
  deadline.CancelAfter(limit);
  try {
  while (true) {
   cancellation.ThrowIfCancellationRequested();
   var fresh = await inspect().WaitAsync(deadline.Token);
   await observe(fresh);
   if (!fresh.MatchesPlan(job) || !fresh.AllComponents || fresh.MsiProducts.Length != 0
    || fresh.OfficeProducts.Except(["ProPlus2024Volume", "SkypeforBusiness2024Volume"], StringComparer.OrdinalIgnoreCase).Any()) throw new OfficeFailure("ENVIRONMENT_CHANGED");
   if (fresh.OpenApps.Length != 0) throw new OfficeFailure("APPS_OPEN");
   var blocker = Policy.Blocker(fresh);
   if (blocker == null) return fresh;
   if (blocker != "INSTALLER_BUSY") throw new OfficeFailure(blocker);
   var remaining = limit - elapsed.Elapsed;
   if (remaining <= TimeSpan.Zero) throw new OfficeFailure("INSTALLER_BUSY");
   await Task.Delay(delay < remaining ? delay : remaining, deadline.Token);
  }
  } catch (OperationCanceledException) when (!cancellation.IsCancellationRequested) { throw new OfficeFailure("INSTALLER_BUSY"); }
 }
}
