using System.ComponentModel;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.Security.Principal;
using System.Text;
using System.Windows;
using System.Windows.Automation;
using System.Windows.Controls;
using System.Windows.Media;
using System.Windows.Markup;
using System.Windows.Controls.Primitives;
using System.Windows.Threading;
using Microsoft.Win32;

namespace ChinaTech.OfficeAssistant;

public sealed class MainWindow : Window
{
    private static readonly Brush Ink = new SolidColorBrush(Color.FromRgb(35, 40, 49));
    private static readonly Brush Muted = new SolidColorBrush(Color.FromRgb(85, 95, 110));
    private static readonly Brush Purple = new SolidColorBrush(Color.FromRgb(95, 87, 255));
    private static readonly Brush BorderColor = new SolidColorBrush(Color.FromRgb(230, 232, 239));
    private static readonly Brush ErrorColor = new SolidColorBrush(Color.FromRgb(153, 37, 37));
    private static readonly Brush WarningColor = new SolidColorBrush(Color.FromRgb(113, 78, 15));
    private readonly Dictionary<TextBlock, string> _labels = [];
    private readonly Dictionary<Button, string> _buttonLabels = [];
    private readonly ComboBox _uiLanguage = new() { MinWidth = 140, MinHeight = 44, Foreground = Ink };
    private readonly ComboBox _officeLanguage = new() { MinHeight = 44, Foreground = Ink };
    private readonly StackPanel _facts = new();
    private readonly StackPanel _warnings = new();
    private readonly StackPanel _task = new();
    private readonly TextBlock _notice = new() { TextWrapping = TextWrapping.Wrap, Foreground = ErrorColor, Margin = new Thickness(0, 10, 0, 0) };
    private readonly TextBlock _resumeReason = new() { TextWrapping = TextWrapping.Wrap, Foreground = Muted, FontSize = 13, Margin = new Thickness(0, 4, 0, 0) };
    private readonly Dictionary<ActionKind, TextBlock> _actionReasons = [];
    private readonly Dictionary<ActionKind, Button> _actionButtons = [];
    private readonly DispatcherTimer _timer = new() { Interval = TimeSpan.FromSeconds(1) };
    private readonly string _actorSid;
    private readonly Button _refresh;
    private readonly Button _export;
    private readonly Button _resume;
    private readonly Button _cancel;
    private readonly TextBlock _headline = new() { FontSize = 23, FontWeight = FontWeights.SemiBold, TextWrapping = TextWrapping.Wrap };
    private readonly TextBlock _subline = new() { FontSize = 13, Foreground = Muted, TextWrapping = TextWrapping.Wrap, Margin = new Thickness(0, 3, 0, 0) };
    private readonly TextBlock _statusLabel = new() { FontSize = 12, FontWeight = FontWeights.SemiBold };
    private readonly Border _statusBadge = new() { CornerRadius = new CornerRadius(14), Padding = new Thickness(11, 5, 11, 5), VerticalAlignment = VerticalAlignment.Top };
    private readonly TextBlock _machine = new() { FontSize = 12, Foreground = Muted, TextWrapping = TextWrapping.Wrap, Margin = new Thickness(0, 0, 0, 14) };
    private readonly TextBlock _officeSummary = new() { FontSize = 13, TextWrapping = TextWrapping.Wrap, TextAlignment = TextAlignment.Right };
    private readonly TextBlock _licenseSummary = new() { FontSize = 13, TextWrapping = TextWrapping.Wrap, TextAlignment = TextAlignment.Right };
    private readonly TextBlock _readinessSummary = new() { FontSize = 13, TextWrapping = TextWrapping.Wrap, TextAlignment = TextAlignment.Right };
    private readonly TextBlock _progressHeading = new() { FontSize = 14, FontWeight = FontWeights.SemiBold };
    private readonly TextBlock _progressTitle = new() { FontSize = 14, FontWeight = FontWeights.SemiBold, TextWrapping = TextWrapping.Wrap };
    private readonly TextBlock _progressMetric = new() { FontSize = 13, Foreground = Purple, FontWeight = FontWeights.SemiBold, Margin = new Thickness(12, 0, 0, 0) };
    private readonly TextBlock _progressCaption = new() { FontSize = 12, Foreground = Muted, TextWrapping = TextWrapping.Wrap, Margin = new Thickness(0, 7, 0, 0) };
    private readonly TextBlock _elapsed = new() { FontSize = 12, Foreground = Muted, Margin = new Thickness(12, 0, 0, 0) };
    private readonly ProgressBar _progressBar = new() { Minimum = 0, Maximum = 100, Height = 7, Foreground = Purple, Background = new SolidColorBrush(Color.FromRgb(238, 238, 250)), BorderThickness = new Thickness(0), Margin = new Thickness(0, 9, 0, 0) };
    private readonly UniformGrid _steps = new() { Columns = 4, Margin = new Thickness(0, 12, 0, 12) };
    private readonly Grid _cards = new() { Margin = new Thickness(0, 0, 0, 4) };
    private readonly Expander _moreActions = new();
    private readonly Expander _detectionDetails = new();
    private readonly Expander _taskDetails = new();
    private Border? _configurationCard;
    private Border? _detectionCard;
    private Guid? _requestedJobId;
    private Inventory? _inventory;
    private JobRecord? _job;
    private JobRecord? _finalResult;
    private CancellationTokenSource? _cancellation;
    private string _locale = Policy.DefaultLanguage(CultureInfo.CurrentUICulture);
    private string _installationLanguage = Policy.DefaultLanguage(CultureInfo.CurrentUICulture);
    private string _errorCode = "";
    private string _journalError = "";
    private string _exportedPath = "";
    private bool _updating;
    private bool _refreshing;
    private bool _executing;
    private bool _workerActive;
    private bool _cancelRequested;
    private bool _allowClose;
    private bool _dialogOpen;
    private bool _resolvingServer;

