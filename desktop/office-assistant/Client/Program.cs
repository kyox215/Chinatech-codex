using System.Security.Principal;
using System.Windows;
namespace ChinaTech.OfficeAssistant;
public static class Program {
 [STAThread] public static int Main(string[] args) {
  if (args.Length > 0 && args[0] == "--worker") return Coordinator.Worker(args).GetAwaiter().GetResult();
  if (args.Length != 0) return 2;
  using var identity = WindowsIdentity.GetCurrent();
  using var instance = new Mutex(true, @"Local\ChinaTech.OfficeAssistant1.UI." + identity.User!.Value, out var created);
  if (!created) { MessageBox.Show("助手已经打开。 / L’assistente è già aperto. / The assistant is already open.", "ChinaTech Office"); return 3; }
  var application = new Application(); application.Run(new MainWindow()); return 0;
 }
}
