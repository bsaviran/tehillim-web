import Foundation

/// Works out which days get a reminder, skipping Shabbat and Yom Tov.
enum ReminderSchedule {
    /// iOS keeps at most 64 pending notifications per app.
    static let maxReminders = 60

    /// From this hour on, a reminder on Erev Shabbat or Erev Yom Tov could fall after candle lighting,
    /// so it's skipped. 14:00 is safely before the earliest winter sunsets.
    static let latestErevHour = 14

    static var isInIsrael: Bool {
        ["Asia/Jerusalem", "Asia/Tel_Aviv"].contains(TimeZone.current.identifier)
    }

    /// The upcoming days and times to remind on, as Gregorian date components in the current time zone.
    static func upcoming(from now: Date, hour: Int, minute: Int, inIsrael: Bool) -> [DateComponents] {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = .current
        let today = calendar.startOfDay(for: now)

        var result: [DateComponents] = []
        var offset = 0
        while result.count < maxReminders && offset < 120 {
            defer { offset += 1 }
            guard let day = calendar.date(byAdding: .day, value: offset, to: today),
                  let next = calendar.date(byAdding: .day, value: 1, to: day),
                  let fireDate = calendar.date(bySettingHour: hour, minute: minute, second: 0, of: day),
                  fireDate > now else { continue }
            if isRestDay(day, inIsrael: inIsrael) { continue }
            if hour >= latestErevHour && isRestDay(next, inIsrael: inIsrael) { continue }
            result.append(calendar.dateComponents([.year, .month, .day, .hour, .minute], from: fireDate))
        }
        return result
    }

    static func isRestDay(_ date: Date, inIsrael: Bool) -> Bool {
        var gregorian = Calendar(identifier: .gregorian)
        gregorian.timeZone = .current
        if gregorian.component(.weekday, from: date) == 7 { return true }

        var hebrew = Calendar(identifier: .hebrew)
        hebrew.timeZone = .current
        let c = hebrew.dateComponents([.month, .day], from: date)
        guard let month = c.month, let day = c.day else { return false }

        // Foundation numbers Hebrew months from Tishrei=1, with Nisan=8 and Sivan=10 in every year.
        switch month {
        case 1: return [1, 2, 10, 15, 22].contains(day) || (!inIsrael && [16, 23].contains(day))
        case 8: return [15, 21].contains(day) || (!inIsrael && [16, 22].contains(day))
        case 10: return day == 6 || (!inIsrael && day == 7)
        default: return false
        }
    }
}
