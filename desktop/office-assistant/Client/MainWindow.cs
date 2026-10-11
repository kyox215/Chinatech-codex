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
using System.Windows.Threading;
using Microsoft.Win32;

namespace ChinaTech.OfficeAssistant;

public sealed class MainWindow : Window
{
    private static readonly Brush Ink = new SolidColorBrush(Color.FromRgb(35, 40, 49));
    private static readonly Brush Muted = new SolidColorBrush(Color.FromRgb(85, 95, 110));
    private static readonly Brush Purple = new SolidColorBrush(Color.FromRgb(95, 87, 255));
    private static readonly Brush BorderColor = new SolidColorBrush(Color.FromRgb(218, 222, 230));
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
        // WPF dimensions and WorkArea use device-independent units, including at high DPI.
        var workArea = SystemParameters.WorkArea;
        Width = Math.Min(1120, workArea.Width);
        Height = Math.Min(860, workArea.Height);
        MinWidth = Math.Min(780, workArea.Width);
        MinHeight = Math.Min(640, workArea.Height);
        WindowStartupLocation = WindowStartupLocation.CenterScreen;
        Background = new SolidColorBrush(Color.FromRgb(245, 246, 249));
        Foreground = Ink;
        FontFamily = new FontFamily("Segoe UI");
        FontSize = 15;

        var root = new StackPanel { Margin = new Thickness(24) };
        var header = new Grid { Margin = new Thickness(0, 0, 0, 20) };
        header.ColumnDefinitions.Add(new ColumnDefinition());
        header.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
        var heading = new StackPanel();
        heading.Children.Add(new TextBlock { Text = "CHINATECH", FontWeight = FontWeights.SemiBold, FontSize = 14, Foreground = Purple });
        heading.Children.Add(Label("Title", 28, FontWeights.SemiBold));
        heading.Children.Add(Label("Subtitle", 15, color: Muted));
        header.Children.Add(heading);
        var language = new StackPanel { Margin = new Thickness(20, 0, 0, 0) };
        language.Children.Add(Label("InterfaceLanguage", 13, color: Muted));
        language.Children.Add(_uiLanguage);
        Grid.SetColumn(language, 1);
        header.Children.Add(language);
        root.Children.Add(header);

        _uiLanguage.ItemsSource = new[] { "中文", "Italiano", "English" };
        _uiLanguage.SelectedIndex = _locale == "zh-cn" ? 0 : _locale == "it-it" ? 1 : 2;
        AutomationProperties.SetAutomationId(_uiLanguage, "InterfaceLanguage");
        _uiLanguage.SelectionChanged += (_, _) =>
        {
            if (_updating) return;
            _locale = _uiLanguage.SelectedIndex == 0 ? "zh-cn" : _uiLanguage.SelectedIndex == 1 ? "it-it" : "en-us";
            ApplyText();
            ApplyState();
        };

