using System.Globalization;
using System.Xml.Linq;
namespace ChinaTech.OfficeAssistant;
public static class Configuration {
 public static string Install(string source, string language, string? version = null) {
  if (!Policy.Languages.Contains(language)) throw new OfficeFailure("REQUEST_INVALID");
  if (version != null && (!Version.TryParse(version, out var parsed) || parsed.Major != 16 || parsed.Minor != 0 || parsed.Build < 0 || parsed.Revision < 0)) throw new OfficeFailure("MEDIA_INVALID");
  var add = new XElement("Add", new XAttribute("OfficeClientEdition", "64"), new XAttribute("Channel", "PerpetualVL2024"),
   new XAttribute("SourcePath", source), new XAttribute("AllowCdnFallback", "FALSE"));
  if (version != null) add.Add(new XAttribute("Version", version));
  foreach (var product in new[] { "ProPlus2024Volume", "SkypeforBusiness2024Volume" })
   add.Add(new XElement("Product", new XAttribute("ID", product), new XElement("Language", new XAttribute("ID", language))));
  return new XDocument(new XElement("Configuration", add,
   new XElement("Property", new XAttribute("Name", "AUTOACTIVATE"), new XAttribute("Value", "0")),
   new XElement("Property", new XAttribute("Name", "FORCEAPPSHUTDOWN"), new XAttribute("Value", "FALSE")),
   new XElement("Updates", new XAttribute("Enabled", "TRUE")),
   new XElement("Display", new XAttribute("Level", "None"), new XAttribute("AcceptEULA", "TRUE")))).ToString();
 }
 public static string Selected(string source, JobRecord job, string? version = null, bool removal = false) {
  var plan = job.SelectionPlan ?? throw new OfficeFailure("JOURNAL_INVALID");
  var root = new XElement("Configuration");
  if (plan.Products.Length != 0) {
   var pinned = version ?? (OfficeSelection.ValidVersion(plan.Baseline.OfficeVersion) ? plan.Baseline.OfficeVersion : null);
   if (pinned != null && !OfficeSelection.ValidVersion(pinned)) throw new OfficeFailure("MEDIA_INVALID");
   var add = new XElement("Add", new XAttribute("OfficeClientEdition", "64"), new XAttribute("Channel", "PerpetualVL2024"),
    new XAttribute("SourcePath", source), new XAttribute("AllowCdnFallback", "FALSE"));
   if (pinned != null) add.Add(new XAttribute("Version", pinned));
   foreach (var product in plan.Products) {
    if (!OfficeSelection.ValidProductId(product.Id) || product.Languages.Length == 0) throw new OfficeFailure("MEDIA_INVALID");
    var item = new XElement("Product", new XAttribute("ID", product.Id));
    foreach (var language in product.Languages) {
     try { if (!language.Contains('-') || CultureInfo.GetCultureInfo(language).Name.Length == 0) throw new OfficeFailure("MEDIA_INVALID"); }
     catch (CultureNotFoundException) { throw new OfficeFailure("MEDIA_INVALID"); }
     item.Add(new XElement("Language", new XAttribute("ID", language)));
    }
    foreach (var app in product.ExcludedApps) item.Add(new XElement("ExcludeApp", new XAttribute("ID", app)));
    add.Add(item);
   }
   root.Add(add);
  }
  if (removal && plan.RemoveProducts.Length != 0) root.Add(new XElement("Remove", new XAttribute("All", "FALSE"),
   plan.RemoveProducts.Select(id => OfficeSelection.ValidProductId(id) ? new XElement("Product", new XAttribute("ID", id)) : throw new OfficeFailure("REMOVAL_SELECTION_INVALID"))));
  root.Add(new XElement("Property", new XAttribute("Name", "AUTOACTIVATE"), new XAttribute("Value", "0")),
   new XElement("Property", new XAttribute("Name", "FORCEAPPSHUTDOWN"), new XAttribute("Value", "FALSE")),
   new XElement("Display", new XAttribute("Level", "None")));
  if (!removal) root.Element("Display")!.Add(new XAttribute("AcceptEULA", "TRUE"));
  return new XDocument(root).ToString();
 }
 public static string Remove() => new XDocument(new XElement("Configuration",
  new XElement("Remove", new XAttribute("All", "TRUE")), new XElement("RemoveMSI"),
  new XElement("Property", new XAttribute("Name", "FORCEAPPSHUTDOWN"), new XAttribute("Value", "FALSE")),
  new XElement("Display", new XAttribute("Level", "None")))).ToString();
}
public interface IOfficePlatform {
 Task<Inventory> InspectAsync();
 Task<string> BootIdAsync();
 Task<MediaState> PrepareAsync(JobRecord job, CancellationToken cancellation);
 Task VerifyMediaAsync(JobRecord job);
 Task PrepareRemovalAsync(JobRecord job, CancellationToken cancellation);
 Task<int> RemoveAsync(JobRecord job);
 Task<int> InstallAsync(JobRecord job);
 Task EnsureOneDriveAsync(JobRecord job, CancellationToken cancellation);
 Task ActivateAsync(JobRecord job);
}
public interface IJobStore { Task SaveAsync(JobRecord job); }
