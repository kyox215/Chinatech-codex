using ChinaTech.OfficeAssistant;
using System.IO;
using System.Reflection;
using System.Windows;
using System.Windows.Automation;
using System.Windows.Controls;
using System.Windows.Data;
using System.Windows.Interop;
using System.Windows.Media;
using System.Windows.Media.Imaging;

internal static class Program
{
    private const double Tolerance = 0.5;
    private static int _count;
    private static readonly BindingFlags Private = BindingFlags.Instance | BindingFlags.NonPublic;
    private static readonly DateTimeOffset ObservedAt = new(2026, 10, 12, 12, 0, 0, TimeSpan.Zero);
    private sealed record Viewport(string Name, Size Requested, Size Window, Size Client);
    private sealed record Fixture(string Name, Inventory? Inventory, JobStatus? Status = null, bool Busy = false, bool Refreshing = false, string[]? Components = null);
    private static FieldInfo FindField(string name) => typeof(MainWindow).GetField(name, Private) ?? throw new InvalidOperationException("Missing fixture field: " + name);
    private static T Field<T>(MainWindow window, string name) => (T)FindField(name).GetValue(window)!;
    private static void Set(MainWindow window, string name, object? value) => FindField(name).SetValue(window, value);
    private static void Call(MainWindow window, string name) => (typeof(MainWindow).GetMethod(name, Private) ?? throw new InvalidOperationException("Missing fixture method: " + name)).Invoke(window, null);
    private static void Check(bool passed, string label) { if (!passed) throw new InvalidOperationException(label); _count++; }
    private static bool Near(double actual, double expected) => Math.Abs(actual - expected) <= Tolerance;
    private static Viewport ViewportFixture(string name, Size requested)
    {
        var workArea = SystemParameters.WorkArea;
        var window = new Size(Math.Min(requested.Width, workArea.Width), Math.Min(requested.Height, workArea.Height));
        // Match MainWindow's initial work-area clamp. Client dimensions stay explicit
        // synthetic fixtures, reserving 16 DIP horizontally and 40 DIP vertically.
        return new(name, requested, window, new Size(window.Width - 16, window.Height - 40));
    }
    private static string Translation(string method, string key, string locale)
    {
        var text = typeof(MainWindow).Assembly.GetType("ChinaTech.OfficeAssistant.Text", throwOnError: true)!;
        return (string)text.GetMethod(method, BindingFlags.Public | BindingFlags.Static)!.Invoke(null,
            method == "Get" ? [key, locale, Array.Empty<object>()] : [key, locale])!;
    }
    private static IEnumerable<DependencyObject> Descendants(DependencyObject root)
    {
        yield return root;
        for (var i = 0; i < VisualTreeHelper.GetChildrenCount(root); i++)
            foreach (var item in Descendants(VisualTreeHelper.GetChild(root, i))) yield return item;
    }
    private static bool InLayout(FrameworkElement element, FrameworkElement root)
    {
        // IsVisible is false for every child of an unshown Window. Check the actual
        // layout visibility of ancestors up to the independently measured root.
        for (DependencyObject? current = element; current != null; current = VisualTreeHelper.GetParent(current))
        {
            if (current is UIElement visual && visual.Visibility != Visibility.Visible) return false;
            if (ReferenceEquals(current, root)) return true;
        }
        return false;
    }
    private static void Inside(FrameworkElement element, FrameworkElement root, string label)
    {
        var bounds = element.TransformToAncestor(root).TransformBounds(new Rect(element.RenderSize));
        Check(bounds.Width > 0 && bounds.Height > 0 && bounds.Left >= -Tolerance && bounds.Top >= -Tolerance
            && bounds.Right <= root.ActualWidth + Tolerance && bounds.Bottom <= root.ActualHeight + Tolerance,
            label + ": " + bounds + " outside " + root.RenderSize);
    }
    private static Inventory InventoryFixture(bool complete = false) => new("Microsoft Windows 11 10.0.26100", "X64",
        complete ? [OfficeSelection.Suite, OfficeSelection.Skype] : [OfficeSelection.Suite], [], [], [], [],
        Policy.Components.Select(id => new ComponentState(id, complete || id is "Word" or "Excel")).ToArray(),
        complete ? [new(OfficeSelection.Suite, 1, null), new(OfficeSelection.Skype, 1, null)] : [new(OfficeSelection.Suite, 1, null)], ObservedAt)
    {
        Platform = "x64", OfficeVersion = "16.0.17932.21000", SuiteLanguages = ["en-us"], SkypeLanguages = complete ? ["en-us"] : [],
        C2rDetails = complete
            ? [new(OfficeSelection.Suite, ["en-us"], ["Groove", "Teams", "Publisher"], true), new(OfficeSelection.Skype, ["en-us"], [], true)]
            : [new(OfficeSelection.Suite, ["en-us"], ["Access", "OneNote", "Outlook", "PowerPoint", "Lync", "Groove", "Teams", "Publisher"], true)]
    };
    private static void ApplyFixture(MainWindow window, Fixture fixture)
    {
        var selected = Field<HashSet<string>>(window, "_selectedComponents");
        selected.Clear(); selected.UnionWith(fixture.Components ?? Policy.Components);
        var taskComponents = fixture.Components ?? ["Word", "Excel"];
        Set(window, "_inventory", fixture.Inventory);
        Set(window, "_job", fixture.Status is not { } status ? null : new JobRecord
        {
            Schema = 2, Id = Guid.NewGuid(), ActorSid = Field<string>(window, "_actorSid"), Status = status,
            Action = ActionKind.InstallActivate, Language = "en-us", SelectedComponents = taskComponents,
            Stage = fixture.Busy ? Stage.Install : status == JobStatus.Completed ? Stage.Finished : Stage.Components,
            Code = status switch { JobStatus.Completed => fixture.Components is ["OneDrive"] ? "OFFICE_READY" : "COMPLETED", JobStatus.Failed => "PRESERVATION_FAILED", JobStatus.ComponentMissing => "COMPONENT_MISSING", JobStatus.AwaitingRestart => "RESTART_REQUIRED", _ => "STARTED" },
            Installed = !fixture.Busy, StartedAt = ObservedAt, UpdatedAt = ObservedAt,
            ExpectedFingerprint = fixture.Inventory!.Fingerprint, SelectionPlan = new(taskComponents, [], [], [], [], fixture.Inventory),
            InstallerExitCode = status == JobStatus.AwaitingRestart ? 3010 : null,
            InstallerBoot = status == JobStatus.AwaitingRestart ? "100" : null, RestartBoot = status == JobStatus.AwaitingRestart ? "100" : null
        });
        Set(window, "_workerActive", fixture.Busy); Set(window, "_refreshing", fixture.Refreshing);
        Set(window, "_preferNewSelection", false); Set(window, "_dialogOpen", false); Call(window, "ApplyState");
    }
    private static void Measure(MainWindow window, Viewport viewport)
    {
        window.Width = viewport.Window.Width; window.Height = viewport.Window.Height;
        window.Measure(viewport.Window); window.Arrange(new Rect(viewport.Window));
        Check(Near(window.ActualWidth, viewport.Window.Width) && Near(window.ActualHeight, viewport.Window.Height),
            viewport.Name + " requested=" + viewport.Requested + ", work-area-clamped=" + viewport.Window
                + " must select the real compact/normal branch; actual=" + window.RenderSize);
        Call(window, "ArrangeCards");
        var root = Field<Grid>(window, "_root");
        // The client viewport is explicit and synthetic; the hidden HWND only gives
        // WPF valid Window min/max metrics. Unbounded height exposes capped overflow.
        root.Measure(new Size(viewport.Client.Width, double.PositiveInfinity));
        Check(root.DesiredSize.Height <= viewport.Client.Height + Tolerance,
            viewport.Name + " content height " + root.DesiredSize.Height + " exceeds client fixture " + viewport.Client.Height);
        root.Arrange(new Rect(viewport.Client)); root.UpdateLayout();
        Check(!window.IsLoaded && !window.IsVisible && PresentationSource.FromVisual(window) == null,
            "measurement must not show/load the main Window or connect it to the hidden HWND");
    }
    private static void CheckLayout(MainWindow window, Viewport viewport, string prefix)
    {
        var root = Field<Grid>(window, "_root"); var nodes = Descendants(root).ToArray();
        Check(!nodes.OfType<ScrollViewer>().Any(), prefix + " main area has no scroll viewer");
        var buttons = nodes.OfType<Button>().Where(b => InLayout(b, root)).ToArray();
        Check(buttons.Length >= 7, prefix + " button assertions must not be vacuous: " + buttons.Length);
        foreach (var button in buttons)
        {
            var id = AutomationProperties.GetAutomationId(button);
            Check(Near(button.ActualHeight, 44), prefix + " " + id + " stays 44 high: " + button.ActualHeight); Inside(button, root, prefix + " " + id);
        }
        foreach (var (id, checkbox) in Field<Dictionary<string, CheckBox>>(window, "_componentChoices"))
        {
            Check(checkbox.ActualHeight >= 44 - Tolerance, prefix + " " + id + " touch target"); Inside(checkbox, root, prefix + " " + id);
            var name = Field<Dictionary<string, TextBlock>>(window, "_componentNames")[id];
            Check(name.Text == Translation("Component", id, Field<string>(window, "_locale")), prefix + " full application name " + id); Inside(name, root, prefix + " application name " + id);
        }
        var compact = viewport.Window.Height < 660;
        Check(Field<TextBlock>(window, "_subline").Visibility == (compact ? Visibility.Collapsed : Visibility.Visible), prefix + " compact branch");
        Check(ReferenceEquals(Field<ComboBox>(window, "_officeLanguage").Parent, Field<Grid>(window, compact ? "_selectionToolbar" : "_productRow")), prefix + " installation language placement");
        Inside(Field<StackPanel>(window, "_progress"), root, prefix + " fixed progress card");
    }
    private static void CheckMenu(MainWindow window, string prefix)
    {
        var menu = Field<ContextMenu>(window, "_otherMenu"); var root = Field<Grid>(window, "_root");
        Check(menu.Items.Count == 3 && !Descendants(root).Contains(menu), prefix + " independent menu has three entries");
        Check(menu.Placement == System.Windows.Controls.Primitives.PlacementMode.Bottom && !menu.IsOpen, prefix + " anchored menu remains unshown in fixture");
        var buttons = Field<Dictionary<ActionKind, Button>>(window, "_actionButtons");
        var sources = new[] { buttons[ActionKind.Activate], buttons[ActionKind.Uninstall], Field<Button>(window, "_export") };
        var keys = new[] { "Activate", "Uninstall", "Export" };
        for (var i = 0; i < keys.Length; i++)
        {
            var item = (MenuItem)menu.Items[i]; BindingOperations.GetBindingExpression(item, UIElement.IsEnabledProperty)?.UpdateTarget();
            Check(Equals(item.Header, Translation("Get", keys[i], Field<string>(window, "_locale"))) && AutomationProperties.GetName(item) == item.Header.ToString(), prefix + " menu label/accessibility " + keys[i]);
            Check(ReferenceEquals(BindingOperations.GetBinding(item, UIElement.IsEnabledProperty)?.Source, sources[i]) && item.IsEnabled == sources[i].IsEnabled, prefix + " menu availability " + keys[i]);
            item.Measure(new Size(280, double.PositiveInfinity)); item.Arrange(new Rect(0, 0, 280, 44));
            Check(Near(item.ActualHeight, 44), prefix + " detached menu item stays 44 high " + keys[i]);
        }
    }
    private static void CheckSelection(MainWindow window, Inventory inventory)
    {
        ApplyFixture(window, new("selection", inventory));
        var choices = Field<Dictionary<string, CheckBox>>(window, "_componentChoices"); var selected = Field<HashSet<string>>(window, "_selectedComponents");
        var primary = Field<Dictionary<ActionKind, Button>>(window, "_actionButtons")[ActionKind.InstallActivate];
        Check(selected.SetEquals(Policy.Components), "new fixture defaults to eight canonical applications");
        choices["Word"].IsChecked = false; Check(!selected.Contains("Word") && selected.Count == 7, "real checkbox deselection updates canonical draft");
        choices["Word"].IsChecked = true; Check(selected.Contains("Word") && selected.Count == 8, "real checkbox selection restores canonical draft");
        Field<Button>(window, "_clearSelection").RaiseEvent(new RoutedEventArgs(Button.ClickEvent));
        Check(selected.Count == 0 && choices.Values.All(c => c.IsChecked == false) && !primary.IsEnabled, "clear selection synchronizes controls and blocks empty execution");
        choices["Word"].IsChecked = true; Check(selected.SetEquals(["Word"]) && primary.IsEnabled, "single checkbox re-enables reviewed draft");
        Field<Button>(window, "_selectAll").RaiseEvent(new RoutedEventArgs(Button.ClickEvent));
        Check(selected.SetEquals(Policy.Components) && choices.Values.All(c => c.IsChecked == true), "all selection restores eight canonical IDs and controls");
        foreach (var lockField in new[] { "_workerActive", "_refreshing", "_dialogOpen" })
        {
            Set(window, lockField, true); Call(window, "ApplyState");
            Check(choices.Values.All(c => !c.IsEnabled) && !Field<Button>(window, "_selectAll").IsEnabled && !Field<Button>(window, "_clearSelection").IsEnabled && !Field<ComboBox>(window, "_officeLanguage").IsEnabled, lockField + " locks selection inputs");
            Field<Button>(window, "_clearSelection").RaiseEvent(new RoutedEventArgs(Button.ClickEvent)); Check(selected.SetEquals(Policy.Components), lockField + " rejects raised clear event");
            if (lockField != "_refreshing") { choices["Word"].IsChecked = false; Check(selected.SetEquals(Policy.Components), lockField + " rejects programmatic checkbox event"); }
            Set(window, lockField, false); Call(window, "ApplyState"); Check(choices.Values.All(c => c.IsEnabled && c.IsChecked == true), lockField + " unlocks and restores canonical selection");
        }
        Set(window, "_inventory", null); Call(window, "ApplyState");
        Check(choices.Values.All(c => !c.IsEnabled) && selected.SetEquals(Policy.Components) && !primary.IsEnabled, "unknown inventory preserves selection and blocks execution");
    }
    private static void CheckOneDriveOnly(MainWindow window, string locale, string prefix)
    {
        var inventory = Field<Inventory>(window, "_inventory"); var job = Field<JobRecord>(window, "_job");
        var components = job.SelectedComponents ?? [];
        Check(!inventory.HasOffice && inventory.Licenses.Length == 0 && job.Status == JobStatus.Completed
            && components.SequenceEqual(["OneDrive"]) && OfficeSelection.RequiredProducts(components).Length == 0,
            prefix + " completed OneDrive-only fixture has no Office or Office licensing target");
        Check(Field<TextBlock>(window, "_officeSummary").Text == Translation("Get", "NotInstalledShort", locale)
            && Field<TextBlock>(window, "_licenseSummary").Text == Translation("Get", "NotApplicable", locale),
            prefix + " OneDrive-only detection reports Office absent and licensing not applicable");
        var request = new JobRequest(Guid.NewGuid(), ActionKind.InstallActivate, "en-us", "k.302.pub", inventory.Fingerprint) { SelectedComponents = ["OneDrive"] };
        var title = (string)typeof(MainWindow).GetMethod("ConfirmationTitle", Private)!.Invoke(window, [request])!;
        Check(title == Translation("Get", "InstallSelected", locale), prefix + " OneDrive-only confirmation says install selected apps");
        var steps = Descendants(Field<System.Windows.Controls.Primitives.UniformGrid>(window, "_steps")).OfType<TextBlock>().Select(t => t.Text).ToArray();
        Check(steps.Contains(Translation("Get", "VerificationStep", locale)) && !steps.Contains(Translation("Get", "ActivationStep", locale)),
            prefix + " OneDrive-only completion verifies without an Office activation step");
        var selectedPhrase = locale switch { "zh-cn" => "所选应用", "it-it" => "app selezionate", _ => "Selected apps" };
        var applicablePhrase = locale switch { "zh-cn" => "适用的授权状态", "it-it" => "licenze applicabili", _ => "applicable licenses" };
        var headline = Field<TextBlock>(window, "_headline").Text; var outcome = Field<TextBlock>(window, "_progressTitle").Text;
        Check(headline == Translation("Get", "HeroFinish", locale) && headline.Contains(selectedPhrase, StringComparison.OrdinalIgnoreCase)
            && !headline.Contains("Office", StringComparison.OrdinalIgnoreCase), prefix + " completion headline applies to selected apps");
        Check(outcome == Translation("Get", "OFFICE_READY", locale) && outcome.Contains(applicablePhrase, StringComparison.OrdinalIgnoreCase)
            && !outcome.Contains("Office", StringComparison.OrdinalIgnoreCase), prefix + " completion outcome limits licensing to applicable apps");
    }
    private static void CheckActorWindowRequirement(MainWindow window)
    {
        // Invoke only the pure getter. Never call OnClosing, ReadTask or inspection.
        var getter = typeof(MainWindow).GetProperty("RequiresOpenActorWindow", Private)!;
        var requestId = Guid.NewGuid();
        bool Required(bool requested, bool executing, bool active, JobRecord? job)
        {
            Set(window, "_requestedUserOneDriveRemoval", requested); Set(window, "_requestedJobId", requestId);
            Set(window, "_executing", executing); Set(window, "_workerActive", active); Set(window, "_job", job);
            return (bool)getter.GetValue(window)!;
        }
        var own = new JobRecord { Id = requestId, ActorSid = Field<string>(window, "_actorSid"), Action = ActionKind.Uninstall, Status = JobStatus.Running };
        Check(Required(true, true, false, null), "original user-OneDrive launcher stays open during worker handshake");
        Check(Required(true, false, true, own), "original user-OneDrive launcher stays open while its worker is active");
        foreach (var status in new[] { JobStatus.Completed, JobStatus.Failed, JobStatus.Cancelled })
        {
            own.Status = status;
            Check(!Required(true, false, false, own), status + " original user-OneDrive task permits ordinary closing once inactive");
        }
        own.Status = JobStatus.Running;
        Check(!Required(false, false, true, own), "a viewer window is not required to stay open for another launcher");
        Check(!Required(false, true, true, own), "ordinary or machine-scoped operations retain existing closing behavior");
        Check(!Required(true, false, true, new JobRecord { Id = Guid.NewGuid(), Status = JobStatus.Running }), "an unrelated worker cannot retain the original launcher window");
        Check(!Required(true, false, true, null), "an unknown unrelated worker does not match the original request");
        Set(window, "_requestedUserOneDriveRemoval", false); Set(window, "_requestedJobId", null);
        Set(window, "_executing", false); Set(window, "_workerActive", false); Set(window, "_job", null);
    }
    private static void SaveProof(MainWindow window, string locale, Viewport viewport, Fixture fixture)
    {
        if (viewport.Name is not ("minimum" or "default") || fixture.Name is not ("partial" or "running")) return;
        var root = Field<Grid>(window, "_root");
        // Root's visual offset includes its margins. Use the entire synthetic client
        // viewport so that offset cannot crop the right/bottom controls, and draw the
        // actual parent Window background behind the otherwise transparent root.
        var bitmap = new RenderTargetBitmap((int)Math.Ceiling(viewport.Client.Width), (int)Math.Ceiling(viewport.Client.Height), 96, 96, PixelFormats.Pbgra32);
        var background = new DrawingVisual();
        using (var drawing = background.RenderOpen()) drawing.DrawRectangle(window.Background, null, new Rect(viewport.Client));
        bitmap.Render(background);
        bitmap.Render(root);
        var pixels = new byte[bitmap.PixelWidth * bitmap.PixelHeight * 4];
        bitmap.CopyPixels(pixels, bitmap.PixelWidth * 4, 0);
        var colors = new HashSet<uint>();
        for (var i = 0; i < pixels.Length; i += 4) colors.Add(BitConverter.ToUInt32(pixels, i));
        Check(colors.Count > 20, "native synthetic screenshot must contain rendered controls: " + colors.Count + " colors");
        var directory = Path.GetFullPath(".local/office-1.2-ui-proof"); Directory.CreateDirectory(directory);
        var encoder = new PngBitmapEncoder(); encoder.Frames.Add(BitmapFrame.Create(bitmap));
        var file = Path.Combine(directory, locale + "-" + viewport.Name + "-" + fixture.Name + ".png");
        using var stream = File.Create(file); encoder.Save(stream);
        Console.WriteLine("PNG " + Path.GetFileName(file) + " (real WPF controls, synthetic client viewport, 96 DPI fixture)");
    }
    [STAThread]
    public static void Main()
    {
        // No Show, dispatcher pump, Loaded event, inspection, worker, installer,
        // menu action click or licence calls. Hide changes Collapsed to Hidden.
        // WPF Window min/max measurement requires a valid hidden HWND; EnsureHandle
        // creates it without Show or connecting MainWindow as its RootVisual.
        Console.WriteLine("Native WPF synthetic control fixtures only; Office inspection and operations are not invoked.");
        Console.WriteLine("WorkArea=" + SystemParameters.WorkArea.Size + " DIP; requested window sizes are clamped to the work area; synthetic client reserves 16x40 DIP for chrome.");
        var window = new MainWindow(); window.Hide();
        var handle = new WindowInteropHelper(window).EnsureHandle();
        Check(handle != IntPtr.Zero && HwndSource.FromHwnd(handle)?.RootVisual == null && !window.IsLoaded,
            "hidden HWND exists without showing/loading MainWindow or attaching its RootVisual");
        var partial = InventoryFixture();
        var empty = new Inventory("Microsoft Windows 11 10.0.26100", "X64", [], [], [], [], [], Policy.Components.Select(id => new ComponentState(id, false)).ToArray(), [], ObservedAt);
        var oneDriveOnly = empty with { Components = Policy.Components.Select(id => new ComponentState(id, id == "OneDrive")).ToArray(),
            OneDriveDetails = [new("onedrive:user:synthetic", "user", "synthetic-actor", @"C:\Synthetic\OneDrive.exe", "24.000.0000.0000", true, "")] };
        var fixtures = new[] { new Fixture("unknown", null), new("detecting", null, Refreshing: true), new("empty", empty), new("partial", partial),
            new("running", partial, JobStatus.Running, Busy: true), new("completed", InventoryFixture(complete: true), JobStatus.Completed),
            new("failed", partial, JobStatus.Failed), new("missing", partial, JobStatus.ComponentMissing), new("restart", partial, JobStatus.AwaitingRestart),
            new("onedrive-only-completed", oneDriveOnly, JobStatus.Completed, Components: ["OneDrive"]) };
        var viewports = new[] { ViewportFixture("minimum", new(680, 520)), ViewportFixture("default", new(980, 800)),
            ViewportFixture("short", new(1024, 600)), ViewportFixture("desktop", new(1024, 768)) };
        var layoutFixtures = 0;
        foreach (var locale in Policy.Languages) foreach (var viewport in viewports) foreach (var fixture in fixtures)
        {
            ApplyFixture(window, fixture); Field<ComboBox>(window, "_uiLanguage").SelectedIndex = Array.IndexOf(Policy.Languages, locale);
            Check(Field<string>(window, "_locale") == locale, "real interface selector applies " + locale); Measure(window, viewport);
            var prefix = locale + "/" + viewport.Name + "/" + fixture.Name; CheckLayout(window, viewport, prefix); CheckMenu(window, prefix);
            if (fixture.Components is ["OneDrive"]) CheckOneDriveOnly(window, locale, prefix);
            SaveProof(window, locale, viewport, fixture);
            layoutFixtures++;
            Console.WriteLine("PASS " + prefix + " (requested=" + viewport.Requested + "; work-area-clamped window=" + viewport.Window
                + "; actual=" + window.RenderSize + "; synthetic client=" + viewport.Client + ")");
        }
        CheckSelection(window, partial);
        CheckActorWindowRequirement(window);
        Check(!window.IsLoaded && !window.IsVisible && PresentationSource.FromVisual(window) == null && !Field<System.Windows.Threading.DispatcherTimer>(window, "_timer").IsEnabled, "fixture never loads/shows main GUI or starts inspection timer");
        Console.WriteLine($"{_count} assertions across {layoutFixtures} native WPF synthetic layout/state fixtures and selection/menu/actor-window checks passed. Office operations=0. Real GUI/UAC/DPI/Office acceptance remains pending.");
    }
}
