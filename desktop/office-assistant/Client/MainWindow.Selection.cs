using System.Windows;
using System.Windows.Automation;
using System.Windows.Controls;
using System.Windows.Media;

namespace ChinaTech.OfficeAssistant;

public sealed partial class MainWindow
{
    private static JobRecord ConfirmationRecord(JobRequest request) => new()
    {
        Schema = 2, Id = request.Id, Action = request.Action, Language = request.Language,
        Server = request.Server, ExpectedFingerprint = request.ExpectedFingerprint,
        SelectedComponents = request.SelectedComponents?.ToArray(), RemovalMode = request.RemovalMode,
        RemovalTargets = request.RemovalTargets?.ToArray()
    };

    private Window DetailWindow(string title) => ApplyFluentTheme(new Window
    {
        Owner = this, Title = title, Width = Math.Min(720, SystemParameters.WorkArea.Width),
        Height = Math.Min(620, SystemParameters.WorkArea.Height), WindowStartupLocation = WindowStartupLocation.CenterOwner,
        Background = Brushes.White, Foreground = Ink, FontFamily = FontFamily, FontSize = 14, ShowInTaskbar = false
    });

    private void ShowDetails(bool task)
    {
        if (_dialogOpen) return;
        _otherMenu.IsOpen = false;
        _dialogOpen = true;
        ApplyState();
        var dialog = DetailWindow(T(task ? "TaskDetails" : "DetectedDetails"));
        var root = new DockPanel { Margin = new Thickness(24) };
        var close = DialogButton(T("CloseWindow"), true);
        close.IsCancel = true; close.HorizontalAlignment = HorizontalAlignment.Right;
        close.Click += (_, _) => dialog.Close();
        DockPanel.SetDock(close, Dock.Bottom); root.Children.Add(close);
        var contents = new StackPanel();
        AddText(contents, dialog.Title, size: 23);
        if (_notice.Text.Length > 0) AddText(contents, _notice.Text, ErrorColor);
        var sections = task ? new[] { _task } : new[] { _facts, _warnings };
        foreach (var section in sections) contents.Children.Add(section);
        root.Children.Add(new ScrollViewer { Content = contents, VerticalScrollBarVisibility = ScrollBarVisibility.Auto,
            HorizontalScrollBarVisibility = ScrollBarVisibility.Disabled, Margin = new Thickness(0, 0, 0, 16) });
        dialog.Content = root;
        try { dialog.ShowDialog(); }
        finally
        {
            foreach (var section in sections) contents.Children.Remove(section);
            _dialogOpen = false; ApplyState();
        }
    }

    private string RemovalName(string id, Inventory? inventory)
    {
        var option = inventory == null ? null : OfficeSelection.GetRemovalOptions(inventory).FirstOrDefault(o => o.Id == id);
        if (id.StartsWith("c2r-app:", StringComparison.Ordinal)) return Text.Component(id.Split(':')[2], _locale);
        if (id == "c2r-product:" + OfficeSelection.Suite) return T("OfficeSuiteName");
        if (id == "c2r-product:" + OfficeSelection.Skype) return Text.Component("Lync", _locale);
        if (option?.RawKind == "onedrive-user") return T("OneDriveUserScope");
        if (option?.RawKind == "onedrive-machine") return T("OneDriveMachineScope");
        return option?.DisplayName ?? id;
    }

    private string RemovalRetained(SelectionPlan plan, JobRequest request)
    {
        var targets = request.RemovalTargets ?? [];
        var keep = OfficeSelection.GetRemovalOptions(plan.Baseline).Where(o => !targets.Contains(o.Id))
            .Where(o => !o.Id.StartsWith("c2r-app:", StringComparison.Ordinal) || !plan.RemoveProducts.Contains(OfficeSelection.Suite))
            .Where(o => o.Id != "c2r-product:" + OfficeSelection.Suite || !targets.Any(t => t.StartsWith("c2r-app:", StringComparison.Ordinal)))
            .Where(o => !o.Id.StartsWith("c2r-product:", StringComparison.Ordinal) || !plan.RemoveProducts.Contains(o.Id[12..]))
            .Select(o => RemovalName(o.Id, plan.Baseline)).Distinct().ToList();
        keep.Add(T("LocalDocuments"));
        return string.Join("\n", keep.Select(name => "• " + name));
    }

    private bool ShowRemovalSelection(Inventory baseline) => BuildRemovalSelection(baseline).ShowDialog() == true;