        var cards = new Grid();
        cards.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(0.9, GridUnitType.Star) });
        cards.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1.1, GridUnitType.Star) });
        var configuration = new StackPanel();
        configuration.Children.Add(Label("Configuration", 21, FontWeights.SemiBold));
        configuration.Children.Add(Label("FixedProduct", 17, FontWeights.SemiBold));
        configuration.Children.Add(Label("AllComponents", 14, color: Muted));
        var components = new Grid { Margin = new Thickness(0, 8, 0, 12) };
        components.ColumnDefinitions.Add(new ColumnDefinition());
        components.ColumnDefinitions.Add(new ColumnDefinition());
        for (var index = 0; index < Policy.Components.Length; index++)
        {
            if (index % 2 == 0) components.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
            var id = Policy.Components[index];
            var component = new TextBlock { Text = "✓  " + Text.Component(id, _locale), Tag = id, FontSize = 15, Foreground = Ink, TextWrapping = TextWrapping.Wrap, Margin = new Thickness(0, 5, 10, 5) };
            if (id is "Outlook" or "Lync") _labels.Add(component, "Component:" + id);
            AutomationProperties.SetAutomationId(component, "FixedComponent" + id);
            Grid.SetRow(component, index / 2);
            Grid.SetColumn(component, index % 2);
            components.Children.Add(component);
        }
        configuration.Children.Add(components);
        configuration.Children.Add(Label("InstallationLanguage", 15, FontWeights.SemiBold));
        configuration.Children.Add(_officeLanguage);
        AutomationProperties.SetAutomationId(_officeLanguage, "InstallationLanguage");
        _officeLanguage.SelectionChanged += (_, _) =>
        {
            if (!_updating && _officeLanguage.SelectedIndex >= 0)
                _installationLanguage = Policy.Languages[_officeLanguage.SelectedIndex];
        };
        configuration.Children.Add(Label("LanguageNotice", 13, color: Muted));
        var configurationCard = Card(configuration);
        configurationCard.Margin = new Thickness(0, 0, 16, 16);
        cards.Children.Add(configurationCard);

        var detection = new StackPanel();
        detection.Children.Add(Label("Detection", 21, FontWeights.SemiBold));
        detection.Children.Add(_facts);
        detection.Children.Add(_warnings);
        var detectionCard = Card(detection);
        Grid.SetColumn(detectionCard, 1);
        cards.Children.Add(detectionCard);
        root.Children.Add(cards);

        var actions = new StackPanel();
        actions.Children.Add(Label("Actions", 21, FontWeights.SemiBold));
        var actionGrid = new Grid { Margin = new Thickness(0, 8, 0, 0) };
        foreach (var _ in Enum.GetValues<ActionKind>()) actionGrid.ColumnDefinitions.Add(new ColumnDefinition());
        foreach (var kind in Enum.GetValues<ActionKind>())
        {
            var column = new StackPanel { Margin = new Thickness(0, 0, kind == ActionKind.Uninstall ? 0 : 12, 0) };
            var button = Button(kind.ToString(), async (_, _) => await StartAsync(kind), kind == ActionKind.InstallActivate);
            button.MinHeight = 52;
            _actionButtons[kind] = button;
            var reason = new TextBlock { Foreground = Muted, FontSize = 13, TextWrapping = TextWrapping.Wrap, Margin = new Thickness(0, 6, 0, 4) };
            _actionReasons[kind] = reason;
            column.Children.Add(button);
            column.Children.Add(reason);
            Grid.SetColumn(column, (int)kind);
            actionGrid.Children.Add(column);
        }
        actions.Children.Add(actionGrid);
        var secondary = new WrapPanel { Margin = new Thickness(0, 8, 0, 0) };
        _refresh = Button("Refresh", async (_, _) => await RefreshAsync());
        _export = Button("Export", (_, _) => ExportReport());
        _resume = Button("Resume", async (_, _) => await ResumeAsync());
        _cancel = Button("Cancel", async (_, _) => await CancelAsync());
        foreach (var button in new[] { _refresh, _export, _resume, _cancel })
        {
            button.Margin = new Thickness(0, 0, 10, 4);
            secondary.Children.Add(button);
        }
        actions.Children.Add(secondary);
        actions.Children.Add(_resumeReason);
        actions.Children.Add(_notice);
        root.Children.Add(Card(actions));

        var task = new StackPanel();
        task.Children.Add(Label("Task", 21, FontWeights.SemiBold));
        task.Children.Add(_task);
        root.Children.Add(Card(task));
        Content = new ScrollViewer { Content = root, VerticalScrollBarVisibility = ScrollBarVisibility.Auto, HorizontalScrollBarVisibility = ScrollBarVisibility.Disabled, Foreground = Ink };

        _timer.Tick += (_, _) => Poll();
        Loaded += async (_, _) => { await RefreshAsync(); _timer.Start(); };
        Closing += OnClosing;
        Closed += (_, _) => _timer.Stop();
        ApplyText();
        ApplyState();
    }

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
        CornerRadius = new CornerRadius(12), Padding = new Thickness(20), Margin = new Thickness(0, 0, 0, 16)
    };

    private Button Button(string key, RoutedEventHandler handler, bool primary = false)
    {
        var button = new Button
        {
            Content = new TextBlock { Text = T(key), TextWrapping = TextWrapping.Wrap, TextAlignment = TextAlignment.Center, Foreground = primary ? Brushes.White : Ink },
            MinHeight = 44, Padding = new Thickness(16, 10, 16, 10), Background = primary ? Purple : Brushes.White,
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
            label.Text = key.StartsWith("Component:", StringComparison.Ordinal) ? "✓  " + Text.Component(key[10..], _locale) : T(key);
        foreach (var (button, key) in _buttonLabels)
        {
            ((TextBlock)button.Content).Text = T(key);
            AutomationProperties.SetName(button, T(key));
        }
        _updating = true;
        _officeLanguage.ItemsSource = new[] { T("Chinese"), T("Italian"), T("English") };
        _officeLanguage.SelectedIndex = Array.IndexOf(Policy.Languages, _installationLanguage);
        _updating = false;
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
            var reason = BlockReason(kind);
            button.IsEnabled = reason == null;
            button.Opacity = reason == null ? 1 : 0.8;
            var textColor = reason == null && kind == ActionKind.InstallActivate ? Brushes.White : Ink;
            button.Foreground = textColor;
            ((TextBlock)button.Content).Foreground = textColor;
            button.Background = reason == null && kind == ActionKind.InstallActivate ? Purple : Brushes.White;
            _actionReasons[kind].Text = reason == null ? "" : T("ActionBlocked", reason);
        }
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
        if (_executing || _workerActive)
        {
            _task.Children.Add(new ProgressBar { IsIndeterminate = true, Height = 5, Foreground = Purple, Margin = new Thickness(0, 6, 0, 10) });
            AddText(_task, T(_cancelRequested ? "CancellationRequested" : "CancellationNotice"), Muted, 13);
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
        catch (OfficeFailure failure) { _errorCode = failure.Code; }
        catch (Exception) { _errorCode = "INSPECTION_FAILED"; }
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
        MinHeight = 44, MaxWidth = 320, Padding = new Thickness(16, 10, 16, 10), Margin = new Thickness(8, 0, 0, 0),
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
