using System.Windows;
using System.Windows.Media;

namespace ChinaTech.OfficeAssistant;

public sealed partial class MainWindow
{
    // The theme ships with the pinned WPF runtime. No external UI package or
    // experimental ThemeMode API is needed, and all task windows share it.
    private static Window ApplyFluentTheme(Window window)
    {
        AppContext.SetSwitch("Switch.System.Windows.Appearance.DisableFluentThemeWindowBackdrop", true);
        window.Resources.MergedDictionaries.Add(new ResourceDictionary
        {
            Source = new Uri("pack://application:,,,/PresentationFramework.Fluent;component/Themes/Fluent.Light.xaml")
        });
        if (!SystemParameters.HighContrast)
        {
            foreach (var key in new[] { "AccentFillColorDefaultBrush", "AccentFillColorSecondaryBrush", "AccentFillColorTertiaryBrush",
                "AccentTextFillColorPrimaryBrush", "AccentTextFillColorSecondaryBrush", "AccentFillColorSelectedTextBackgroundBrush" })
                window.Resources[key] = Purple;
        }
        return window;
    }
}
