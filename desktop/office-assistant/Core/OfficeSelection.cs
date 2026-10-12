using System.Globalization;
using System.Text.RegularExpressions;
namespace ChinaTech.OfficeAssistant;

/// <summary>Schema 2 selection policy. A persisted plan is derived once from the confirmed inventory.</summary>
public static class OfficeSelection {
 public const string Suite = "ProPlus2024Volume", Skype = "SkypeforBusiness2024Volume";
 public static readonly string[] SuiteComponents = ["Access", "Excel", "OneNote", "Outlook", "PowerPoint", "Word"];
 private static bool Contains(IEnumerable<string> values, string value) => values.Contains(value, StringComparer.OrdinalIgnoreCase);
 public static string[] Selected(JobRequest request) => (request.SelectedComponents ?? Policy.Components).ToArray();
 public static string[] Selected(JobRecord job) => job.Schema == 1 ? Policy.Components.ToArray() : (job.SelectedComponents ?? Policy.Components).ToArray();
 public static string[] RequiredProducts(IEnumerable<string> components) {
  var ids = components.ToArray(); var products = new List<string>();
  if (SuiteComponents.Any(id => Contains(ids, id))) products.Add(Suite);
  if (Contains(ids, "Lync")) products.Add(Skype);
  return products.ToArray();
 }
 public static bool InstalledForSelection(Inventory inventory, IEnumerable<string> components) {
  var products = RequiredProducts(components);
  return products.All(p => Contains(inventory.OfficeProducts, p)) && (products.Length == 0 || inventory.Platform.Equals("x64", StringComparison.OrdinalIgnoreCase));
 }
 public static bool LicensedForSelection(Inventory inventory, IEnumerable<string> components) {
  var products = RequiredProducts(components);
  return products.Length == 0 || inventory.LicenseError.Length == 0 && products.All(p => inventory.Licenses.Any(l => l.Product.Equals(p, StringComparison.OrdinalIgnoreCase) && l.Status == 1));
 }
 public static bool ComponentsPresent(Inventory inventory, IEnumerable<string> components) => components.All(id => inventory.Components.Any(c => c.Id == id && c.Present));
 private static bool SuiteConfigurationConsistent(Inventory inventory, C2rProductState? detail) => detail != null
  && !SuiteComponents.Any(a => Contains(detail.ExcludedApps, a) && inventory.Components.Any(c => c.Id == a && c.Present));
 public static string? InstallBlocker(Inventory inventory, IEnumerable<string> components) {
  if (RequiredProducts(components).Length == 0) return null;
  if (inventory.MsiProducts.Length != 0 || inventory.MsiDetails.Length != 0 || inventory.OfficeProducts.Except([Suite, Skype], StringComparer.OrdinalIgnoreCase).Any()) return "OFFICE_INCOMPATIBLE";
  if (inventory.OfficeProducts.Length != 0 && (!inventory.Platform.Equals("x64", StringComparison.OrdinalIgnoreCase) || !ValidVersion(inventory.OfficeVersion))) return "OFFICE_INCOMPATIBLE";
  if (inventory.OfficeProducts.Any(p => !inventory.C2rDetails.Any(d => d.Id.Equals(p, StringComparison.OrdinalIgnoreCase) && d.ConfigurationKnown && d.Languages.Length != 0))) return "OFFICE_CONFIGURATION_UNKNOWN";
  if (Contains(inventory.OfficeProducts, Suite) && !SuiteConfigurationConsistent(inventory, inventory.C2rDetails.FirstOrDefault(p => p.Id.Equals(Suite, StringComparison.OrdinalIgnoreCase)))) return "OFFICE_CONFIGURATION_UNKNOWN";
  return null;
 }
 public static void ValidateSelection(JobRequest request) {
  var selected = request.SelectedComponents;
  if (selected != null && (selected.Length is 0 or > 8 || selected.Distinct(StringComparer.Ordinal).Count() != selected.Length || selected.Any(s => !Policy.Components.Contains(s)))) throw new OfficeFailure("SELECTION_INVALID");
  if (!Enum.IsDefined(request.RemovalMode) || request.RemovalTargets is { Length: > 512 } || request.RemovalTargets?.Any(id => !ValidTarget(id)) == true
   || request.RemovalTargets != null && request.RemovalTargets.Distinct(StringComparer.Ordinal).Count() != request.RemovalTargets.Length
   || request.Action == ActionKind.Uninstall && request.RemovalMode == RemovalMode.Selected && request.RemovalTargets is not { Length: > 0 }) throw new OfficeFailure("REMOVAL_SELECTION_INVALID");
 }
 public static bool ValidVersion(string version) => Version.TryParse(version, out var v) && v.Major == 16 && v.Minor == 0 && v.Build >= 0 && v.Revision >= 0;
 public static bool ValidProductId(string id) => Regex.IsMatch(id, @"\A[A-Za-z][A-Za-z0-9]{1,100}\z", RegexOptions.CultureInvariant);
 public static bool ValidMsiCode(string id) => Guid.TryParseExact(id, "B", out var code) && code != Guid.Empty;
 private static bool ValidTarget(string id) {
  if (id.StartsWith("c2r-product:", StringComparison.Ordinal)) return ValidProductId(id[12..]);
  if (id.StartsWith("c2r-app:", StringComparison.Ordinal)) return id[8..].Split(':') is [Suite, var component] && SuiteComponents.Contains(component);
  if (id.StartsWith("msi:", StringComparison.Ordinal)) return ValidMsiCode(id[4..]);
  return Regex.IsMatch(id, @"\Aonedrive:(user|machine):[A-F0-9]{64}\z", RegexOptions.CultureInvariant);
 }
 public static RemovalOption[] GetRemovalOptions(Inventory inventory) {
  var options = new List<RemovalOption>();
  foreach (var product in inventory.OfficeProducts.Distinct(StringComparer.OrdinalIgnoreCase)) {
   var valid = ValidProductId(product);
   options.Add(new("c2r-product:" + product, product, "c2r", valid, valid ? "" : "REMOVAL_UNSUPPORTED"));
   if (product.Equals(Suite, StringComparison.OrdinalIgnoreCase)) {
    var detail = inventory.C2rDetails.FirstOrDefault(d => d.Id.Equals(Suite, StringComparison.OrdinalIgnoreCase));
    foreach (var app in SuiteComponents.Where(id => inventory.Components.Any(c => c.Id == id && c.Present))) {
     // Shared app binaries cannot establish which suite owns an app when multiple suites coexist.
     var supported = detail?.ConfigurationKnown == true && SuiteConfigurationConsistent(inventory, detail) && detail.Languages.Length != 0 && ValidVersion(inventory.OfficeVersion)
      && inventory.Platform.Equals("x64", StringComparison.OrdinalIgnoreCase) && !inventory.OfficeProducts.Except([Suite, Skype], StringComparer.OrdinalIgnoreCase).Any();
     options.Add(new("c2r-app:" + Suite + ":" + app, app, "component", supported, supported ? "" : "OFFICE_CONFIGURATION_UNKNOWN"));
    }
   }
  }
  foreach (var msi in inventory.MsiDetails) options.Add(new("msi:" + msi.ProductCode, msi.DisplayName, "msi", msi.Verified && ValidMsiCode(msi.ProductCode), msi.Verified && ValidMsiCode(msi.ProductCode) ? "" : "MSI_IDENTITY_UNVERIFIED"));
  foreach (var title in inventory.MsiProducts.Where(p => !inventory.MsiDetails.Any(d => d.DisplayName == p)))
   options.Add(new("unsupported-msi:" + options.Count.ToString(CultureInfo.InvariantCulture), title, "msi", false, "MSI_IDENTITY_UNVERIFIED"));
  foreach (var oneDrive in inventory.OneDriveDetails) options.Add(new(oneDrive.Id, "OneDrive", "onedrive-" + oneDrive.Scope, oneDrive.Supported, oneDrive.ReasonCode));
  return options.ToArray();
 }
 public static SelectionPlan Freeze(JobRecord job, Inventory baseline) {
  if (baseline.Fingerprint != job.ExpectedFingerprint) throw new OfficeFailure("ENVIRONMENT_CHANGED");
  var selected = Selected(job);
  if (job.Action == ActionKind.Activate) {
   if (!InstalledForSelection(baseline, selected)) throw new OfficeFailure("PRODUCT_NOT_FOUND");
   return new(selected, [], [], [], [], baseline);
  }
  if (job.Action != ActionKind.Uninstall) {
   if (InstallBlocker(baseline, selected) is { } blocker) throw new OfficeFailure(blocker);
   var required = RequiredProducts(selected);
   var products = (required.Length == 0 ? [] : required.Concat(baseline.OfficeProducts).Distinct(StringComparer.OrdinalIgnoreCase)).Select(id => {
    var existing = baseline.C2rDetails.FirstOrDefault(p => p.Id.Equals(id, StringComparison.OrdinalIgnoreCase));
    var languages = (existing?.Languages ?? []).Concat(required.Contains(id) ? [job.Language] : []).Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
    var retained = SuiteComponents.Where(c => baseline.Components.Any(x => x.Id == c && x.Present)
     || id == Suite && existing != null && !Contains(existing.ExcludedApps, c)).ToArray();
    var include = selected.Concat(retained).ToArray();
    var excluded = !required.Contains(id) && existing != null ? existing.ExcludedApps.ToArray()
     : id == Suite ? SuiteComponents.Where(c => !Contains(include, c)).Concat(existing == null ? ["Lync", "Groove", "OneDrive", "Teams", "Publisher"] : existing.ExcludedApps.Where(a => !Contains(SuiteComponents, a))).Distinct(StringComparer.OrdinalIgnoreCase).ToArray()
     : existing == null ? ["Groove", "OneDrive", "Teams"] : existing.ExcludedApps.Where(a => !a.Equals("Lync", StringComparison.OrdinalIgnoreCase)).ToArray();
    return new OfficeProductPlan(id, languages, excluded);
   }).ToArray();
   return new(selected, products, [], [], [], baseline);
  }
  var options = GetRemovalOptions(baseline);
  var targets = job.RemovalTargets ?? options.Where(o => o.RawKind is "c2r" or "msi").Select(o => o.Id).ToArray();
  if (job.RemovalMode == RemovalMode.All) {
   var office = options.Where(o => o.RawKind is "c2r" or "msi").ToArray();
   if (office.Any(o => !o.Supported)) throw new OfficeFailure(office.First(o => !o.Supported).ReasonCode);
   if (targets.Except(office.Select(o => o.Id), StringComparer.Ordinal).Any() || office.Select(o => o.Id).Except(targets, StringComparer.Ordinal).Any()) throw new OfficeFailure("REMOVAL_SELECTION_INVALID");
  }
  if (targets.Length == 0) throw new OfficeFailure("REMOVAL_SELECTION_EMPTY");
  if (job.RemovalMode == RemovalMode.All && targets.Any(t => t.StartsWith("onedrive:", StringComparison.Ordinal) || t.StartsWith("c2r-app:", StringComparison.Ordinal))) throw new OfficeFailure("REMOVAL_SELECTION_INVALID");
  var chosen = targets.Select(id => options.FirstOrDefault(o => o.Id == id) ?? throw new OfficeFailure("ENVIRONMENT_CHANGED")).ToArray();
  if (chosen.Any(o => !o.Supported)) throw new OfficeFailure(chosen.First(o => !o.Supported).ReasonCode);
  var removeProducts = chosen.Where(o => o.RawKind == "c2r").Select(o => o.Id[12..]).ToList();
  var apps = chosen.Where(o => o.RawKind == "component").Select(o => o.Id.Split(':')[2]).ToArray();
  var plans = new List<OfficeProductPlan>();
  if (apps.Length != 0 && !Contains(removeProducts, Suite)) {
   var detail = baseline.C2rDetails.Single(d => d.Id.Equals(Suite, StringComparison.OrdinalIgnoreCase));
   var remaining = SuiteComponents.Where(c => !Contains(apps, c) && !Contains(detail.ExcludedApps, c)).ToArray();
   if (remaining.Length == 0) removeProducts.Add(Suite);
   else plans.Add(new(Suite, detail.Languages.ToArray(), detail.ExcludedApps.Concat(apps).Distinct(StringComparer.OrdinalIgnoreCase).ToArray()));
  }
  if (plans.Count > 0 && baseline.C2rDetails.FirstOrDefault(p => p.Id == Skype) is { } keptSkype && !Contains(removeProducts, Skype)) plans.Add(new(Skype, keptSkype.Languages.ToArray(), keptSkype.ExcludedApps.ToArray()));
  return new(selected, plans.ToArray(), removeProducts.Distinct(StringComparer.OrdinalIgnoreCase).ToArray(), chosen.Where(o => o.RawKind == "msi").Select(o => o.Id[4..]).ToArray(), chosen.Where(o => o.RawKind.StartsWith("onedrive-", StringComparison.Ordinal)).Select(o => o.Id).ToArray(), baseline);
 }
 public static bool MatchesPlan(Inventory inventory, JobRecord job) {
  if (job.Schema == 1) return inventory.MatchesPlan(job);
  var plan = job.SelectionPlan ?? throw new OfficeFailure("JOURNAL_INVALID");
  return InstalledForSelection(inventory, plan.Components) && plan.Products.All(p => {
   var detail = inventory.C2rDetails.FirstOrDefault(d => d.Id.Equals(p.Id, StringComparison.OrdinalIgnoreCase));
   return detail?.ConfigurationKnown == true && p.Languages.All(l => Contains(detail.Languages, l)) && new HashSet<string>(p.ExcludedApps, StringComparer.OrdinalIgnoreCase).SetEquals(detail.ExcludedApps)
    && !(p.Id == Suite && p.ExcludedApps.Intersect(SuiteComponents, StringComparer.OrdinalIgnoreCase).Any(a => inventory.Components.Any(c => c.Id == a && c.Present)));
  }) && (plan.Products.Length == 0 || job.Media == null || inventory.OfficeVersion == job.Media.Version);
 }
 public static bool RemovalComplete(Inventory inventory, JobRecord job) {
  if (job.Schema == 1) return !inventory.HasOffice;
  var plan = job.SelectionPlan ?? throw new OfficeFailure("JOURNAL_INVALID");
  if (plan.RemoveProducts.Any(id => Contains(inventory.OfficeProducts, id)) || plan.MsiProductCodes.Any(id => inventory.MsiDetails.Any(m => m.ProductCode.Equals(id, StringComparison.OrdinalIgnoreCase))) || plan.OneDriveIds.Any(id => inventory.OneDriveDetails.Any(o => o.Id == id))) return false;
  foreach (var changed in plan.Products) {
   var detail = inventory.C2rDetails.FirstOrDefault(p => p.Id.Equals(changed.Id, StringComparison.OrdinalIgnoreCase));
   if (detail?.ConfigurationKnown != true || !changed.ExcludedApps.All(a => Contains(detail.ExcludedApps, a))) return false;
   var removedApps = changed.ExcludedApps.Except(plan.Baseline.C2rDetails.First(p => p.Id == changed.Id).ExcludedApps, StringComparer.OrdinalIgnoreCase).Intersect(SuiteComponents, StringComparer.OrdinalIgnoreCase);
   if (removedApps.Any(a => inventory.Components.Any(c => c.Id == a && c.Present))) return false;
  }
  return true;
 }
 public static bool Preserved(Inventory current, JobRecord job) {
  if (job.Schema == 1) return true;
  var plan = job.SelectionPlan ?? throw new OfficeFailure("JOURNAL_INVALID"); var baseline = plan.Baseline;
  if (baseline.OfficeProducts.Except(plan.RemoveProducts, StringComparer.OrdinalIgnoreCase).Any(id => !Contains(current.OfficeProducts, id))) return false;
  if (baseline.MsiDetails.Where(d => !Contains(plan.MsiProductCodes, d.ProductCode)).Any(d => !current.MsiDetails.Contains(d))) return false;
  if (baseline.OneDriveDetails.Where(d => !Contains(plan.OneDriveIds, d.Id)).Any(d => !current.OneDriveDetails.Any(c => c.Id == d.Id && c.Version == d.Version))) return false;
  foreach (var p in baseline.C2rDetails.Where(p => !Contains(plan.RemoveProducts, p.Id))) {
   var actual = current.C2rDetails.FirstOrDefault(d => d.Id.Equals(p.Id, StringComparison.OrdinalIgnoreCase));
   if (actual == null || !p.Languages.All(l => Contains(actual.Languages, l))) return false;
   var expected = plan.Products.FirstOrDefault(d => d.Id.Equals(p.Id, StringComparison.OrdinalIgnoreCase));
   if (p.ConfigurationKnown) {
    var mutableApps = p.Id.Equals(Suite, StringComparison.OrdinalIgnoreCase) ? SuiteComponents : p.Id.Equals(Skype, StringComparison.OrdinalIgnoreCase) ? ["Lync"] : Array.Empty<string>();
    if (!actual.ConfigurationKnown || !new HashSet<string>(p.ExcludedApps.Where(a => !Contains(mutableApps, a)), StringComparer.OrdinalIgnoreCase).SetEquals(actual.ExcludedApps.Where(a => !Contains(mutableApps, a)))) return false;
   }
   var retained = SuiteComponents.Where(a => baseline.Components.Any(c => c.Id == a && c.Present) && (expected == null || !Contains(expected.ExcludedApps, a)));
   if (p.Id == Suite && !ComponentsPresent(current, retained)) return false;
  }
  return baseline.OfficeProducts.Length == 0 || current.OfficeProducts.Length == 0 || current.OfficeVersion == baseline.OfficeVersion;
 }
 public static void ValidatePlan(JobRecord job) {
  var plan = job.SelectionPlan ?? throw new OfficeFailure("JOURNAL_INVALID");
  var expected = Freeze(job, plan.Baseline);
  if (System.Text.Json.JsonSerializer.Serialize(plan, Reports.Json) != System.Text.Json.JsonSerializer.Serialize(expected, Reports.Json)) throw new OfficeFailure("JOURNAL_INVALID");
 }
 public static bool InstallEvolutionAllowed(Inventory current, JobRecord job) {
  var plan = job.SelectionPlan ?? throw new OfficeFailure("JOURNAL_INVALID");
  return current.OfficeProducts.Except(plan.Baseline.OfficeProducts.Concat(plan.Products.Select(p => p.Id)), StringComparer.OrdinalIgnoreCase).Any() == false
   && current.MsiDetails.SequenceEqual(plan.Baseline.MsiDetails) && current.MsiProducts.SequenceEqual(plan.Baseline.MsiProducts) && Preserved(current, job);
 }
 public static void ValidateRemovalEvolution(Inventory current, JobRecord job) {
  var plan = job.SelectionPlan ?? throw new OfficeFailure("JOURNAL_INVALID"); var baseline = plan.Baseline;
  if (current.OfficeProducts.Except(baseline.OfficeProducts, StringComparer.OrdinalIgnoreCase).Any()
   || current.MsiDetails.Any(m => !baseline.MsiDetails.Contains(m)) || current.MsiProducts.Except(baseline.MsiProducts, StringComparer.Ordinal).Any()
   || current.OneDriveDetails.Any(d => !baseline.OneDriveDetails.Any(b => b.Id == d.Id)) || !Preserved(current, job)) throw new OfficeFailure("ENVIRONMENT_CHANGED");
  foreach (var step in job.CompletedRemovalSteps) if (!RemovalStepComplete(current, job, step)) throw new OfficeFailure("ENVIRONMENT_CHANGED");
 }
 public static bool RemovalStepComplete(Inventory current, JobRecord job, string step) {
  var plan = job.SelectionPlan ?? throw new OfficeFailure("JOURNAL_INVALID");
  if (step == "c2r") return RemovalComplete(current, new JobRecord { Schema = 2, SelectionPlan = plan with { MsiProductCodes = [], OneDriveIds = [] } });
  if (step.StartsWith("msi:", StringComparison.Ordinal)) return plan.MsiProductCodes.Contains(step[4..]) && !current.MsiDetails.Any(m => m.ProductCode == step[4..]);
  return plan.OneDriveIds.Contains(step) && !current.OneDriveDetails.Any(d => d.Id == step);
 }
 public static void ValidateResume(JobRecord job, JobRequest request) {
  if (job.ExpectedFingerprint != request.ExpectedFingerprint || job.Action != request.Action || job.Language != request.Language || job.Server != request.Server
   || job.Schema == 2 && (!Selected(job).SequenceEqual(Selected(request)) || job.RemovalMode != request.RemovalMode || !(job.RemovalTargets ?? []).SequenceEqual(request.RemovalTargets ?? []))) throw new OfficeFailure("RESUME_SELECTION_CHANGED");
 }
}
