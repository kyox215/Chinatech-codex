using System.Runtime.InteropServices;
using Microsoft.Win32.SafeHandles;

namespace ChinaTech.OfficeAssistant;

public static partial class WindowsInstallerService {
 public static InstallerServiceState? ReadState() {
  try {
   using var manager = OpenSCManager(null, null, 1);
   if (manager.IsInvalid) return null;
   using var service = OpenService(manager, "msiserver", 4);
   if (service.IsInvalid || !QueryServiceStatusEx(service, 0, out var state, (uint)Marshal.SizeOf<ServiceState>(), out _)) return null;
   return new(checked((int)state.ProcessId), state.CurrentState, state.ControlsAccepted);
  } catch { return null; }
 }

 [StructLayout(LayoutKind.Sequential)]
 private struct ServiceState {
  public uint ServiceType, CurrentState, ControlsAccepted, Win32ExitCode, ServiceSpecificExitCode, CheckPoint, WaitHint, ProcessId, ServiceFlags;
 }
 public sealed class ServiceHandle : SafeHandleZeroOrMinusOneIsInvalid {
  public ServiceHandle() : base(true) { }
  protected override bool ReleaseHandle() => CloseServiceHandle(handle);
 }
 [LibraryImport("advapi32.dll", EntryPoint = "OpenSCManagerW", StringMarshalling = StringMarshalling.Utf16, SetLastError = true)]
 private static partial ServiceHandle OpenSCManager(string? machine, string? database, uint access);
 [LibraryImport("advapi32.dll", EntryPoint = "OpenServiceW", StringMarshalling = StringMarshalling.Utf16, SetLastError = true)]
 private static partial ServiceHandle OpenService(ServiceHandle manager, string name, uint access);
 [LibraryImport("advapi32.dll", SetLastError = true)]
 [return: MarshalAs(UnmanagedType.Bool)]
 private static partial bool QueryServiceStatusEx(ServiceHandle service, int infoLevel, out ServiceState status, uint size, out uint needed);
 [LibraryImport("advapi32.dll", SetLastError = true)]
 [return: MarshalAs(UnmanagedType.Bool)]
 private static partial bool CloseServiceHandle(nint handle);
}