    public MainWindow()
    {
        using var identity = WindowsIdentity.GetCurrent();
        _actorSid = identity.User?.Value ?? "";
        var workArea = SystemParameters.WorkArea;
        Width = Math.Min(980, workArea.Width);
        Height = Math.Min(800, workArea.Height);
        MinWidth = Math.Min(780, workArea.Width);
        MinHeight = Math.Min(640, workArea.Height);
        WindowStartupLocation = WindowStartupLocation.CenterScreen;
        Background = new SolidColorBrush(Color.FromRgb(245, 246, 250));
        Foreground = Ink;
        FontFamily = new FontFamily("Segoe UI");
        FontSize = 14;
        _uiLanguage.FontSize = 14;
        _officeLanguage.FontSize = 16;
        _uiLanguage.Padding = _officeLanguage.Padding = new Thickness(8, 5, 8, 5);
        _officeLanguage.MinWidth = 175;
        _officeLanguage.MaxWidth = 240;
        _statusBadge.Child = _statusLabel;

        // Header, actions and measured progress stay visible while details scroll independently.
        var root = new Grid { Margin = new Thickness(24, 18, 24, 14) };
        root.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
        root.RowDefinitions.Add(new RowDefinition { Height = new GridLength(1, GridUnitType.Star) });
        root.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
        root.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
        root.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
        var header = new Grid { Margin = new Thickness(0, 0, 0, 16) };
        header.ColumnDefinitions.Add(new ColumnDefinition());
        header.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
        var brand = new StackPanel { Orientation = Orientation.Horizontal };
        brand.Children.Add(new Border { Width = 42, Height = 42, Background = Purple, CornerRadius = new CornerRadius(13), Margin = new Thickness(0, 0, 12, 0),
            Child = new TextBlock { Text = "▦", Foreground = Brushes.White, FontSize = 29, HorizontalAlignment = HorizontalAlignment.Center, VerticalAlignment = VerticalAlignment.Center } });
        var heading = new StackPanel();
        heading.Children.Add(Label("Title", 21, FontWeights.SemiBold));
        heading.Children.Add(new TextBlock { Text = "CHINATECH", FontSize = 10, Foreground = Muted });
        brand.Children.Add(heading);
        header.Children.Add(brand);
        Grid.SetColumn(_uiLanguage, 1);
        header.Children.Add(_uiLanguage);
        root.Children.Add(header);
        _uiLanguage.ItemsSource = new[] { "中文", "Italiano", "English" };
        _uiLanguage.SelectedIndex = _locale == "zh-cn" ? 0 : _locale == "it-it" ? 1 : 2;
        AutomationProperties.SetAutomationId(_uiLanguage, "InterfaceLanguage");
        _uiLanguage.SelectionChanged += (_, _) =>
        {
            if (_updating) return;
            _locale = _uiLanguage.SelectedIndex == 0 ? "zh-cn" : _uiLanguage.SelectedIndex == 1 ? "it-it" : "en-us";
            ApplyText(); ApplyState();
        };
        var body = new StackPanel();
        var intro = new Grid { Margin = new Thickness(0, 0, 0, 14) };
        intro.ColumnDefinitions.Add(new ColumnDefinition());
        intro.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
        var introText = new StackPanel(); introText.Children.Add(_headline); introText.Children.Add(_subline);
        intro.Children.Add(introText); Grid.SetColumn(_statusBadge, 1); intro.Children.Add(_statusBadge);
        body.Children.Add(intro);
        _cards.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1.5, GridUnitType.Star) });
        _cards.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
        _cards.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
        _cards.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
        var configuration = new StackPanel();
        var product = new StackPanel { Orientation = Orientation.Horizontal, Margin = new Thickness(0, 0, 0, 12) };
        product.Children.Add(new Border { Width = 44, Height = 48, CornerRadius = new CornerRadius(12), Background = new SolidColorBrush(Color.FromRgb(239, 103, 62)), Margin = new Thickness(0, 0, 12, 0),
            Child = new TextBlock { Text = "O", Foreground = Brushes.White, FontSize = 27, FontWeight = FontWeights.SemiBold, HorizontalAlignment = HorizontalAlignment.Center, VerticalAlignment = VerticalAlignment.Center } });
        var productText = new StackPanel();
        productText.Children.Add(new TextBlock { Text = "Office LTSC 2024", FontSize = 20, FontWeight = FontWeights.SemiBold });
        productText.Children.Add(Label("Edition", 12, color: Muted)); product.Children.Add(productText); configuration.Children.Add(product);
        var appHeading = new Grid { Margin = new Thickness(0, 0, 0, 8) };
        appHeading.ColumnDefinitions.Add(new ColumnDefinition()); appHeading.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
        appHeading.Children.Add(Label("SuiteApps", 12, color: Muted));
        var all = Label("EightIncluded", 12, FontWeights.SemiBold, Purple); Grid.SetColumn(all, 1); appHeading.Children.Add(all); configuration.Children.Add(appHeading);
        var components = new UniformGrid { Columns = 4, Margin = new Thickness(0, 0, 0, 12) };
        var apps = new (string Id, string Letter, byte R, byte G, byte B)[] {
            ("Word", "W", 36, 113, 204), ("Excel", "X", 38, 136, 92), ("PowerPoint", "P", 225, 107, 66), ("Outlook", "O", 37, 146, 219),
            ("OneNote", "N", 148, 72, 200), ("Access", "A", 187, 71, 99), ("OneDrive", "☁", 66, 156, 240), ("Lync", "S", 57, 169, 212)
        };
        foreach (var app in apps)
        {
            var item = new Grid { Margin = new Thickness(0, 0, 8, 8), MinHeight = 34 };
            item.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto }); item.ColumnDefinitions.Add(new ColumnDefinition());
            item.Children.Add(new Border { Width = 28, Height = 28, CornerRadius = new CornerRadius(8), Background = new SolidColorBrush(Color.FromRgb(app.R, app.G, app.B)), Margin = new Thickness(0, 0, 7, 0), VerticalAlignment = VerticalAlignment.Center,
                Child = new TextBlock { Text = app.Letter, Foreground = Brushes.White, FontSize = 14, FontWeight = FontWeights.SemiBold, HorizontalAlignment = HorizontalAlignment.Center, VerticalAlignment = VerticalAlignment.Center } });
            var name = new TextBlock { FontSize = 12, TextWrapping = TextWrapping.Wrap, VerticalAlignment = VerticalAlignment.Center, Foreground = Muted };
            _labels[name] = "ComponentPlain:" + app.Id;
            AutomationProperties.SetAutomationId(name, "FixedComponent" + app.Id); Grid.SetColumn(name, 1); item.Children.Add(name); components.Children.Add(item);
        }
        configuration.Children.Add(components);
        var languageLine = new Grid { Margin = new Thickness(0, 10, 0, 0) };
        languageLine.ColumnDefinitions.Add(new ColumnDefinition()); languageLine.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
        var languageLabel = Label("InstallationLanguage", 13); languageLabel.VerticalAlignment = VerticalAlignment.Center; languageLine.Children.Add(languageLabel);
        Grid.SetColumn(_officeLanguage, 1); languageLine.Children.Add(_officeLanguage); configuration.Children.Add(languageLine);
        _officeLanguage.ToolTip = T("LanguageNotice");
        AutomationProperties.SetAutomationId(_officeLanguage, "InstallationLanguage");
        _officeLanguage.SelectionChanged += (_, _) => { if (!_updating && _officeLanguage.SelectedIndex >= 0) _installationLanguage = Policy.Languages[_officeLanguage.SelectedIndex]; };
        _configurationCard = Card(configuration); _configurationCard.Margin = new Thickness(0, 0, 14, 0); _cards.Children.Add(_configurationCard);
        var detection = new StackPanel(); detection.Children.Add(Label("Detection", 14, FontWeights.SemiBold)); detection.Children.Add(_machine);
        detection.Children.Add(SummaryLine("Office", _officeSummary)); detection.Children.Add(SummaryLine("License", _licenseSummary)); detection.Children.Add(SummaryLine("SystemReadiness", _readinessSummary));
        var inspectionDetails = new StackPanel(); inspectionDetails.Children.Add(_facts); inspectionDetails.Children.Add(_warnings);
        _detectionDetails.Header = Label("DetectedDetails", 12, color: Muted);
        _detectionDetails.Content = new ScrollViewer { Content = inspectionDetails, MaxHeight = 150, VerticalScrollBarVisibility = ScrollBarVisibility.Auto, HorizontalScrollBarVisibility = ScrollBarVisibility.Disabled };
        _detectionDetails.Margin = new Thickness(0, 8, 0, 0); detection.Children.Add(_detectionDetails);
        _detectionCard = Card(detection); _detectionCard.Margin = new Thickness(0); Grid.SetColumn(_detectionCard, 1); _cards.Children.Add(_detectionCard); body.Children.Add(_cards);
        var contentScroll = new ScrollViewer { Content = body, VerticalScrollBarVisibility = ScrollBarVisibility.Auto, HorizontalScrollBarVisibility = ScrollBarVisibility.Disabled, Foreground = Ink, Padding = new Thickness(0, 0, 2, 0) };
        Grid.SetRow(contentScroll, 1); root.Children.Add(contentScroll);
        var actions = new StackPanel { Margin = new Thickness(0, 12, 0, 12) };
        var toolbar = new DockPanel { LastChildFill = false };
        foreach (var kind in Enum.GetValues<ActionKind>())
        {
            var button = Button(kind.ToString(), async (_, _) => { if (kind == ActionKind.InstallActivate && SuggestedOperation == PrimaryOperation.Resume) await ResumeAsync(); else await StartAsync(kind == ActionKind.InstallActivate ? PrimaryAction : kind); }, kind == ActionKind.InstallActivate);
            _actionButtons[kind] = button;
            _actionReasons[kind] = new TextBlock { FontSize = 12, Foreground = Muted, TextWrapping = TextWrapping.Wrap, Margin = new Thickness(0, 5, 0, 0) };
        }
        _refresh = Button("Refresh", async (_, _) => await RefreshAsync());
        _export = Button("Export", (_, _) => ExportReport());
        _resume = Button("Resume", async (_, _) => await ResumeAsync());
        _cancel = Button("Cancel", async (_, _) => await CancelAsync());
        _actionButtons[ActionKind.InstallActivate].MinHeight = 48;
        _actionButtons[ActionKind.InstallActivate].MinWidth = 200;
        _actionButtons[ActionKind.InstallActivate].Margin = new Thickness(0, 0, 12, 0);
        DockPanel.SetDock(_actionButtons[ActionKind.InstallActivate], Dock.Left); toolbar.Children.Add(_actionButtons[ActionKind.InstallActivate]);
        var secondary = new WrapPanel { HorizontalAlignment = HorizontalAlignment.Right };
        foreach (var button in new[] { _refresh, _resume, _cancel }) { button.Margin = new Thickness(0, 0, 8, 0); secondary.Children.Add(button); }
        var otherContent = new WrapPanel { Margin = new Thickness(0, 6, 0, 0) };
        foreach (var button in new[] { _actionButtons[ActionKind.Activate], _actionButtons[ActionKind.Uninstall], _export }) { button.Margin = new Thickness(0, 0, 8, 4); otherContent.Children.Add(button); }
        _moreActions.Header = Label("MoreActions", 13, color: Muted); _moreActions.Content = otherContent; _moreActions.VerticalAlignment = VerticalAlignment.Center;
        secondary.Children.Add(_moreActions); DockPanel.SetDock(secondary, Dock.Right); toolbar.Children.Add(secondary); actions.Children.Add(toolbar);
        actions.Children.Add(_actionReasons[ActionKind.InstallActivate]); actions.Children.Add(_resumeReason); actions.Children.Add(_notice);
        Grid.SetRow(actions, 2); root.Children.Add(actions);
        var progress = new StackPanel(); var progressHead = new Grid(); progressHead.ColumnDefinitions.Add(new ColumnDefinition()); progressHead.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
        progressHead.Children.Add(_progressHeading); Grid.SetColumn(_elapsed, 1); progressHead.Children.Add(_elapsed); progress.Children.Add(progressHead); progress.Children.Add(_steps);
        var progressLine = new Grid(); progressLine.ColumnDefinitions.Add(new ColumnDefinition()); progressLine.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
        progressLine.Children.Add(_progressTitle); Grid.SetColumn(_progressMetric, 1); progressLine.Children.Add(_progressMetric); progress.Children.Add(progressLine); progress.Children.Add(_progressBar); progress.Children.Add(_progressCaption);
        _taskDetails.Header = Label("TaskDetails", 12, color: Muted); _taskDetails.Margin = new Thickness(0, 6, 0, 0);
        _taskDetails.Content = new ScrollViewer { Content = _task, MaxHeight = 125, VerticalScrollBarVisibility = ScrollBarVisibility.Auto, HorizontalScrollBarVisibility = ScrollBarVisibility.Disabled };
        progress.Children.Add(_taskDetails); var progressCard = Card(progress); progressCard.Margin = new Thickness(0); Grid.SetRow(progressCard, 3); root.Children.Add(progressCard);
        var footer = new Grid { Margin = new Thickness(0, 10, 0, 0) }; footer.ColumnDefinitions.Add(new ColumnDefinition()); footer.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
        footer.Children.Add(Label("ProtectionShort", 11, color: Muted)); var version = new TextBlock { Text = Policy.Version, Foreground = Muted, FontSize = 11 }; Grid.SetColumn(version, 1); footer.Children.Add(version); Grid.SetRow(footer, 4); root.Children.Add(footer);
        Content = root;
        SizeChanged += (_, _) => ArrangeCards();
        _timer.Tick += (_, _) => Poll(); Loaded += async (_, _) => { ArrangeCards(); await RefreshAsync(); _timer.Start(); }; Closing += OnClosing; Closed += (_, _) => _timer.Stop();
        ApplyText(); ApplyState();
    }

    private UIElement SummaryLine(string key, TextBlock value)
    {
        var row = new Grid { Margin = new Thickness(0, 0, 0, 11) };
        row.ColumnDefinitions.Add(new ColumnDefinition()); row.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1.2, GridUnitType.Star) });
        var label = key == "Office" ? new TextBlock { Text = "Office", Foreground = Muted, FontSize = 13 } : Label(key, 13, color: Muted);
        row.Children.Add(label); Grid.SetColumn(value, 1); row.Children.Add(value); return row;
    }

    private void ArrangeCards()
    {
        if (_configurationCard == null || _detectionCard == null) return;
        var stacked = ActualWidth < 850;
        _cards.ColumnDefinitions[1].Width = stacked ? new GridLength(0) : new GridLength(1, GridUnitType.Star);
        _cards.ColumnDefinitions[0].Width = stacked ? new GridLength(1, GridUnitType.Star) : new GridLength(1.5, GridUnitType.Star);
        Grid.SetColumn(_detectionCard, stacked ? 0 : 1); Grid.SetRow(_detectionCard, stacked ? 1 : 0);
        _configurationCard.Margin = stacked ? new Thickness(0, 0, 0, 12) : new Thickness(0, 0, 14, 0);
    }

    private PrimaryOperation SuggestedOperation => PresentationPolicy.Primary(_job, _inventory, OwnTask);
    private ActionKind PrimaryAction => SuggestedOperation == PrimaryOperation.Activate ? ActionKind.Activate : ActionKind.InstallActivate;

    private string T(string key, params object[] args) => Text.Get(key, _locale, args);

    private TextBlock Label(string key, double size = 15, FontWeight? weight = null, Brush? color = null)
    {
        var label = new TextBlock { Text = T(key), FontSize = size, FontWeight = weight ?? FontWeights.Normal, Foreground = color ?? Ink, TextWrapping = TextWrapping.Wrap, Margin = new Thickness(0, 0, 0, 8) };
        _labels[label] = key;
        return label;
    }

    private static Border Card(UIElement content) => new()
    {
        Child = content, Background = Brushes.White, BorderBrush = BorderColor, BorderThickness = new Thickness(1),
        CornerRadius = new CornerRadius(18), Padding = new Thickness(18), Margin = new Thickness(0, 0, 0, 16)
    };

    private Button Button(string key, RoutedEventHandler handler, bool primary = false)
    {
        var button = new Button
        {
            Content = new TextBlock { Text = T(key), TextWrapping = TextWrapping.Wrap, TextAlignment = TextAlignment.Center, Foreground = primary ? Brushes.White : Ink },
            Template = RoundedButtonTemplate, MinHeight = 44, Padding = new Thickness(16, 10, 16, 10), Background = primary ? Purple : Brushes.White,
            BorderBrush = primary ? Purple : BorderColor, BorderThickness = new Thickness(1), Foreground = primary ? Brushes.White : Ink
        };
        _buttonLabels[button] = key;
        AutomationProperties.SetAutomationId(button, key);
        button.Click += handler;
        return button;
    }

    private void ApplyText()
    {
        Title = T("Title") + " · " + Policy.Version;
        foreach (var (label, key) in _labels)
            label.Text = key.StartsWith("ComponentPlain:", StringComparison.Ordinal) ? Text.Component(key[15..], _locale)
                : key.StartsWith("Component:", StringComparison.Ordinal) ? "✓  " + Text.Component(key[10..], _locale) : T(key);
        foreach (var (button, key) in _buttonLabels)
        {
            ((TextBlock)button.Content).Text = T(key);
            AutomationProperties.SetName(button, T(key));
        }
        _updating = true;
        _officeLanguage.ItemsSource = new[] { T("Chinese"), T("Italian"), T("English") };
        _officeLanguage.SelectedIndex = Array.IndexOf(Policy.Languages, _installationLanguage);
        _updating = false;
        _officeLanguage.ToolTip = T("LanguageNotice");
        AutomationProperties.SetName(_uiLanguage, T("InterfaceLanguage"));
        AutomationProperties.SetName(_officeLanguage, T("InstallationLanguage"));
    }

    private void AddText(Panel panel, string text, Brush? color = null, double size = 15) => panel.Children.Add(new TextBlock
    {
        Text = text, TextWrapping = TextWrapping.Wrap, Foreground = color ?? Ink, FontSize = size, Margin = new Thickness(0, 0, 0, 7)
    });

    private string? BlockReason(ActionKind action)
    {
        if (_executing || _workerActive || _dialogOpen) return T("Busy");
        if (_refreshing) return T("Detecting");
        if (_journalError.Length > 0) return T("ReadFailed", T(_journalError));
        if (_inventory == null) return T("NeedsDetection");
        if (RecoveryBlocker() is { } recovery) return T(recovery);
        var blocker = Policy.Blocker(_inventory);
        if (blocker != null) return T(blocker);
        if (action == ActionKind.Activate && !_inventory.TargetInstalled) return T("NoTarget");
        if (action == ActionKind.Uninstall && !_inventory.HasOffice) return T("NoRemovalTarget");
        return null;
    }

    private bool OwnTask => _job != null && _actorSid.Length > 0 && _job.ActorSid == _actorSid;
    private bool CanResume => OwnTask && _job!.Status is not (JobStatus.Completed or JobStatus.InstalledUnlicensed or JobStatus.NeedsReview);

    private string? RecoveryBlocker()
    {
        if (_executing || _workerActive) return null;
        if (ExecutionSafety.RestartCheckpointError(_job) is { } error) return error;
        return _job != null && (_job.RestartBoot != null
            || Policy.RebootExit(_job.InstallerExitCode ?? 0) && _job.RestartVerifiedBoot == null)
            ? "RESTART_REQUIRED" : null;
    }

    private void ApplyState()
    {
        _facts.Children.Clear();
        _warnings.Children.Clear();
        _task.Children.Clear();
        if (_inventory == null) AddText(_facts, T(_refreshing ? "Detecting" : "NotDetected"), Muted);
        else
        {
            AddText(_facts, T("Windows") + ": " + _inventory.Windows);
            AddText(_facts, T("Architecture") + ": " + _inventory.Architecture);
            AddText(_facts, T("InstalledProducts") + ": " + (_inventory.OfficeProducts.Length == 0 ? T("NoOffice") : string.Join(", ", _inventory.OfficeProducts)));
            if (_inventory.OfficeProducts.Length > 0)
            {
                AddText(_facts, T("OfficeArchitecture") + ": " + (_inventory.Platform.Length == 0 ? T("UnknownFact") : _inventory.Platform)
                    + " · " + T("OfficeVersion") + ": " + (_inventory.OfficeVersion.Length == 0 ? T("UnknownFact") : _inventory.OfficeVersion), size: 13);
                AddText(_facts, T("SuiteLanguages") + ": " + (_inventory.SuiteLanguages.Length == 0 ? T("UnknownFact") : string.Join(", ", _inventory.SuiteLanguages.Select(InstallationLanguageName))), size: 13);
                AddText(_facts, T("SkypeLanguages") + ": " + (_inventory.SkypeLanguages.Length == 0 ? T("UnknownFact") : string.Join(", ", _inventory.SkypeLanguages.Select(InstallationLanguageName))), size: 13);
            }
            if (_inventory.MsiProducts.Length > 0) AddText(_facts, T("MsiProducts") + ": " + string.Join(", ", _inventory.MsiProducts));
            AddText(_facts, T("Components") + ": " + string.Join(" · ", Policy.Components.Select(id => Text.Component(id, _locale) + " " + T(_inventory.Components.Any(c => c.Id == id && c.Present) ? "Present" : "Missing"))), size: 13);
            AddText(_facts, T("License") + ": " + (_inventory.Licenses.Length == 0 ? T("NoLicense") : string.Join("; ", _inventory.Licenses.Select(license => license.Product + " — " + (license.Status == 1 ? T("Licensed") : T("LicenseStatus", license.Status)) + (license.GraceMinutes.HasValue ? " · " + T("Grace", license.GraceMinutes.Value) : "")))), size: 13);
            if (!string.IsNullOrEmpty(_inventory.LicenseError)) AddText(_warnings, T(_inventory.LicenseError), WarningColor, 13);
            AddText(_facts, T("ObservedAt") + ": " + _inventory.ObservedAt.ToLocalTime().ToString("g", CultureInfo.CurrentCulture), Muted, 13);
            if (_inventory.RestartReasons.Length > 0)
            {
                AddText(_warnings, T("RestartNotice"), WarningColor);
                AddText(_warnings, string.Join(" · ", _inventory.RestartReasons.Select(code => T(code))), WarningColor, 13);
            }
            if (_inventory.OpenApps.Length > 0) AddText(_warnings, T("OpenApps", string.Join(", ", _inventory.OpenApps)), WarningColor);
            if (_inventory.Installers.Length > 0) AddText(_warnings, T("Installers", string.Join(", ", _inventory.Installers)), WarningColor);
        }
        foreach (var (kind, button) in _actionButtons)
        {
            var reason = BlockReason(kind == ActionKind.InstallActivate ? PrimaryAction : kind);
            button.IsEnabled = reason == null;
            button.Opacity = reason == null ? 1 : 0.8;
            var textColor = reason == null && kind == ActionKind.InstallActivate ? Brushes.White : Ink;
            button.Foreground = textColor;
            ((TextBlock)button.Content).Foreground = textColor;
            button.Background = reason == null && kind == ActionKind.InstallActivate ? Purple : Brushes.White;
            _actionReasons[kind].Text = reason == null || _executing || _workerActive ? "" : T("ActionBlocked", reason);
            _actionReasons[kind].Visibility = _actionReasons[kind].Text.Length == 0 ? Visibility.Collapsed : Visibility.Visible;
            button.ToolTip = reason;
        }
        _moreActions.IsEnabled = !_dialogOpen;
        _resume.Visibility = CanResume && !_executing && !_workerActive ? Visibility.Visible : Visibility.Collapsed;
        _officeLanguage.IsEnabled = !_executing && !_workerActive && !_dialogOpen;
        _refresh.IsEnabled = !_refreshing && !_dialogOpen;
        _export.IsEnabled = !_dialogOpen;
        _resume.IsEnabled = CanResume && !_executing && !_workerActive && !_refreshing && _inventory != null && _journalError.Length == 0 && !_dialogOpen;
        var resumeBlocker = _inventory == null ? T("NeedsDetection") : RecoveryBlocker() is { } recovery ? T(recovery)
            : Policy.Blocker(_inventory) is { } code ? T(code) : null;
        if (resumeBlocker != null) _resume.IsEnabled = false;
        _resumeReason.Text = _job != null && !OwnTask ? T("ACTOR_MISMATCH") : _job != null && resumeBlocker != null ? T("ActionBlocked", resumeBlocker) : "";
        _resumeReason.Visibility = _resumeReason.Text.Length == 0 ? Visibility.Collapsed : Visibility.Visible;
        _cancel.IsEnabled = (_executing || _workerActive && OwnTask) && !_cancelRequested;
        _cancel.Visibility = _executing || _workerActive ? Visibility.Visible : Visibility.Collapsed;
        _notice.Text = _errorCode.Length > 0 ? T(_errorCode) : _journalError.Length > 0 ? T("ReadFailed", T(_journalError)) : _resolvingServer ? T("ResolvingServer") : _exportedPath.Length > 0 ? T("Exported", _exportedPath) : "";
        _notice.Foreground = _errorCode == "WORKER_START_PENDING" || _resolvingServer && _errorCode.Length == 0 && _journalError.Length == 0 ? Purple
            : _errorCode.Length == 0 && _journalError.Length == 0 && _exportedPath.Length > 0 ? Muted : ErrorColor;
        _notice.Visibility = _notice.Text.Length == 0 ? Visibility.Collapsed : Visibility.Visible;

        if (_job == null) AddText(_task, T("NoTask"), Muted);
        else
        {
            if (_workerActive) AddText(_task, T("BackgroundActive"), Purple);
            else if (_job.Status != JobStatus.Completed && CanResume) AddText(_task, T("Unfinished"), WarningColor);
            AddText(_task, T("TaskId") + ": " + _job.Id, Muted, 13);
            if (_job.Action != ActionKind.Uninstall)
            {
                AddText(_task, T("InitialServer") + ": " + _job.Server, Muted, 13);
                if (!string.IsNullOrEmpty(_job.ActivationServer)) AddText(_task, T("ActualServer") + ": " + _job.ActivationServer, Muted, 13);
            }
            AddText(_task, T(_job.Action.ToString()) + " · " + T("Stage") + ": " + T("Stage_" + _job.Stage));
            var interrupted = !_workerActive && !_executing && _job.Status == JobStatus.Running;
            var restartVerified = _job.Status == JobStatus.AwaitingRestart && _job.RestartBoot == null && _job.RestartVerifiedBoot != null;
            AddText(_task, T("Status") + ": " + T(interrupted ? "Status_Interrupted" : restartVerified ? "Status_ReadyToResume" : "Status_" + _job.Status), interrupted || _job.Status is JobStatus.Failed or JobStatus.NeedsReview or JobStatus.ComponentMissing ? ErrorColor : Ink);
            AddText(_task, T(interrupted ? "WORKER_INTERRUPTED" : _job.Code));
            var facts = new List<string>();
            if (_job.Removed) facts.Add(T(_job.RemovalStarted ? "RemovalDone" : "RemovalSkipped"));
            if (_job.Installed) facts.Add(T("InstallationDone"));
            AddText(_task, facts.Count > 0 ? string.Join(" · ", facts) : T("NoCompletionFact"), Muted, 13);
            AddText(_task, T("UpdatedAt") + ": " + _job.UpdatedAt.ToLocalTime().ToString("g", CultureInfo.CurrentCulture), Muted, 13);
            foreach (var entry in _job.Events.TakeLast(6)) AddText(_task, entry.At.ToLocalTime().ToString("T", CultureInfo.CurrentCulture) + "  " + T("Stage_" + entry.Stage) + " · " + T(entry.Code), Muted, 13);
        }
        UpdateSummaryAndProgress();
    }

    private static readonly ControlTemplate RoundedButtonTemplate = (ControlTemplate)XamlReader.Parse("""
        <ControlTemplate xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation" xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml" TargetType="{x:Type Button}">
          <Border x:Name="Surface" Background="{TemplateBinding Background}" BorderBrush="{TemplateBinding BorderBrush}" BorderThickness="{TemplateBinding BorderThickness}" CornerRadius="10" Padding="{TemplateBinding Padding}">
            <ContentPresenter HorizontalAlignment="Center" VerticalAlignment="Center" RecognizesAccessKey="True" />
          </Border>
          <ControlTemplate.Triggers>
            <Trigger Property="IsMouseOver" Value="True"><Setter TargetName="Surface" Property="Opacity" Value="0.94" /></Trigger>
            <Trigger Property="IsPressed" Value="True"><Setter TargetName="Surface" Property="Opacity" Value="0.82" /></Trigger>
            <Trigger Property="IsKeyboardFocused" Value="True"><Setter TargetName="Surface" Property="BorderBrush" Value="#5F57FF" /><Setter TargetName="Surface" Property="BorderThickness" Value="2" /></Trigger>
          </ControlTemplate.Triggers>
        </ControlTemplate>
        """);

    private void UpdateSummaryAndProgress()
    {
        var busy = _executing || _workerActive;
        var job = _executing && _requestedJobId.HasValue && _job?.Id != _requestedJobId ? null : _job;
        var inventory = _inventory;
        if (inventory != null && OwnTask && job?.Observation is { } observation && observation.ObservedAt > inventory.ObservedAt)
            inventory = observation;
        var unknown = inventory == null || _errorCode == "INSPECTION_FAILED";
        _machine.Text = unknown ? T("AwaitingInspection") : FriendlyWindows(inventory!) + " · " + inventory!.Architecture;
        _officeSummary.Text = unknown ? T("UnknownFact") : inventory!.TargetInstalled && inventory.AllComponents ? T("InstalledShort")
            : inventory.HasOffice ? T("OfficeDetectedShort") : T("NotInstalledShort");
        _licenseSummary.Text = unknown || inventory!.LicenseError.Length > 0 ? T("UnknownFact") : !inventory.TargetInstalled ? T("AwaitingInspection")
            : inventory.TargetLicensed ? T("Licensed") : T("UnlicensedShort");
        _licenseSummary.Foreground = unknown || inventory!.LicenseError.Length > 0 ? WarningColor : inventory.TargetLicensed ? Green : Ink;
        var blocker = unknown ? null : RecoveryBlocker() ?? Policy.Blocker(inventory!);
        _readinessSummary.Text = unknown ? T("AwaitingInspection") : blocker != null ? T("NeedsAttentionShort")
            : inventory!.RestartReasons.Length > 0 ? T("PendingRestartShort") : T("ReadyShort");
        _readinessSummary.Foreground = blocker != null || !unknown && inventory!.RestartReasons.Length > 0 ? WarningColor : unknown ? Muted : Green;
        var attention = _errorCode.Length > 0 || _journalError.Length > 0 || blocker != null
            || job?.Status is JobStatus.AwaitingRestart or JobStatus.Failed or JobStatus.InstalledUnlicensed or JobStatus.ComponentMissing or JobStatus.NeedsReview;
        var currentReady = !unknown && inventory!.TargetInstalled && inventory.AllComponents && inventory.TargetLicensed;
        var removed = job?.Status == JobStatus.Completed && job.Action == ActionKind.Uninstall && !unknown && !inventory!.HasOffice;
        _headline.Text = T(busy ? "HeroRunning" : attention ? "HeroAttention" : removed ? "HeroRemoved" : currentReady ? "HeroFinish" : "HeroReady");
        _subline.Text = T(busy ? "HeroSubRunning" : attention ? "HeroSubAttention" : removed ? "HeroSubRemoved" : currentReady ? "HeroSubFinish" : "HeroSubReady");
        _statusLabel.Text = T(busy ? "StatusRunning" : attention ? "StatusAttention" : currentReady || removed ? "StatusComplete" : "StatusReady");
        _statusLabel.Foreground = busy ? Purple : attention ? WarningColor : Green;
        _statusBadge.Background = new SolidColorBrush(busy ? Color.FromRgb(239, 237, 255) : attention ? Color.FromRgb(255, 248, 233) : Color.FromRgb(237, 248, 243));

        var primary = _actionButtons[ActionKind.InstallActivate];
        var primaryKey = SuggestedOperation == PrimaryOperation.Resume ? _job?.Status == JobStatus.ComponentMissing ? "RepairComponents" : "ResumeActivation"
            : SuggestedOperation == PrimaryOperation.Activate ? "RetryActivation" : !unknown && inventory!.HasOffice ? "Reinstall" : "InstallActivate";
        ((TextBlock)primary.Content).Text = T(primaryKey);
        AutomationProperties.SetName(primary, T(primaryKey));
        if (SuggestedOperation == PrimaryOperation.Resume)
        {
            primary.IsEnabled = _resume.IsEnabled;
            _resume.Visibility = Visibility.Collapsed;
        }
        var primaryColor = primary.IsEnabled ? Brushes.White : Ink;
        primary.Foreground = primaryColor; ((TextBlock)primary.Content).Foreground = primaryColor;
        primary.Background = primary.IsEnabled ? Purple : Brushes.White;

        _elapsed.Text = busy && job != null ? T("Elapsed", FormatDuration(DateTimeOffset.UtcNow - job.StartedAt)) : "";
        var measured = OwnTask && job != null && busy ? ProgressPolicy.Current(job) : null;
        var percentage = PresentationPolicy.DisplayPercentage(measured);
        _progressHeading.Text = T(busy || job == null ? "Task" : "LastTask");
        var completed = job?.Status == JobStatus.Completed && !busy;
        _progressBar.IsIndeterminate = (busy || _refreshing || _resolvingServer) && percentage == null;
        _progressBar.Value = completed ? 100 : percentage ?? 0;
        _progressBar.Foreground = completed ? Green : Purple;
        _progressMetric.Text = completed ? "100%" : percentage.HasValue ? percentage.Value.ToString(CultureInfo.GetCultureInfo(_locale)) + "%" : "";
        _progressTitle.Text = _cancelRequested ? T("CancellationRequested") : _resolvingServer ? T("ResolvingServer") : _refreshing && job == null ? T("Detecting")
            : measured != null ? T(measured.Code) : job == null ? T(busy ? "WORKER_START_PENDING" : "WaitingProgress")
            : job.Code == "WAITING_INSTALLERS" ? T("WaitingSettlement") : job.Status == JobStatus.Running && !busy ? T("WORKER_INTERRUPTED")
            : T(job.Code);
        _progressCaption.Text = "";
        if (_cancelRequested) _progressCaption.Text = T("CancellationNotice");
        else if (measured is { Unit: ProgressUnit.Bytes })
            _progressCaption.Text = measured.Total.HasValue ? T("DownloadBytes", FormatBytes(measured.Completed), FormatBytes(measured.Total.Value)) : T("DownloadUnknownBytes", FormatBytes(measured.Completed));
        else if (measured is { Unit: ProgressUnit.Items })
            _progressCaption.Text = T("VerifyFileCount", measured.Completed, measured.Total!.Value);
        else if (job?.Code == "WAITING_INSTALLERS" && busy)
        {
            var started = job.Events.LastOrDefault(e => e.Code == "WAITING_INSTALLERS")?.At ?? job.UpdatedAt;
            var names = job.Observation?.Installers ?? [];
            _progressCaption.Text = T("WaitDuration", FormatDuration(DateTimeOffset.UtcNow - started))
                + (names.Length > 0 ? " · " + string.Join(", ", names) : "");
        }
        else if (job?.Installed == true && job.Code == "INSTALLER_BUSY") _progressCaption.Text = T("SettlementStopped");
        else if (job == null) _progressCaption.Text = T(busy ? "CancellationNotice" : "WaitingProgressCaption");
        else if (job.Status == JobStatus.Running && busy) _progressCaption.Text = T("AutomaticNextStep");
        else _progressCaption.Text = T("UpdatedAt") + ": " + job.UpdatedAt.ToLocalTime().ToString("g", CultureInfo.GetCultureInfo(_locale));
        AutomationProperties.SetName(_progressBar, _progressTitle.Text + ". " + _progressCaption.Text);
        RenderSteps(job, completed);
    }

    private static readonly Brush Green = new SolidColorBrush(Color.FromRgb(24, 134, 91));
    private static string FriendlyWindows(Inventory inventory)
    {
        var match = System.Text.RegularExpressions.Regex.Match(inventory.Windows, @"\b\d+\.\d+\.\d+(?:\.\d+)?\b", System.Text.RegularExpressions.RegexOptions.CultureInvariant);
        if (!match.Success || !Version.TryParse(match.Value, out var version)) return "Windows";
        return version.Major == 10 && version.Build >= 22000 ? "Windows 11" : version.Major == 10 ? "Windows 10" : "Windows";
    }
    private string FormatBytes(long bytes)
    {
        var units = new[] { "B", "KB", "MB", "GB" }; var index = 0; double value = bytes;
        while (value >= 1024 && index < units.Length - 1) { value /= 1024; index++; }
        return value.ToString(index == 0 ? "0" : "0.0", CultureInfo.GetCultureInfo(_locale)) + " " + units[index];
    }
    private static string FormatDuration(TimeSpan elapsed)
    {
        if (elapsed < TimeSpan.Zero) elapsed = TimeSpan.Zero;
        return elapsed.TotalHours >= 1 ? FormattableString.Invariant($"{(long)elapsed.TotalHours:00}:{elapsed.Minutes:00}:{elapsed.Seconds:00}")
            : elapsed.ToString(@"mm\:ss", CultureInfo.InvariantCulture);
    }
    private void RenderSteps(JobRecord? job, bool completed)
    {
        _steps.Children.Clear();
        var keys = job?.Action == ActionKind.Uninstall ? new[] { "PreparationStep", "RemovalStep", "VerificationStep", "FinishStep" }
            : job?.Action == ActionKind.Activate ? new[] { "PreparationStep", "VerificationStep", "ActivationStep", "FinishStep" }
            : new[] { "PreparationStep", "InstallationStep", "ActivationStep", "FinishStep" };
        var index = job?.Stage switch { Stage.Remove or Stage.Install or Stage.Components => 1, Stage.Activate => 2, Stage.Finished => completed ? 4 : 3, _ => 0 };
        for (var step = 0; step < 4; step++)
        {
            var done = completed || step < index; var active = !completed && step == index;
            var line = new StackPanel { Orientation = Orientation.Horizontal, Margin = new Thickness(0, 0, 6, 0) };
            line.Children.Add(new Border { Width = 22, Height = 22, CornerRadius = new CornerRadius(11), Margin = new Thickness(0, 0, 7, 0),
                Background = new SolidColorBrush(done ? Color.FromRgb(237, 248, 243) : active ? Color.FromRgb(239, 237, 255) : Color.FromRgb(248, 249, 252)),
                Child = new TextBlock { Text = done ? "✓" : (step + 1).ToString(CultureInfo.InvariantCulture), Foreground = done ? Green : active ? Purple : Muted,
                    FontSize = 11, HorizontalAlignment = HorizontalAlignment.Center, VerticalAlignment = VerticalAlignment.Center } });
            line.Children.Add(new TextBlock { Text = T(keys[step]), FontSize = 12, Foreground = active ? Purple : Muted, VerticalAlignment = VerticalAlignment.Center, TextWrapping = TextWrapping.Wrap });
            _steps.Children.Add(line);
        }
    }

    private void ReadTask()
    {
        try
        {
            var latest = Coordinator.Latest();
            _workerActive = Coordinator.IsWorkerActive();
            if (_workerActive && _errorCode == "WORKER_START_PENDING") _errorCode = "";
            // A stale pointer or a pre-exit Running record must not erase an observed final result.
            var keepFinal = _finalResult != null && (latest == null
                || latest.Id != _finalResult.Id && latest.UpdatedAt <= _finalResult.UpdatedAt
                || latest.Id == _finalResult.Id && (latest.UpdatedAt < _finalResult.UpdatedAt
                    || latest.Status == JobStatus.Running && _finalResult.Status != JobStatus.Running));
            _job = keepFinal ? _finalResult : latest;
            if (!keepFinal && latest != null && latest.Id != _finalResult?.Id) _finalResult = null;
            _journalError = "";
        }
        catch (OfficeFailure failure) { _journalError = failure.Code; }
        catch (Exception) { _journalError = "JOURNAL_READ_FAILED"; }
    }

    private void Poll()
    {
        if (_dialogOpen || _refreshing) return;
        var previouslyActive = _workerActive;
        ReadTask();
        if (!_workerActive && !_executing) _cancelRequested = false;
        ApplyState();
        if (previouslyActive && !_workerActive && !_executing) _ = RefreshAsync();
    }

    private async Task RefreshAsync()
    {
        if (_refreshing) return;
        _refreshing = true;
        _errorCode = "";
        _exportedPath = "";
        ReadTask();
        ApplyState();
        try
        {
            _inventory = await OfficePlatform.InspectAsync();
            if (!_executing && !_workerActive && OwnTask && RecoveryBlocker() != null)
            {
                // Reconcile only after a fresh observation and a verified Windows boot change.
                // The elevated worker repeats this check before modifying the machine.
                try
                {
                    _job = await Coordinator.ReviewInterruptedAsync(_job!, _inventory);
                    _finalResult = _job;
                }
                catch (OfficeFailure failure) { _errorCode = failure.Code; }
            }
        }
        catch (OfficeFailure failure) { _inventory = null; _errorCode = failure.Code; }
        catch (Exception) { _inventory = null; _errorCode = "INSPECTION_FAILED"; }
        finally { _refreshing = false; ApplyState(); }
    }

    private async Task StartAsync(ActionKind action)
    {
        if (_executing || _workerActive || _dialogOpen || _refreshing) return;
        await RefreshAsync();
        if (BlockReason(action) != null || _inventory == null) return;
        var language = _installationLanguage;
        _dialogOpen = true;
        _resolvingServer = action != ActionKind.Uninstall;
        ApplyState();
        var accepted = false;
        var server = "k.302.pub";
        try
        {
            if (action != ActionKind.Uninstall) server = await ActivationSource.ResolveAsync();
            _resolvingServer = false;
            ApplyState();
            if (IsVisible) accepted = ShowConfirmation(action, false, server, language);
        }
        catch (OfficeFailure failure) { _errorCode = failure.Code; }
        catch (Exception) { _errorCode = "SERVER_INVALID"; }
        finally { _dialogOpen = false; _resolvingServer = false; ApplyState(); }
        if (!accepted) return;
        await RunAsync(action, null, server, language);
    }

    private async Task ResumeAsync()
    {
        if (_executing || _workerActive || _dialogOpen || _refreshing) return;
        await RefreshAsync();
        if (!CanResume || _job == null || _inventory == null || _journalError.Length > 0) return;
        if (RecoveryBlocker() is { } recovery) { _errorCode = recovery; ApplyState(); return; }
        if (Policy.Blocker(_inventory) is { } blocker) { _errorCode = blocker; ApplyState(); return; }
        var existing = _job;
        _dialogOpen = true;
        ApplyState();
        bool accepted;
        try { accepted = ShowConfirmation(existing.Action, true, existing.Server, existing.Language); }
        finally { _dialogOpen = false; ApplyState(); }
        if (accepted) await RunAsync(existing.Action, existing, existing.Server, existing.Language);
    }

    private async Task RunAsync(ActionKind action, JobRecord? resume, string server, string language)
    {
        if (_executing || _workerActive || _inventory == null) return;
        _executing = true;
        _finalResult = null;
        _cancelRequested = false;
        _errorCode = "";
        _exportedPath = "";
        var cancellation = new CancellationTokenSource();
        _cancellation = cancellation;
        var requestId = resume?.Id ?? Guid.NewGuid();
        _requestedJobId = requestId;
        ApplyState();
        try
        {
            cancellation.Token.ThrowIfCancellationRequested();
            var request = new JobRequest(requestId, action, language, server, _inventory.Fingerprint, resume != null);
            _job = await Coordinator.LaunchAsync(request, new Progress<JobRecord>(record => { _job = record; ApplyState(); }), cancellation.Token);
        }
        catch (OfficeFailure failure) { _errorCode = failure.Code; }
        catch (OperationCanceledException) { _errorCode = "CANCELLED"; }
        catch (Exception) { _errorCode = "EXECUTION_FAILED"; }
        finally
        {
            _executing = false;
            if (_errorCode == "WORKER_START_PENDING") _errorCode = "";
            cancellation.Dispose();
            _cancellation = null;
            if (_job?.Id == requestId) _finalResult = _job;
            ReadTask();
            _cancelRequested = _workerActive && _cancelRequested;
            ApplyState();
            if (!_allowClose) await RefreshAfterTaskAsync();
        }
    }

    private async Task RefreshAfterTaskAsync()
    {
        if (_refreshing) return;
        _refreshing = true;
        ApplyState();
        try { _inventory = await OfficePlatform.InspectAsync(); }
        catch (OfficeFailure failure) { _inventory = null; _errorCode = failure.Code; }
        catch (Exception) { _inventory = null; _errorCode = "INSPECTION_FAILED"; }
        finally { _refreshing = false; ApplyState(); }
    }

    private async Task CancelAsync()
    {
        if (_cancelRequested) return;
        _cancelRequested = true;
        ApplyState();
        try
        {
            if (_cancellation != null) _cancellation.Cancel();
            else if (_job == null || !await Coordinator.RequestCancelAsync(_job.Id))
            {
                _cancelRequested = false;
                _errorCode = "CANCEL_REQUEST_FAILED";
            }
        }
        catch (OfficeFailure failure) { _cancelRequested = false; _errorCode = failure.Code; }
        catch (Exception) { _cancelRequested = false; _errorCode = "CANCEL_REQUEST_FAILED"; }
        ApplyState();
    }

    private bool ShowConfirmation(ActionKind action, bool resume, string server, string language)
    {
        var dialog = new Window
        {
            Owner = this, Title = T("ConfirmTitle"), Width = Math.Min(680, SystemParameters.WorkArea.Width),
            MinWidth = Math.Min(560, SystemParameters.WorkArea.Width), SizeToContent = SizeToContent.Height,
            MaxHeight = SystemParameters.WorkArea.Height, WindowStartupLocation = WindowStartupLocation.CenterOwner,
            Background = Brushes.White, Foreground = Ink, FontFamily = FontFamily, FontSize = 15, ShowInTaskbar = false
        };
        var root = new StackPanel { Margin = new Thickness(24) };
        AddText(root, T(action == ActionKind.InstallActivate ? "ConfirmInstall" : action == ActionKind.Activate ? "ConfirmActivate" : "ConfirmUninstall"), size: 23);
        AddText(root, T(resume ? "ResumeConfirm" : action == ActionKind.InstallActivate ? "RemoveScope" : action == ActionKind.Activate ? "ActivateScope" : "UninstallScope"));
        if (action != ActionKind.Activate) AddText(root, T("Preservation"), WarningColor);
        if (action == ActionKind.InstallActivate) AddText(root, T("FixedProduct") + "\n" + T("InstallationLanguage") + ": " + InstallationLanguageName(language) + "\n" + string.Join(", ", Policy.Components.Select(id => Text.Component(id, _locale))));
        if (action != ActionKind.Uninstall)
        {
            AddText(root, T("InitialServer") + ": " + server);
            AddText(root, T("FallbackServer") + ": k.302.pub", Muted, 14);
        }
        AddText(root, T("Elevation"), Muted, 14);
        if (action != ActionKind.Uninstall) AddText(root, T("TermsInstruction"), Muted, 14);
        var termsStatus = new TextBlock { Foreground = Muted, TextWrapping = TextWrapping.Wrap, Margin = new Thickness(0, 8, 0, 10) };
        var agreeText = new TextBlock { Text = T("TermsAgree"), Foreground = Ink, TextWrapping = TextWrapping.Wrap };
        var agree = new CheckBox { Content = agreeText, Foreground = Ink, IsEnabled = false, IsChecked = false, MinHeight = 44, VerticalContentAlignment = VerticalAlignment.Center, Margin = new Thickness(0, 4, 0, 16) };
        AutomationProperties.SetName(agree, T("TermsAgree"));
        AutomationProperties.SetAutomationId(agree, "AgreeMicrosoftTerms");
        var opened = false;
        var open = DialogButton(T("TermsOpen"), false);
        AutomationProperties.SetAutomationId(open, "OpenMicrosoftTerms");
        open.Click += (_, _) =>
        {
            try
            {
                Process.Start(new ProcessStartInfo(Policy.TermsUrl) { UseShellExecute = true });
                opened = true;
                agree.IsEnabled = true;
                termsStatus.Text = T("TermsOpened");
                termsStatus.Foreground = Muted;
            }
            catch (Exception)
            {
                opened = false;
                agree.IsEnabled = false;
                agree.IsChecked = false;
                termsStatus.Text = T("TermsFailed");
                termsStatus.Foreground = ErrorColor;
            }
        };
        if (action != ActionKind.Uninstall)
        {
            root.Children.Add(open);
            root.Children.Add(termsStatus);
            root.Children.Add(agree);
        }
        var buttons = new StackPanel { Orientation = Orientation.Horizontal, HorizontalAlignment = HorizontalAlignment.Right };
        var back = DialogButton(T("Back"), false);
        back.IsCancel = true;
        back.Click += (_, _) => dialog.DialogResult = false;
        var confirm = DialogButton(T("Continue"), true);
        confirm.IsEnabled = false;
        confirm.Background = Brushes.White;
        confirm.Foreground = Ink;
        ((TextBlock)confirm.Content).Foreground = Ink;
        AutomationProperties.SetAutomationId(confirm, "ConfirmOperation");
        void UpdateConfirm()
        {
            confirm.IsEnabled = action == ActionKind.Uninstall || opened && agree.IsChecked == true;
            confirm.Background = confirm.IsEnabled ? Purple : Brushes.White;
            confirm.Foreground = confirm.IsEnabled ? Brushes.White : Ink;
            ((TextBlock)confirm.Content).Foreground = confirm.Foreground;
        }
        agree.Checked += (_, _) => UpdateConfirm();
        agree.Unchecked += (_, _) => UpdateConfirm();
        confirm.Click += (_, _) => { if (action == ActionKind.Uninstall || opened && agree.IsChecked == true) dialog.DialogResult = true; };
        buttons.Children.Add(back);
        buttons.Children.Add(confirm);
        root.Children.Add(buttons);
        UpdateConfirm();
        dialog.Content = new ScrollViewer { Content = root, VerticalScrollBarVisibility = ScrollBarVisibility.Auto, HorizontalScrollBarVisibility = ScrollBarVisibility.Disabled, Foreground = Ink };
        return dialog.ShowDialog() == true;
    }

    private string InstallationLanguageName(string code) => code.ToLowerInvariant() switch
    {
        "zh-cn" => T("Chinese"), "it-it" => T("Italian"), "en-us" => T("English"), _ => code
    };

    private static Button DialogButton(string text, bool primary) => new()
    {
        Content = new TextBlock { Text = text, TextWrapping = TextWrapping.Wrap, Foreground = primary ? Brushes.White : Ink, TextAlignment = TextAlignment.Center },
        Template = RoundedButtonTemplate, MinHeight = 44, MaxWidth = 320, Padding = new Thickness(16, 10, 16, 10), Margin = new Thickness(8, 0, 0, 0),
        Foreground = primary ? Brushes.White : Ink, Background = primary ? Purple : Brushes.White,
        BorderBrush = primary ? Purple : BorderColor, BorderThickness = new Thickness(1)
    };

    private void ExportReport()
    {
        var dialog = new SaveFileDialog
        {
            Title = T("ExportTitle"), Filter = T("ExportFilter"), DefaultExt = ".json", AddExtension = true,
            FileName = "ChinaTech-Office-" + DateTime.Now.ToString("yyyyMMdd-HHmmss", CultureInfo.InvariantCulture) + ".json"
        };
        if (dialog.ShowDialog(this) != true) return;
        try
        {
            File.WriteAllText(dialog.FileName, Reports.Export(_inventory, _job, _locale), new UTF8Encoding(false));
            _errorCode = "";
            _exportedPath = dialog.FileName;
        }
        catch (OfficeFailure failure) { _errorCode = failure.Code; }
        catch (Exception) { _errorCode = "EXPORT_FAILED"; }
        ApplyState();
    }

    private void OnClosing(object? sender, CancelEventArgs args)
    {
        if (_allowClose) return;
        ReadTask();
        if (_executing && !_workerActive)
        {
            args.Cancel = true;
            _errorCode = "WORKER_START_PENDING";
            ApplyState();
            return;
        }
        if (!_workerActive) return;
        var dialog = new Window
        {
            Owner = this, Title = T("CloseBusyTitle"), Width = Math.Min(540, SystemParameters.WorkArea.Width),
            MaxHeight = SystemParameters.WorkArea.Height, SizeToContent = SizeToContent.Height,
            WindowStartupLocation = WindowStartupLocation.CenterOwner, Background = Brushes.White,
            Foreground = Ink, FontFamily = FontFamily, FontSize = 15, ShowInTaskbar = false, ResizeMode = ResizeMode.NoResize
        };
        var root = new StackPanel { Margin = new Thickness(24) };
        AddText(root, T("CloseBusy"));
        var buttons = new StackPanel { Orientation = Orientation.Horizontal, HorizontalAlignment = HorizontalAlignment.Right, Margin = new Thickness(0, 12, 0, 0) };
        var back = DialogButton(T("Back"), false);
        back.Click += (_, _) => dialog.DialogResult = false;
        back.IsCancel = true;
        var close = DialogButton(T("CloseWindow"), true);
        close.Click += (_, _) => dialog.DialogResult = true;
        buttons.Children.Add(back);
        buttons.Children.Add(close);
        root.Children.Add(buttons);
        dialog.Content = new ScrollViewer { Content = root, VerticalScrollBarVisibility = ScrollBarVisibility.Auto,
            HorizontalScrollBarVisibility = ScrollBarVisibility.Disabled };
        _allowClose = dialog.ShowDialog() == true;
        args.Cancel = !_allowClose;
    }
}
