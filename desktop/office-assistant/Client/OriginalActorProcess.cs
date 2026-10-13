using System.ComponentModel;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Security.Principal;
using System.Text;
using Microsoft.Win32.SafeHandles;
namespace ChinaTech.OfficeAssistant;

/// <summary>Only a fixed official OneDrive uninstall command may run in the verified UI actor's context.</summary>
internal static class OriginalActorProcess {
 public static async Task<int> RunOneDriveUninstallAsync(string setup, string actorSid, int pid, long started) {
  Journal.RejectReparse(setup);
  if (!System.IO.Path.IsPathFullyQualified(setup) || setup.Contains('"') || System.IO.Path.GetFileName(setup) != "OneDriveRemoveSetup.exe") throw new OfficeFailure("REQUEST_INVALID");
  try {
   using var ui = Process.GetProcessById(pid);
   if (ui.HasExited || ui.StartTime.ToUniversalTime().Ticks != started) throw new OfficeFailure("ONEDRIVE_ACTOR_UNAVAILABLE");
   using var process = OpenProcess(0x1000, false, pid);
   if (process.IsInvalid || !OpenProcessToken(process, 0x000b, out var original)) throw new OfficeFailure("ONEDRIVE_ACTOR_UNAVAILABLE");
   using (original) {
    using var identity = new WindowsIdentity(original.DangerousGetHandle());
    if (identity.User?.Value != actorSid || !DuplicateTokenEx(original, 0x000f01ff, IntPtr.Zero, 2, 1, out var primary)) throw new OfficeFailure("ONEDRIVE_ACTOR_UNAVAILABLE");
    using (primary) {
     if (!CreateEnvironmentBlock(out var environment, primary, false)) throw new OfficeFailure("ONEDRIVE_ACTOR_UNAVAILABLE");
     try {
      var startup = new StartupInfo { Size = Marshal.SizeOf<StartupInfo>() };
      var command = new StringBuilder('"' + setup + "\" /uninstall /silent");
      if (!CreateProcessWithTokenW(primary, 1, setup, command, 0x08000400, environment, System.IO.Path.GetDirectoryName(setup), ref startup, out var child)) throw new OfficeFailure("ONEDRIVE_ACTOR_UNAVAILABLE");
      using var launched = new SafeProcessHandle(child.Process, true);
      using var thread = new SafeWaitHandle(child.Thread, true);
      // Installers are awaited without a deadline, cancellation or termination.
      uint wait; while ((wait = WaitForSingleObject(launched, 0)) == 0x102) await Task.Delay(250);
      if (wait != 0) throw new OfficeFailure("INSTALLER_RESULT_UNKNOWN");
      if (!GetExitCodeProcess(launched, out var exit) || exit == 259) throw new OfficeFailure("ONEDRIVE_UNINSTALL_FAILED");
      return unchecked((int)exit);
     } finally { DestroyEnvironmentBlock(environment); }
    }
   }
  } catch (OfficeFailure) { throw; }
  catch (Exception e) when (e is ArgumentException or InvalidOperationException or Win32Exception) { throw new OfficeFailure("ONEDRIVE_ACTOR_UNAVAILABLE"); }
 }
 [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
 private struct StartupInfo { public int Size; public string? Reserved, Desktop, Title; public int X, Y, XSize, YSize, XChars, YChars, Fill, Flags; public short Show, ReservedSize; public IntPtr ReservedData, Input, Output, Error; }
 [StructLayout(LayoutKind.Sequential)]
 private struct ProcessInformation { public IntPtr Process, Thread; public int ProcessId, ThreadId; }
 [DllImport("kernel32.dll", SetLastError = true)] private static extern SafeProcessHandle OpenProcess(uint access, [MarshalAs(UnmanagedType.Bool)] bool inherit, int pid);
 [DllImport("advapi32.dll", SetLastError = true)] [return: MarshalAs(UnmanagedType.Bool)] private static extern bool OpenProcessToken(SafeProcessHandle process, uint access, out SafeAccessTokenHandle token);
 [DllImport("advapi32.dll", SetLastError = true)] [return: MarshalAs(UnmanagedType.Bool)] private static extern bool DuplicateTokenEx(SafeAccessTokenHandle token, uint access, IntPtr attributes, int impersonation, int type, out SafeAccessTokenHandle primary);
 [DllImport("advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true)] [return: MarshalAs(UnmanagedType.Bool)] private static extern bool CreateProcessWithTokenW(SafeAccessTokenHandle token, uint flags, string application, StringBuilder command, uint creation, IntPtr environment, string? directory, ref StartupInfo startup, out ProcessInformation process);
 [DllImport("userenv.dll", SetLastError = true)] [return: MarshalAs(UnmanagedType.Bool)] private static extern bool CreateEnvironmentBlock(out IntPtr environment, SafeAccessTokenHandle token, [MarshalAs(UnmanagedType.Bool)] bool inherit);
 [DllImport("userenv.dll")] [return: MarshalAs(UnmanagedType.Bool)] private static extern bool DestroyEnvironmentBlock(IntPtr environment);
 [DllImport("kernel32.dll", SetLastError = true)] private static extern uint WaitForSingleObject(SafeProcessHandle handle, uint milliseconds);
 [DllImport("kernel32.dll", SetLastError = true)] [return: MarshalAs(UnmanagedType.Bool)] private static extern bool GetExitCodeProcess(SafeProcessHandle handle, out uint exit);
}