    private Window BuildRemovalSelection(Inventory baseline)
    {
        _otherMenu.IsOpen = false;
        _removalMode = RemovalMode.Selected;
        _removalTargets.Clear();
        var options = OfficeSelection.GetRemovalOptions(baseline);
        var dialog = DetailWindow(T("AppManagement"));
        var root = new Grid { Margin = new Thickness(24) };
        foreach (var height in new[] { GridLength.Auto, GridLength.Auto, new GridLength(1, GridUnitType.Star), GridLength.Auto, GridLength.Auto })
            root.RowDefinitions.Add(new RowDefinition { Height = height });
        var heading = new StackPanel(); AddText(heading, T("AppManagement"), size: 23);
        AddText(heading, T("DetectedOnly"), Muted); root.Children.Add(heading);
        var modes = new StackPanel { Orientation = Orientation.Horizontal, Margin = new Thickness(0, 8, 0, 12) };
        var selected = new RadioButton { Content = T("RemoveSelected"), IsChecked = true, MinHeight = 44, VerticalContentAlignment = VerticalAlignment.Center, Margin = new Thickness(0, 0, 24, 0) };
        var all = new RadioButton { Content = T("RemoveAllOffice"), MinHeight = 44, VerticalContentAlignment = VerticalAlignment.Center };
        AutomationProperties.SetAutomationId(selected, "RemoveSelectedMode"); AutomationProperties.SetAutomationId(all, "RemoveAllMode");
        modes.Children.Add(selected); modes.Children.Add(all); Grid.SetRow(modes, 1); root.Children.Add(modes);
        var list = new StackPanel(); var scroll = new ScrollViewer { Content = list, VerticalScrollBarVisibility = ScrollBarVisibility.Auto,
            HorizontalScrollBarVisibility = ScrollBarVisibility.Disabled }; Grid.SetRow(scroll, 2); root.Children.Add(scroll);
        var summary = new TextBlock { TextWrapping = TextWrapping.Wrap, Margin = new Thickness(0, 12, 0, 12), Foreground = Muted };
        Grid.SetRow(summary, 3); root.Children.Add(summary);
        var actions = new StackPanel { Orientation = Orientation.Horizontal, HorizontalAlignment = HorizontalAlignment.Right };
        var back = DialogButton(T("Back"), false); back.IsCancel = true; back.Click += (_, _) => dialog.DialogResult = false;
        var next = DialogButton(T("ReviewRemoval"), true); AutomationProperties.SetAutomationId(next, "ReviewRemoval");
        next.Click += (_, _) => { if (next.IsEnabled) dialog.DialogResult = true; };
        actions.Children.Add(back); actions.Children.Add(next); Grid.SetRow(actions, 4); root.Children.Add(actions);
        void UpdateSummary()
        {
            var unsafeOffice = _removalMode == RemovalMode.All && options.Any(o => o.RawKind is "c2r" or "msi" && !o.Supported);
            next.IsEnabled = _removalTargets.Count > 0 && !unsafeOffice;
            summary.Text = unsafeOffice ? T("UnsafeAllRemoval") : T("RemovalCount", _removalTargets.Count) + "\n" + T("AllRemovalPreservesOneDrive");
            summary.Foreground = unsafeOffice ? ErrorColor : Muted;
        }
        void Rebuild()
        {
            _removalMode = all.IsChecked == true ? RemovalMode.All : RemovalMode.Selected;
            _removalTargets.Clear(); list.Children.Clear();
            var perApp = options.Any(o => o.RawKind == "component" && o.Supported);
            var visible = options.Where(o => _removalMode == RemovalMode.All ? o.RawKind is "c2r" or "msi"
                : !(perApp && o.Id == "c2r-product:" + OfficeSelection.Suite));
            foreach (var option in visible)
            {
                var content = new StackPanel(); AddText(content, RemovalName(option.Id, baseline));
                if (option.RawKind == "msi") AddText(content, T("WholeMsiProduct"), Muted, 12);
                if (!option.Supported) AddText(content, T(option.ReasonCode), ErrorColor, 12);
                var check = new CheckBox { Content = content, IsEnabled = option.Supported && _removalMode == RemovalMode.Selected,
                    IsChecked = _removalMode == RemovalMode.All && option.Supported, MinHeight = 44, VerticalContentAlignment = VerticalAlignment.Center, Margin = new Thickness(0, 2, 0, 2) };
                AutomationProperties.SetName(check, RemovalName(option.Id, baseline));
                AutomationProperties.SetAutomationId(check, "RemoveTarget" + option.Id);
                if (check.IsChecked == true) _removalTargets.Add(option.Id);
                check.Checked += (_, _) => { _removalTargets.Add(option.Id); UpdateSummary(); };
                check.Unchecked += (_, _) => { _removalTargets.Remove(option.Id); UpdateSummary(); };
                list.Children.Add(check);
            }
            UpdateSummary();
        }
        selected.Checked += (_, _) => Rebuild(); all.Checked += (_, _) => Rebuild();
        Rebuild(); dialog.Content = root;
        return dialog;
    }
}
