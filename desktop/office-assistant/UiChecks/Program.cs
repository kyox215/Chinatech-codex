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
    private sealed record Viewport(string Name, Size Window, Size Client);
    private sealed record Fixture(string Name, Inventory? Inventory, JobStatus? Status = null, bool Busy = false, bool Refreshing = false);
    private static FieldInfo FindField(string name) => typeof(MainWindow).GetField(name, Private) ?? throw new InvalidOperationException("Missing fixture field: " + name);
    private static T Field<T>(MainWindow window, string name) => (T)FindField(name).GetValue(window)!;
    private static void Set(MainWindow window, string name, object? value) => FindField(name).SetValue(window, value);
    private static void Call(MainWindow window, string name) => (typeof(MainWindow).GetMethod(name, Private) ?? throw new InvalidOperationException("Missing fixture method: " + name)).Invoke(window, null);
    private static void Check(bool passed, string label) { if (!passed) throw new InvalidOperationException(label); _count++; }
    private static bool Near(double actual, double expected) => Math.Abs(actual - expected) <= Tolerance;
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
        Set(window, "_inventory", fixture.Inventory);
        Set(window, "_job", fixture.Status is not { } status ? null : new JobRecord
        {
            Schema = 2, Id = Guid.NewGuid(), ActorSid = Field<string>(window, "_actorSid"), Status = status,
            Action = ActionKind.InstallActivate, Language = "en-us", SelectedComponents = ["Word", "Excel"],
            Stage = fixture.Busy ? Stage.Install : status == JobStatus.Completed ? Stage.Finished : Stage.Components,
            Code = status switch { JobStatus.Completed => "COMPLETED", JobStatus.Failed => "PRESERVATION_FAILED", JobStatus.ComponentMissing => "COMPONENT_MISSING", JobStatus.AwaitingRestart => "RESTART_REQUIRED", _ => "STARTED" },
            Installed = !fixture.Busy, StartedAt = ObservedAt, UpdatedAt = ObservedAt,
            ExpectedFingerprint = fixture.Inventory!.Fingerprint, SelectionPlan = new(["Word", "Excel"], [], [], [], [], fixture.Inventory),
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
            viewport.Name + " must select the real compact/normal branch: " + window.RenderSize);
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
    private static void SaveProof(MainWindow window, string locale, Viewport viewport, Fixture fixture)
    {
        if (viewport.Name is not ("minimum" or "default") || fixture.Name is not ("partial" or "running")) return;
        var root = Field<Grid>(window, "_root");
        var bitmap = new RenderTargetBitmap((int)Math.Ceiling(root.ActualWidth), (int)Math.Ceiling(root.ActualHeight), 96, 96, PixelFormats.Pbgra32);
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
        var window = new MainWindow(); window.Hide();
        var handle = new WindowInteropHelper(window).EnsureHandle();
        Check(handle != IntPtr.Zero && HwndSource.FromHwnd(handle)?.RootVisual == null && !window.IsLoaded,
            "hidden HWND exists without showing/loading MainWindow or attaching its RootVisual");
        var partial = InventoryFixture();
        var empty = new Inventory("Microsoft Windows 11 10.0.26100", "X64", [], [], [], [], [], Policy.Components.Select(id => new ComponentState(id, false)).ToArray(), [], ObservedAt);
        var fixtures = new[] { new Fixture("unknown", null), new("detecting", null, Refreshing: true), new("empty", empty), new("partial", partial),
            new("running", partial, JobStatus.Running, Busy: true), new("completed", InventoryFixture(complete: true), JobStatus.Completed),
            new("failed", partial, JobStatus.Failed), new("missing", partial, JobStatus.ComponentMissing), new("restart", partial, JobStatus.AwaitingRestart) };
        var viewports = new[] { new Viewport("minimum", new(680, 520), new(664, 480)), new("default", new(980, 800), new(964, 760)),
            new("short", new(1024, 600), new(1008, 560)), new("desktop", new(1024, 768), new(1008, 728)) };
        foreach (var locale in Policy.Languages) foreach (var viewport in viewports) foreach (var fixture in fixtures)
        {
            ApplyFixture(window, fixture); Field<ComboBox>(window, "_uiLanguage").SelectedIndex = Array.IndexOf(Policy.Languages, locale);
            Check(Field<string>(window, "_locale") == locale, "real interface selector applies " + locale); Measure(window, viewport);
            var prefix = locale + "/" + viewport.Name + "/" + fixture.Name; CheckLayout(window, viewport, prefix); CheckMenu(window, prefix);
            SaveProof(window, locale, viewport, fixture);
            Console.WriteLine("PASS " + prefix + " (synthetic window=" + viewport.Window + "; client=" + viewport.Client + ")");
        }
        CheckSelection(window, partial);
        Check(!window.IsLoaded && !window.IsVisible && PresentationSource.FromVisual(window) == null && !Field<System.Windows.Threading.DispatcherTimer>(window, "_timer").IsEnabled, "fixture never loads/shows main GUI or starts inspection timer");
        Console.WriteLine($"{_count} assertions across 108 native WPF synthetic layout/state fixtures and selection/menu checks passed. Office operations=0. Real GUI/UAC/DPI/Office acceptance remains pending.");
    }
}
