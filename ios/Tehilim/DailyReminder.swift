import SwiftUI
import UserNotifications

/// Local notifications reminding the user to say the day's Tehilim.
/// A repeating notification can't skip days, so each day is scheduled on its own;
/// the app renews them on every launch.
enum DailyReminder {
    private static let idPrefix = "daily-tehilim"

    /// Returns false if the user hasn't allowed notifications.
    static func schedule(hour: Int, minute: Int) async -> Bool {
        let center = UNUserNotificationCenter.current()
        guard (try? await center.requestAuthorization(options: [.alert, .sound])) == true else { return false }

        let content = UNMutableNotificationContent()
        content.title = "תהילים"
        content.body = "לחץ לקריאת התהילים של היום"
        content.sound = .default

        center.removeAllPendingNotificationRequests()
        let days = ReminderSchedule.upcoming(from: .now, hour: hour, minute: minute, inIsrael: ReminderSchedule.isInIsrael)
        for day in days {
            let trigger = UNCalendarNotificationTrigger(dateMatching: day, repeats: false)
            let id = "\(idPrefix)-\(day.year ?? 0)-\(day.month ?? 0)-\(day.day ?? 0)"
            try? await center.add(UNNotificationRequest(identifier: id, content: content, trigger: trigger))
        }
        return true
    }

    static func cancel() {
        UNUserNotificationCenter.current().removeAllPendingNotificationRequests()
    }
}

/// Tapping the reminder opens the app on today's weekly reading.
final class ReminderTapHandler: NSObject, UNUserNotificationCenterDelegate {
    static let shared = ReminderTapHandler()

    /// Set by the web view once the page has loaded.
    var openToday: (() -> Void)? {
        didSet {
            if pendingOpen, let openToday {
                pendingOpen = false
                openToday()
            }
        }
    }
    private var pendingOpen = false

    func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse) async {
        if let openToday {
            openToday()
        } else {
            pendingOpen = true
        }
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification) async -> UNNotificationPresentationOptions {
        [.banner, .sound]
    }
}

struct ReminderSettingsView: View {
    @Environment(\.dismiss) private var dismiss
    @AppStorage("reminderEnabled") private var enabled = false
    @AppStorage("reminderMinutes") private var minutes = 8 * 60
    @State private var denied = false

    private var time: Binding<Date> {
        Binding(
            get: { Calendar.current.date(bySettingHour: minutes / 60, minute: minutes % 60, second: 0, of: .now) ?? .now },
            set: {
                let c = Calendar.current.dateComponents([.hour, .minute], from: $0)
                minutes = (c.hour ?? 8) * 60 + (c.minute ?? 0)
            }
        )
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Toggle("תזכורת יומית", isOn: $enabled)
                    if enabled {
                        DatePicker("שעה", selection: time, displayedComponents: .hourAndMinute)
                    }
                } footer: {
                    Text(denied
                         ? "ההודעות חסומות. אפשר להפעיל אותן בהגדרות ← תהילים ← הודעות."
                         : "נזכיר לך כל יום לקרוא תהילים, חוץ משבת ויום טוב. התזכורות מתחדשות כשפותחים את האפליקציה, אז כדאי לפתוח אותה לפחות פעם בחודש וחצי.")
                }
            }
            .navigationTitle("תזכורת")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("סיום") { dismiss() }
                }
            }
        }
        .presentationDetents([.medium])
        .onChange(of: enabled) { apply() }
        .onChange(of: minutes) { apply() }
    }

    private func apply() {
        guard enabled else {
            DailyReminder.cancel()
            return
        }
        Task {
            let allowed = await DailyReminder.schedule(hour: minutes / 60, minute: minutes % 60)
            denied = !allowed
            if !allowed { enabled = false }
        }
    }
}
