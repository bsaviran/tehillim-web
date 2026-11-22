import SwiftUI
import UserNotifications

@main
struct TehilimApp: App {
    init() {
        UNUserNotificationCenter.current().delegate = ReminderTapHandler.shared
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environment(\.layoutDirection, .rightToLeft)
        }
    }
}

struct ContentView: View {
    @State private var showReminder = false
    @AppStorage("reminderEnabled") private var reminderEnabled = false
    @AppStorage("reminderMinutes") private var reminderMinutes = 8 * 60
    /// Mirrors the page's light/dark toggle (reported by the web view), so the status bar and
    /// the area around the page match it.
    @AppStorage("lightTheme") private var lightTheme = false

    var body: some View {
        WebView(
            onReminderTap: { showReminder = true },
            onThemeChange: { lightTheme = $0 }
        )
        .background(Color.pageBackground(light: lightTheme).ignoresSafeArea())
        .preferredColorScheme(lightTheme ? .light : .dark)
        .sheet(isPresented: $showReminder) {
            ReminderSettingsView()
        }
        .task {
            // Reminders are scheduled day by day; renew them on every launch.
            if reminderEnabled {
                _ = await DailyReminder.schedule(hour: reminderMinutes / 60, minute: reminderMinutes % 60)
            }
        }
    }
}

extension Color {
    /// --bg in style.css: #05101f (dark), #eef0f3 (light)
    static func pageBackground(light: Bool) -> Color {
        light
            ? Color(red: 238 / 255, green: 240 / 255, blue: 243 / 255)
            : Color(red: 5 / 255, green: 16 / 255, blue: 31 / 255)
    }
}
