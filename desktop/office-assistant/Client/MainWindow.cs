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
using System.Windows.Data;
using Microsoft.Win32;

namespace ChinaTech.OfficeAssistant;

public sealed partial class MainWindow : Window
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
    private readonly Button _moreActions;
    private readonly Button _appManagement;
    private readonly Button _detectionDetails;
    private readonly Button _taskDetails;
    private readonly Button _selectAll;
    private readonly Button _clearSelection;
    private readonly ContextMenu _otherMenu = new();
    private readonly Dictionary<MenuItem, string> _menuLabels = [];
    private readonly Dictionary<string, CheckBox> _componentChoices = [];
    private readonly Dictionary<string, TextBlock> _componentNames = [];
    private readonly Dictionary<string, TextBlock> _componentPresence = [];
    private readonly List<Border> _componentIcons = [];
    private readonly TextBlock _selectionCount = new() { FontSize = 12, VerticalAlignment = VerticalAlignment.Center, Foreground = Muted };
    private readonly TextBlock _compactProductName = new() { Text = "Office LTSC 2024", FontSize = 16, FontWeight = FontWeights.SemiBold, Visibility = Visibility.Collapsed };
    private readonly Grid _productRow = new();
    private readonly Grid _selectionToolbar = new();
    private readonly Grid _root = new();
    private readonly Grid _header = new();
    private readonly Grid _intro = new();
    private readonly StackPanel _actions = new();
    private readonly StackPanel _progress = new();
    private readonly Border _progressCard;
    private readonly Grid _footer = new();
    private readonly TextBlock _edition = new() { FontSize = 12, Foreground = Muted };
    private readonly TextBlock _productName = new() { Text = "Office LTSC 2024", FontSize = 18, FontWeight = FontWeights.SemiBold };
    private readonly Border _suiteIcon;
    private readonly HashSet<string> _selectedComponents = new(Policy.Components, StringComparer.Ordinal);
    private readonly HashSet<string> _removalTargets = new(StringComparer.Ordinal);
    private RemovalMode _removalMode = RemovalMode.All;
    private Border? _configurationCard;
    private Border? _detectionCard;
    private Guid? _requestedJobId;
    private bool _requestedUserOneDriveRemoval;
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
    private bool _preferNewSelection;
    private Guid? _restoredSelectionId;

    public MainWindow()
    {
        using var identity = WindowsIdentity.GetCurrent();
        _actorSid = identity.User?.Value ?? "";
        var workArea = SystemParameters.WorkArea;
        Width = Math.Min(980, workArea.Width);
        Height = Math.Min(800, workArea.Height);
        MinWidth = Math.Min(680, workArea.Width);
        MinHeight = Math.Min(520, workArea.Height);
        WindowStartupLocation = WindowStartupLocation.CenterScreen;
        Background = new SolidColorBrush(Color.FromRgb(245, 246, 250));
        Foreground = Ink;
        FontFamily = new FontFamily("Segoe UI");
        FontSize = 14;
        ApplyFluentTheme(this);
        _uiLanguage.FontSize = 14;
        _officeLanguage.FontSize = 16;
        _uiLanguage.Padding = _officeLanguage.Padding = new Thickness(8, 5, 8, 5);
        _officeLanguage.MinWidth = 175;
        _officeLanguage.MaxWidth = 240;
        _statusBadge.Child = _statusLabel;

        _officeLanguage.MinWidth = 108;
        _officeLanguage.MaxWidth = 140;
        var root = _root;
        root.Margin = new Thickness(20, 14, 20, 12);
        foreach (var height in new[] { GridLength.Auto, GridLength.Auto, GridLength.Auto, new GridLength(1, GridUnitType.Star), GridLength.Auto })
            root.RowDefinitions.Add(new RowDefinition { Height = height });
        var header = _header;
        header.Margin = new Thickness(0, 0, 0, 10);
        header.ColumnDefinitions.Add(new ColumnDefinition());
        header.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
        var brand = new StackPanel { Orientation = Orientation.Horizontal };
        brand.Children.Add(new Border { Width = 40, Height = 40, Background = Purple, CornerRadius = new CornerRadius(12), Margin = new Thickness(0, 0, 10, 0),
            Child = new TextBlock { Text = "▦", Foreground = Brushes.White, FontSize = 27, HorizontalAlignment = HorizontalAlignment.Center, VerticalAlignment = VerticalAlignment.Center } });
        var heading = new StackPanel();
        heading.Children.Add(Label("Title", 20, FontWeights.SemiBold));
        brand.Children.Add(heading); header.Children.Add(brand);
        Grid.SetColumn(_uiLanguage, 1); header.Children.Add(_uiLanguage); root.Children.Add(header);
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
        var intro = _intro;
        intro.Margin = new Thickness(0, 0, 0, 10);
        intro.ColumnDefinitions.Add(new ColumnDefinition());
        intro.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
        var introText = new StackPanel(); introText.Children.Add(_headline); introText.Children.Add(_subline);
        intro.Children.Add(introText); Grid.SetColumn(_statusBadge, 1); intro.Children.Add(_statusBadge); body.Children.Add(intro);
        _cards.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1.65, GridUnitType.Star) });
        _cards.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
        _cards.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
        var configuration = new StackPanel();
        _productRow.ColumnDefinitions.Add(new ColumnDefinition());
        _productRow.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
        var product = new StackPanel { Orientation = Orientation.Horizontal };
        _suiteIcon = new Border { Width = 30, Height = 34, CornerRadius = new CornerRadius(8), Background = new SolidColorBrush(Color.FromRgb(225, 107, 66)), Margin = new Thickness(0, 0, 8, 0),
            Child = new TextBlock { Text = "O", Foreground = Brushes.White, FontSize = 21, FontWeight = FontWeights.SemiBold, HorizontalAlignment = HorizontalAlignment.Center, VerticalAlignment = VerticalAlignment.Center } };
        product.Children.Add(_suiteIcon);
        var productText = new StackPanel(); productText.Children.Add(_productName); productText.Children.Add(_edition); product.Children.Add(productText);
        _productRow.Children.Add(product);
        _productRow.Margin = new Thickness(0, 0, 0, 4);
        Grid.SetColumn(_officeLanguage, 1); _productRow.Children.Add(_officeLanguage); configuration.Children.Add(_productRow);
        _selectionToolbar.ColumnDefinitions.Add(new ColumnDefinition());
        for (var i = 0; i < 3; i++) _selectionToolbar.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
        var selectionHeading = new StackPanel { VerticalAlignment = VerticalAlignment.Center };
        selectionHeading.Children.Add(_compactProductName); selectionHeading.Children.Add(_selectionCount);
        _selectionToolbar.Children.Add(selectionHeading);
        _selectAll = Button("SelectAll", (_, _) => SetComponentSelection(Policy.Components));
        _clearSelection = Button("ClearSelection", (_, _) => SetComponentSelection([]));
        foreach (var (button, column) in new[] { (_selectAll, 1), (_clearSelection, 2) })
        {
            button.Width = 58; button.Padding = new Thickness(5, 4, 5, 4);
            button.BorderThickness = new Thickness(0); button.Background = Brushes.Transparent;
            ((TextBlock)button.Content).FontSize = 12; Grid.SetColumn(button, column); _selectionToolbar.Children.Add(button);
        }
        configuration.Children.Add(_selectionToolbar);
        var components = new UniformGrid { Columns = 4 };
        var apps = new (string Id, string Letter, byte R, byte G, byte B)[] {
            ("Word", "W", 36, 113, 204), ("Excel", "X", 38, 136, 92), ("PowerPoint", "P", 225, 107, 66), ("Outlook", "O", 37, 146, 219),
            ("OneNote", "N", 148, 72, 200), ("Access", "A", 187, 71, 99), ("OneDrive", "☁", 66, 156, 240), ("Lync", "S", 57, 169, 212)
        };
        foreach (var app in apps)
        {
            var item = new Grid();
            item.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto }); item.ColumnDefinitions.Add(new ColumnDefinition());
            var icon = new Border { Width = 23, Height = 26, CornerRadius = new CornerRadius(6),
                Background = new SolidColorBrush(Color.FromRgb(app.R, app.G, app.B)), Margin = new Thickness(0, 0, 6, 0), VerticalAlignment = VerticalAlignment.Center,
                Child = new TextBlock { Text = app.Letter, Foreground = Brushes.White, FontSize = 13, FontWeight = FontWeights.SemiBold, HorizontalAlignment = HorizontalAlignment.Center, VerticalAlignment = VerticalAlignment.Center } };
            item.Children.Add(icon); _componentIcons.Add(icon);
            var names = new StackPanel { VerticalAlignment = VerticalAlignment.Center };
            var name = new TextBlock { FontSize = 13, TextWrapping = TextWrapping.Wrap, Foreground = Ink };
            var presence = new TextBlock { FontSize = 11, TextWrapping = TextWrapping.Wrap, Foreground = new SolidColorBrush(Color.FromRgb(24, 134, 91)) };
            _componentNames[app.Id] = name; _componentPresence[app.Id] = presence;
            names.Children.Add(name); names.Children.Add(presence); Grid.SetColumn(names, 1); item.Children.Add(names);
            var choice = new CheckBox { Content = item, IsChecked = true, MinHeight = 44, Padding = new Thickness(5, 3, 5, 3),
                VerticalContentAlignment = VerticalAlignment.Center, HorizontalContentAlignment = HorizontalAlignment.Stretch, Foreground = Ink };
            AutomationProperties.SetAutomationId(choice, "SelectComponent" + app.Id); _componentChoices[app.Id] = choice;
            choice.Checked += (_, _) => ChangeComponent(app.Id, true);
            choice.Unchecked += (_, _) => ChangeComponent(app.Id, false);
            components.Children.Add(new Border { Child = choice, BorderBrush = BorderColor, BorderThickness = new Thickness(1), Background = Brushes.White,
                CornerRadius = new CornerRadius(9), Margin = new Thickness(0, 0, 4, 4) });
        }
        configuration.Children.Add(components);
        _officeLanguage.ToolTip = T("LanguageNotice");
        AutomationProperties.SetAutomationId(_officeLanguage, "InstallationLanguage");
        _officeLanguage.SelectionChanged += (_, _) => { if (!_updating && _officeLanguage.SelectedIndex >= 0) _installationLanguage = Policy.Languages[_officeLanguage.SelectedIndex]; };
        _configurationCard = Card(configuration); _configurationCard.Padding = new Thickness(14); _configurationCard.Margin = new Thickness(0, 0, 12, 0); _cards.Children.Add(_configurationCard);
        _refresh = Button("Refresh", async (_, _) => await RefreshAsync());
        _refresh.Width = 44; _refresh.Padding = new Thickness(0);
        var detection = new StackPanel();
        var detectionHeader = new Grid(); detectionHeader.ColumnDefinitions.Add(new ColumnDefinition()); detectionHeader.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
        var detectionTitle = Label("Detection", 14, FontWeights.SemiBold); detectionTitle.VerticalAlignment = VerticalAlignment.Center; detectionHeader.Children.Add(detectionTitle);
        Grid.SetColumn(_refresh, 1); detectionHeader.Children.Add(_refresh); detection.Children.Add(detectionHeader); detection.Children.Add(_machine);
        detection.Children.Add(SummaryLine("Office", _officeSummary)); detection.Children.Add(SummaryLine("License", _licenseSummary)); detection.Children.Add(SummaryLine("SystemReadiness", _readinessSummary));
        _detectionDetails = Button("DetectedDetails", (_, _) => ShowDetails(false)); _detectionDetails.BorderThickness = new Thickness(0); _detectionDetails.Padding = new Thickness(0, 4, 0, 4);
        _detectionDetails.HorizontalAlignment = HorizontalAlignment.Left; detection.Children.Add(_detectionDetails);
        _detectionCard = Card(detection); _detectionCard.Padding = new Thickness(14); _detectionCard.Margin = new Thickness(0); Grid.SetColumn(_detectionCard, 1); _cards.Children.Add(_detectionCard); body.Children.Add(_cards);
        // The main content has no ScrollViewer. Long details open in separate windows.
        Grid.SetRow(body, 1); root.Children.Add(body);
        var actions = _actions; actions.Margin = new Thickness(0, 10, 0, 10);
        var toolbar = new Grid();
        toolbar.ColumnDefinitions.Add(new ColumnDefinition()); toolbar.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
        foreach (var kind in Enum.GetValues<ActionKind>())
        {
            _actionButtons[kind] = Button(kind.ToString(), async (_, _) => {
                if (kind == ActionKind.InstallActivate && CurrentSelectionReady) { await RefreshAsync(); if (CurrentSelectionReady) ShowDetails(false); }
                else if (kind == ActionKind.InstallActivate && SuggestedOperation == PrimaryOperation.Resume) await ResumeAsync();
                else await StartAsync(kind == ActionKind.InstallActivate ? PrimaryAction : kind, kind == ActionKind.InstallActivate);
            }, kind == ActionKind.InstallActivate);
            _actionReasons[kind] = new TextBlock { FontSize = 12, Foreground = Muted, TextWrapping = TextWrapping.Wrap };
        }
        var primary = _actionButtons[ActionKind.InstallActivate];
        primary.HorizontalAlignment = HorizontalAlignment.Left; primary.MinWidth = 170; primary.Margin = new Thickness(0, 0, 8, 0); toolbar.Children.Add(primary);
        _export = Button("Export", (_, _) => ExportReport());
        _appManagement = Button("AppManagement", async (_, _) => await StartAsync(ActionKind.Uninstall));
        _appManagement.SetBinding(UIElement.IsEnabledProperty, new Binding("IsEnabled") { Source = _actionButtons[ActionKind.Uninstall] });
        _appManagement.SetBinding(ToolTipProperty, new Binding("ToolTip") { Source = _actionButtons[ActionKind.Uninstall] });
        ToolTipService.SetShowOnDisabled(_appManagement, true);
        _resume = Button("Resume", async (_, _) => await ResumeAsync()); _cancel = Button("Cancel", async (_, _) => await CancelAsync());
        _moreActions = Button("MoreActions", (_, _) => { _otherMenu.PlacementTarget = _moreActions; _otherMenu.IsOpen = true; });
        _moreActions.Width = _moreActions.MinWidth = 44; _moreActions.Padding = new Thickness(0);
        _otherMenu.Placement = PlacementMode.Bottom;
        foreach (var kind in new[] { ActionKind.Activate })
        {
            var menu = new MenuItem { Header = T(kind.ToString()), Height = 44, MinWidth = 220, FontSize = 13 };
            menu.SetBinding(UIElement.IsEnabledProperty, new Binding("IsEnabled") { Source = _actionButtons[kind] });
            menu.Click += async (_, _) => { _otherMenu.IsOpen = false; await StartAsync(kind); };
            _menuLabels[menu] = kind.ToString(); _otherMenu.Items.Add(menu);
        }
        var exportMenu = new MenuItem { Header = T("Export"), Height = 44, MinWidth = 220, FontSize = 13 };
        exportMenu.SetBinding(UIElement.IsEnabledProperty, new Binding("IsEnabled") { Source = _export });
        exportMenu.Click += (_, _) => { _otherMenu.IsOpen = false; ExportReport(); }; _menuLabels[exportMenu] = "Export"; _otherMenu.Items.Add(exportMenu);
        var secondary = new StackPanel { Orientation = Orientation.Horizontal, HorizontalAlignment = HorizontalAlignment.Right, VerticalAlignment = VerticalAlignment.Center };
        foreach (var button in new[] { _appManagement, _resume, _cancel, _moreActions }) { button.Margin = new Thickness(0, 0, 3, 0); secondary.Children.Add(button); }
        Grid.SetColumn(secondary, 1); toolbar.Children.Add(secondary); actions.Children.Add(toolbar);
        _notice.TextWrapping = TextWrapping.NoWrap; _notice.TextTrimming = TextTrimming.CharacterEllipsis;
        _notice.FontSize = 12; _notice.Margin = new Thickness(0, 5, 0, 0);
        actions.Children.Add(_notice); Grid.SetRow(actions, 2); root.Children.Add(actions);
        var progress = _progress;
        var progressHead = new Grid(); progressHead.ColumnDefinitions.Add(new ColumnDefinition()); progressHead.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
        progressHead.Children.Add(_progressHeading);
        _taskDetails = Button("TaskDetails", (_, _) => ShowDetails(true)); _taskDetails.BorderThickness = new Thickness(0); _taskDetails.Padding = new Thickness(6, 4, 6, 4);
        Grid.SetColumn(_taskDetails, 1); progressHead.Children.Add(_taskDetails); progress.Children.Add(progressHead); progress.Children.Add(_steps);
        var progressLine = new Grid(); progressLine.ColumnDefinitions.Add(new ColumnDefinition()); progressLine.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
        progressLine.Children.Add(_progressTitle);
        var metric = new StackPanel { Orientation = Orientation.Horizontal }; metric.Children.Add(_elapsed); metric.Children.Add(_progressMetric);
        Grid.SetColumn(metric, 1); progressLine.Children.Add(metric); progress.Children.Add(progressLine);
        progress.Children.Add(_progressBar); progress.Children.Add(_progressCaption);
        _progressCard = Card(progress); _progressCard.Padding = new Thickness(14, 8, 14, 10); _progressCard.Margin = new Thickness(0); _progressCard.VerticalAlignment = VerticalAlignment.Bottom; Grid.SetRow(_progressCard, 3); root.Children.Add(_progressCard);
        var footer = _footer; footer.Margin = new Thickness(0, 8, 0, 0); footer.VerticalAlignment = VerticalAlignment.Bottom;
        footer.ColumnDefinitions.Add(new ColumnDefinition()); footer.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
        footer.Children.Add(Label("ProtectionShort", 11, color: Muted)); var version = new TextBlock { Text = Policy.Version, Foreground = Muted, FontSize = 11 }; Grid.SetColumn(version, 1); footer.Children.Add(version); Grid.SetRow(footer, 4); root.Children.Add(footer);
        Content = root;
        SizeChanged += (_, _) => ArrangeCards();
        _timer.Tick += (_, _) => Poll(); Loaded += async (_, _) => { ArrangeCards(); await RefreshAsync(); _timer.Start(); }; Closing += OnClosing;
        Closed += (_, _) => { _timer.Stop(); _otherMenu.IsOpen = false; };
        ApplyText(); ApplyState();
    }

    private UIElement SummaryLine(string key, TextBlock value)
    {
        var row = new Grid { Margin = new Thickness(0, 0, 0, 6) };
        row.ColumnDefinitions.Add(new ColumnDefinition()); row.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1.2, GridUnitType.Star) });
        var label = key == "Office" ? new TextBlock { Text = "Office", Foreground = Muted, FontSize = 13 } : Label(key, 13, color: Muted);
        row.Children.Add(label); Grid.SetColumn(value, 1); row.Children.Add(value); return row;
    }

    private void ArrangeCards()
    {
        if (_configurationCard == null || _detectionCard == null) return;
        var compact = ActualHeight < 660;
        _root.Margin = compact ? new Thickness(12, 6, 12, 6) : new Thickness(20, 14, 20, 12);
        _header.Margin = new Thickness(0, 0, 0, compact ? 4 : 10);
        _intro.Margin = new Thickness(0, 0, 0, compact ? 4 : 10);
        _headline.FontSize = compact ? 20 : 23;
        _subline.Visibility = compact ? Visibility.Collapsed : Visibility.Visible;
        _edition.Visibility = compact ? Visibility.Collapsed : Visibility.Visible;
        _machine.Visibility = compact ? Visibility.Collapsed : Visibility.Visible;
        _footer.Visibility = compact ? Visibility.Collapsed : Visibility.Visible;
        _configurationCard.Padding = _detectionCard.Padding = new Thickness(compact ? 6 : 14);
        _configurationCard.Margin = new Thickness(0, 0, compact ? 8 : 12, 0);
        _cards.ColumnDefinitions[0].Width = new GridLength(compact ? 2.7 : 1.65, GridUnitType.Star);
        _cards.ColumnDefinitions[1].Width = new GridLength(1, GridUnitType.Star);
        _actions.Margin = new Thickness(0, compact ? 6 : 10, 0, compact ? 6 : 10);
        _progressCard.Padding = compact ? new Thickness(14, 1, 14, 1) : new Thickness(14, 8, 14, 10);
        _productName.FontSize = compact ? 16 : 18;
        _productRow.Visibility = compact ? Visibility.Collapsed : Visibility.Visible;
        _compactProductName.Visibility = compact ? Visibility.Visible : Visibility.Collapsed;
        _suiteIcon.Visibility = compact ? Visibility.Collapsed : Visibility.Visible;
        foreach (var name in _componentNames.Values) name.FontSize = compact ? 12 : 13;
        foreach (var choice in _componentChoices.Values) choice.Padding = new Thickness(compact ? 1 : 5, 3, compact ? 1 : 5, 3);
        _appManagement.Visibility = compact && (_executing || _workerActive) ? Visibility.Collapsed : Visibility.Visible;
        foreach (var icon in _componentIcons) icon.Visibility = compact && ActualWidth < 850 ? Visibility.Collapsed : Visibility.Visible;
        _progressCaption.Visibility = compact ? Visibility.Collapsed : Visibility.Visible;
        _steps.Visibility = compact || !(_executing || _workerActive) ? Visibility.Collapsed : Visibility.Visible;
        var target = compact ? _selectionToolbar : _productRow;
        if (!ReferenceEquals(_officeLanguage.Parent, target))
        {
            if (_officeLanguage.Parent is Panel current) current.Children.Remove(_officeLanguage);
            Grid.SetColumn(_officeLanguage, compact ? 3 : 1); target.Children.Add(_officeLanguage);
        }
    }

    private PrimaryOperation SuggestedOperation => _preferNewSelection ? PrimaryOperation.InstallActivate : PresentationPolicy.Primary(_job, _inventory, OwnTask);
    private ActionKind PrimaryAction => SuggestedOperation == PrimaryOperation.Activate
        || _inventory != null && _selectedComponents.Count > 0 && OfficeSelection.ComponentsPresent(_inventory, Selection()) && OfficeSelection.InstalledForSelection(_inventory, Selection())
            && !OfficeSelection.LicensedForSelection(_inventory, Selection()) ? ActionKind.Activate : ActionKind.InstallActivate;
    private bool CurrentSelectionReady => SuggestedOperation == PrimaryOperation.InstallActivate && _inventory != null
        && _selectedComponents.Count > 0 && OfficeSelection.InstallBlocker(_inventory, Selection()) == null
        && OfficeSelection.ComponentsPresent(_inventory, Selection()) && OfficeSelection.InstalledForSelection(_inventory, Selection()) && OfficeSelection.LicensedForSelection(_inventory, Selection());
    private string[] Selection() => Policy.Components.Where(_selectedComponents.Contains).ToArray();
    private string[] DetectedOfficeComponents() => _inventory == null ? [] : Policy.Components.Where(id => id != "OneDrive"
        && _inventory.Components.Any(c => c.Id == id && c.Present)
        && OfficeSelection.RequiredProducts([id]).All(p => _inventory.OfficeProducts.Contains(p, StringComparer.OrdinalIgnoreCase))).ToArray();
    private void ChangeComponent(string id, bool selected)
    {
        if (_updating || _executing || _workerActive || _dialogOpen) return;
        _preferNewSelection = true;
        if (selected) _selectedComponents.Add(id); else _selectedComponents.Remove(id);
        ApplyState();
    }
    private void SetComponentSelection(IEnumerable<string> ids)
    {
        if (_executing || _workerActive || _dialogOpen || _refreshing) return;
        _preferNewSelection = true;
        _selectedComponents.Clear(); foreach (var id in ids) _selectedComponents.Add(id);
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
        CornerRadius = new CornerRadius(14), Padding = new Thickness(18), Margin = new Thickness(0, 0, 0, 16)
    };

    private Button Button(string key, RoutedEventHandler handler, bool primary = false)
    {
        var button = new Button
        {
            Content = new TextBlock { Text = T(key), TextWrapping = TextWrapping.Wrap, TextAlignment = TextAlignment.Center, Foreground = primary ? Brushes.White : Ink },
            Template = RoundedButtonTemplate, MinWidth = 0, MinHeight = 44, Height = 44, VerticalAlignment = VerticalAlignment.Center, Padding = new Thickness(12, 5, 12, 5), Background = primary ? Purple : Brushes.White,
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
            ((TextBlock)button.Content).Text = ReferenceEquals(button, _moreActions) ? "⋯" : ReferenceEquals(button, _refresh) ? "↻" : T(key);
            AutomationProperties.SetName(button, T(key));
            if (ReferenceEquals(button, _moreActions) || ReferenceEquals(button, _refresh)) button.ToolTip = T(key);
        }
        foreach (var (menu, key) in _menuLabels) { menu.Header = T(key); AutomationProperties.SetName(menu, T(key)); }
        foreach (var (id, label) in _componentNames) label.Text = Text.Component(id, _locale);
        _edition.Text = T("Edition");
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

    private string? BlockReason(ActionKind action, bool suggested = false)
    {
        if (_executing || _workerActive || _dialogOpen) return T("Busy");
        if (_refreshing) return T("Detecting");
        if (_journalError.Length > 0) return T("ReadFailed", T(_journalError));
        if (_inventory == null) return T("NeedsDetection");
        if (RecoveryBlocker() is { } recovery) return T(recovery);
        var blocker = Policy.Blocker(_inventory);
        if (blocker != null) return T(blocker);
        var selected = suggested && SuggestedOperation == PrimaryOperation.Activate && OwnTask
            ? OfficeSelection.Selected(_job!) : suggested ? Selection() : DetectedOfficeComponents();
        if (action == ActionKind.InstallActivate)
        {
            if (_selectedComponents.Count == 0) return T("SelectPrompt");
            if (OfficeSelection.InstallBlocker(_inventory, Selection()) is { } incompatible) return T(incompatible);
        }
        if (action == ActionKind.Activate && (selected.Length == 0 || !OfficeSelection.InstalledForSelection(_inventory, selected))) return T("NoTarget");
        if (action == ActionKind.Uninstall && !OfficeSelection.GetRemovalOptions(_inventory).Any()) return T("NoRemovalTarget");
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
        if (_errorCode == "ONEDRIVE_WINDOW_REQUIRED" && !RequiresOpenActorWindow) _errorCode = "";
        var selectionLocked = _executing || _workerActive || _dialogOpen || _refreshing || _inventory == null;
        _updating = true;
        foreach (var (id, choice) in _componentChoices)
        {
            choice.IsChecked = _selectedComponents.Contains(id); choice.IsEnabled = !selectionLocked;
            var present = _inventory?.Components.Any(c => c.Id == id && c.Present) == true;
            _componentPresence[id].Text = _inventory == null ? T("UnknownFact") : T(present ? "InstalledShort" : "NotInstalledShort");
            _componentPresence[id].Foreground = present ? Green : Muted;
            AutomationProperties.SetName(choice, Text.Component(id, _locale) + " · " + _componentPresence[id].Text);
            if (choice.Parent is Border frame) { frame.Background = choice.IsChecked == true ? new SolidColorBrush(Color.FromRgb(245, 244, 255)) : Brushes.White; frame.BorderBrush = choice.IsChecked == true ? Purple : BorderColor; }
        }
        _selectionCount.Text = T("SelectedCount", _selectedComponents.Count);
        _selectAll.IsEnabled = _clearSelection.IsEnabled = !selectionLocked;
        _updating = false;
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
            var reason = BlockReason(kind == ActionKind.InstallActivate ? PrimaryAction : kind, kind == ActionKind.InstallActivate);
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
        _moreActions.IsEnabled = !_dialogOpen && !_executing && !_workerActive;
        _resume.Visibility = CanResume && !_executing && !_workerActive ? Visibility.Visible : Visibility.Collapsed;
        _officeLanguage.IsEnabled = !selectionLocked;
        _refresh.IsEnabled = !_refreshing && !_dialogOpen && !_executing && !_workerActive;
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
        if (_notice.Text.Length == 0 && !_executing && !_workerActive) _notice.Text = _actionReasons[ActionKind.InstallActivate].Text;
        _notice.ToolTip = _notice.Text;
        _notice.Foreground = _errorCode == "WORKER_START_PENDING" || _resolvingServer && _errorCode.Length == 0 && _journalError.Length == 0 ? Purple
            : _errorCode.Length == 0 && _journalError.Length == 0 && _exportedPath.Length > 0 ? Muted : ErrorColor;
        _notice.Visibility = _notice.Text.Length == 0 ? Visibility.Collapsed : Visibility.Visible;

        if (_job == null) AddText(_task, T("NoTask"), Muted);
        else
        {
            if (_workerActive) AddText(_task, T("BackgroundActive"), Purple);
            else if (_job.Status != JobStatus.Completed && CanResume) AddText(_task, T("Unfinished"), WarningColor);
            AddText(_task, T("TaskId") + ": " + _job.Id, Muted, 13);
            AddText(_task, T("TaskSelection") + ": " + string.Join(" · ", OfficeSelection.Selected(_job).Select(id => Text.Component(id, _locale))), size: 13);
            if (_job.Action == ActionKind.Uninstall && _job.RemovalTargets is { Length: > 0 })
                AddText(_task, T("WillRemove") + ": " + string.Join(" · ", _job.RemovalTargets.Select(id => RemovalName(id, _job.SelectionPlan?.Baseline ?? _inventory))), size: 13);
            if (_job.Schema == 1) AddText(_task, T("LegacyTaskScope"), WarningColor, 13);
            if (_job.Action != ActionKind.Uninstall && (_job.Schema == 1 || OfficeSelection.RequiredProducts(OfficeSelection.Selected(_job)).Length != 0))
            {
                AddText(_task, T("InitialServer") + ": " + _job.Server, Muted, 13);
                if (!string.IsNullOrEmpty(_job.ActivationServer)) AddText(_task, T("ActualServer") + ": " + _job.ActivationServer, Muted, 13);
            }
            AddText(_task, T(_job.Action == ActionKind.InstallActivate && _job.Schema == 2 && OfficeSelection.RequiredProducts(OfficeSelection.Selected(_job)).Length == 0
                ? "InstallSelected" : _job.Action.ToString()) + " · " + T("Stage") + ": " + T("Stage_" + _job.Stage));
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
        ArrangeCards();
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
        var selected = Selection();
        var detectedOffice = unknown ? [] : DetectedOfficeComponents();
        var licensed = !unknown && OfficeSelection.LicensedForSelection(inventory!, detectedOffice);
        _officeSummary.Text = unknown ? T("UnknownFact") : inventory!.Components.Any(c => c.Id != "OneDrive" && c.Present)
            ? T("InstalledApplications", inventory.Components.Count(c => c.Id != "OneDrive" && c.Present)) : inventory.HasOffice ? T("OfficeDetectedShort") : T("NotInstalledShort");
        _licenseSummary.Text = unknown ? T("UnknownFact") : detectedOffice.Length == 0 ? T("NotApplicable")
            : inventory!.LicenseError.Length > 0 ? T("UnknownFact") : licensed ? T("Licensed") : T("UnlicensedShort");
        _licenseSummary.Foreground = unknown || inventory!.LicenseError.Length > 0 ? WarningColor : licensed ? Green : Ink;
        var blocker = unknown ? null : RecoveryBlocker() ?? Policy.Blocker(inventory!);
        _readinessSummary.Text = unknown ? T("AwaitingInspection") : blocker != null ? T("NeedsAttentionShort")
            : inventory!.RestartReasons.Length > 0 ? T("PendingRestartShort") : T("ReadyShort");
        _readinessSummary.Foreground = blocker != null || !unknown && inventory!.RestartReasons.Length > 0 ? WarningColor : unknown ? Muted : Green;
        var attention = _errorCode.Length > 0 || _journalError.Length > 0 || blocker != null
            || job?.Status is JobStatus.AwaitingRestart or JobStatus.Failed or JobStatus.InstalledUnlicensed or JobStatus.ComponentMissing or JobStatus.NeedsReview;
        var currentReady = !unknown && selected.Length > 0 && OfficeSelection.ComponentsPresent(inventory!, selected)
            && OfficeSelection.InstalledForSelection(inventory!, selected) && OfficeSelection.LicensedForSelection(inventory!, selected);
        var removed = OwnTask && job?.Status == JobStatus.Completed && job.Action == ActionKind.Uninstall && !unknown
            && (job.Schema == 1 ? !inventory!.HasOffice : job.SelectionPlan != null && OfficeSelection.RemovalComplete(inventory!, job));
        _headline.Text = T(busy ? "HeroRunning" : attention ? "HeroAttention" : removed ? "HeroRemoved" : currentReady ? "HeroFinish" : "HeroReady");
        _subline.Text = T(busy ? "HeroSubRunning" : attention ? "HeroSubAttention" : removed ? "HeroSubRemoved" : currentReady ? "HeroSubFinish" : "HeroSubReady");
        _statusLabel.Text = T(busy ? "StatusRunning" : attention ? "StatusAttention" : currentReady || removed ? "StatusComplete" : "StatusReady");
        _statusLabel.Foreground = busy ? Purple : attention ? WarningColor : Green;
        _statusBadge.Background = new SolidColorBrush(busy ? Color.FromRgb(239, 237, 255) : attention ? Color.FromRgb(255, 248, 233) : Color.FromRgb(237, 248, 243));

        var primary = _actionButtons[ActionKind.InstallActivate];
        var primaryKey = SuggestedOperation == PrimaryOperation.Resume ? _job?.Schema == 2 && OfficeSelection.RequiredProducts(OfficeSelection.Selected(_job)).Length == 0
                ? "Resume" : _job?.Status == JobStatus.ComponentMissing ? "RepairComponents" : "ResumeActivation"
            : CurrentSelectionReady ? "CheckSelected" : PrimaryAction == ActionKind.Activate ? "RetryActivation"
            : selected.Length == 0 ? "SelectPrompt" : selected.All(id => id == "OneDrive") ? "InstallSelected"
            : !unknown && inventory!.HasOffice ? "AddSelected" : "InstallActivate";
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
            : job?.Schema == 2 && OfficeSelection.RequiredProducts(OfficeSelection.Selected(job)).Length == 0
                ? new[] { "PreparationStep", "InstallationStep", "VerificationStep", "FinishStep" }
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
            if (!_preferNewSelection && OwnTask && _job != null && _restoredSelectionId != _job.Id)
            {
                _selectedComponents.Clear();
                _selectedComponents.UnionWith(OfficeSelection.Selected(_job));
                _installationLanguage = _job.Language;
                _restoredSelectionId = _job.Id;
            }
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

    private async Task StartAsync(ActionKind action, bool suggested = false)
    {
        if (_executing || _workerActive || _dialogOpen || _refreshing) return;
        await RefreshAsync();
        if (BlockReason(action, suggested) != null || _inventory == null) return;
        var baseline = _inventory;
        var components = action == ActionKind.Uninstall ? Policy.Components.ToArray()
            : suggested && SuggestedOperation == PrimaryOperation.Activate && OwnTask ? OfficeSelection.Selected(_job!)
            : suggested || action == ActionKind.InstallActivate ? Selection() : DetectedOfficeComponents();
        var language = _installationLanguage;
        _dialogOpen = true;
        var activatesOffice = action != ActionKind.Uninstall && OfficeSelection.RequiredProducts(components).Length != 0;
        _resolvingServer = activatesOffice;
        ApplyState();
        var accepted = false;
        var server = "k.302.pub";
        JobRequest? request = null;
        try
        {
            if (action == ActionKind.Uninstall && !ShowRemovalSelection(baseline)) return;
            if (activatesOffice) server = await ActivationSource.ResolveAsync();
            _resolvingServer = false;
            ApplyState();
            request = new JobRequest(Guid.NewGuid(), action, language, server, baseline.Fingerprint)
            {
                SelectedComponents = components.ToArray(), RemovalMode = _removalMode,
                RemovalTargets = action == ActionKind.Uninstall ? _removalTargets.Order(StringComparer.Ordinal).ToArray() : null
            };
            Policy.Validate(request);
            var plan = OfficeSelection.Freeze(ConfirmationRecord(request), baseline);
            if (IsVisible) accepted = ShowConfirmation(request, plan, false);
        }
        catch (OfficeFailure failure) { _errorCode = failure.Code; }
        catch (Exception) { _errorCode = "SERVER_INVALID"; }
        finally { _dialogOpen = false; _resolvingServer = false; ApplyState(); }
        if (!accepted || request == null) return;
        await RunAsync(request);
    }

    private async Task ResumeAsync()
    {
        if (_executing || _workerActive || _dialogOpen || _refreshing) return;
        await RefreshAsync();
        if (!CanResume || _job == null || _inventory == null || _journalError.Length > 0) return;
        if (RecoveryBlocker() is { } recovery) { _errorCode = recovery; ApplyState(); return; }
        if (Policy.Blocker(_inventory) is { } blocker) { _errorCode = blocker; ApplyState(); return; }
        var existing = _job;
        var request = new JobRequest(existing.Id, existing.Action, existing.Language, existing.Server, existing.ExpectedFingerprint, true)
        {
            SelectedComponents = existing.SelectedComponents?.ToArray(), RemovalMode = existing.RemovalMode,
            RemovalTargets = existing.RemovalTargets?.ToArray()
        };
        _dialogOpen = true;
        ApplyState();
        bool accepted;
        try { accepted = ShowConfirmation(request, existing.SelectionPlan, true); }
        finally { _dialogOpen = false; ApplyState(); }
        if (accepted) await RunAsync(request);
    }

    private async Task RunAsync(JobRequest request)
    {
        if (_executing || _workerActive || _inventory == null) return;
        _executing = true;
        _finalResult = null;
        _cancelRequested = false;
        _errorCode = "";
        _exportedPath = "";
        var cancellation = new CancellationTokenSource();
        _cancellation = cancellation;
        var requestId = request.Id;
        _requestedJobId = requestId;
        _requestedUserOneDriveRemoval = request.Action == ActionKind.Uninstall
            && request.RemovalTargets?.Any(id => id.StartsWith("onedrive:user:", StringComparison.Ordinal)) == true;
        ApplyState();
        try
        {
            cancellation.Token.ThrowIfCancellationRequested();
            _job = await Coordinator.LaunchAsync(request, new Progress<JobRecord>(record =>
            {
                _job = record;
                if (record.Id == request.Id && record.ActorSid == _actorSid)
                {
                    _preferNewSelection = false;
                    _restoredSelectionId = record.Id;
                }
                ApplyState();
            }), cancellation.Token);
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

    private bool ShowConfirmation(JobRequest request, SelectionPlan? plan, bool resume)
    {
        var action = request.Action;
        var components = request.SelectedComponents ?? Policy.Components;
        var activatesOffice = action != ActionKind.Uninstall && OfficeSelection.RequiredProducts(components).Length != 0;
        var dialog = ApplyFluentTheme(new Window
        {
            Owner = this, Title = T("ConfirmTitle"), Width = Math.Min(680, SystemParameters.WorkArea.Width),
            MinWidth = Math.Min(560, SystemParameters.WorkArea.Width), SizeToContent = SizeToContent.Height,
            MaxHeight = SystemParameters.WorkArea.Height, WindowStartupLocation = WindowStartupLocation.CenterOwner,
            Background = Brushes.White, Foreground = Ink, FontFamily = FontFamily, FontSize = 15, ShowInTaskbar = false
        });
        var root = new StackPanel { Margin = new Thickness(24) };
        AddText(root, ConfirmationTitle(request), size: 23);
        if (resume) AddText(root, T("ResumeConfirm"));
        if (resume && _job?.Schema == 1) AddText(root, T("LegacyTaskScope"), WarningColor);
        var legacy = resume && _job?.Schema == 1;
        AddText(root, T(legacy && action != ActionKind.Activate ? action == ActionKind.InstallActivate ? "RemoveScope" : "UninstallScope"
            : action == ActionKind.InstallActivate ? "InstallSelectedScope" : action == ActionKind.Activate ? "ActivateScope" : "UninstallSelectedScope"));
        AddText(root, T("Preservation"), WarningColor);
        if (action != ActionKind.Uninstall)
            AddText(root, T("TaskSelection") + ": " + string.Join(", ", components.Select(id => Text.Component(id, _locale))));
        if (action == ActionKind.InstallActivate)
        {
            if (activatesOffice) AddText(root, T("FixedProduct") + "\n" + T("InstallationLanguage") + ": " + InstallationLanguageName(request.Language));
            if (plan?.Baseline.OfficeProducts.Length > 0) AddText(root, T("RetainExistingInstallation") + " " + plan.Baseline.OfficeVersion);
        }
        if (action == ActionKind.Uninstall && !legacy)
        {
            var inventory = plan?.Baseline ?? _inventory;
            AddText(root, T("WillRemove") + ":\n" + string.Join("\n", (request.RemovalTargets ?? []).Select(id => "• " + RemovalName(id, inventory))));
            if (plan != null) AddText(root, T("WillKeep") + ":\n" + RemovalRetained(plan, request));
            if (request.RemovalTargets?.Any(id => id.StartsWith("onedrive:", StringComparison.Ordinal)) == true) AddText(root, T("OneDriveRemovalWarning"), WarningColor);
            if (request.RemovalTargets?.Any(id => id.StartsWith("onedrive:user:", StringComparison.Ordinal)) == true) AddText(root, T("ONEDRIVE_WINDOW_REQUIRED"), WarningColor);
            if (plan?.RemoveProducts.Contains(OfficeSelection.Suite) == true && request.RemovalTargets?.Any(id => id.StartsWith("c2r-app:", StringComparison.Ordinal)) == true) AddText(root, T("LastSuiteApplication"), WarningColor);
        }
        if (activatesOffice)
        {
            AddText(root, T("InitialServer") + ": " + request.Server);
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
        if (RequiresOpenActorWindow)
        {
            args.Cancel = true;
            _errorCode = "ONEDRIVE_WINDOW_REQUIRED";
            ApplyState();
            return;
        }
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
        var dialog = ApplyFluentTheme(new Window
        {
            Owner = this, Title = T("CloseBusyTitle"), Width = Math.Min(540, SystemParameters.WorkArea.Width),
            MaxHeight = SystemParameters.WorkArea.Height, SizeToContent = SizeToContent.Height,
            WindowStartupLocation = WindowStartupLocation.CenterOwner, Background = Brushes.White,
            Foreground = Ink, FontFamily = FontFamily, FontSize = 15, ShowInTaskbar = false, ResizeMode = ResizeMode.NoResize
        });
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

    private bool RequiresOpenActorWindow => _requestedUserOneDriveRemoval && (_executing
        || _workerActive && _job?.Id == _requestedJobId);

    private string ConfirmationTitle(JobRequest request) => T(request.Action == ActionKind.InstallActivate
        ? OfficeSelection.RequiredProducts(OfficeSelection.Selected(request)).Length == 0 ? "InstallSelected" : "ConfirmInstall"
        : request.Action == ActionKind.Activate ? "ConfirmActivate" : "ConfirmUninstall");
}
