import '../../shared/models.dart';

class DayMinutes {
  const DayMinutes(this.day, this.minutes);

  final DateTime day;
  final int minutes;
}

/// Completed focus minutes per local calendar day.
Map<DateTime, int> minutesByDay(Iterable<SessionRec> sessions) {
  final totals = <DateTime, int>{};
  for (final s in sessions) {
    if (s.type != 'focus' || s.status != 'completed') continue;
    final local = s.startedAt.toLocal();
    final day = DateTime(local.year, local.month, local.day);
    totals[day] = (totals[day] ?? 0) + s.actualMin;
  }
  return totals;
}

/// Completed focus minutes per local calendar day for the last [days] days, oldest first and ending today.
List<DayMinutes> focusMinutesByDay(Iterable<SessionRec> sessions, DateTime now, {int days = 7}) {
  final totals = minutesByDay(sessions);
  return [
    for (var i = days - 1; i >= 0; i--)
      DayMinutes(DateTime(now.year, now.month, now.day - i), totals[DateTime(now.year, now.month, now.day - i)] ?? 0),
  ];
}

/// How a calendar day went against the daily goal.
enum DayMood { future, none, some, goal }

class CalendarCell {
  const CalendarCell(this.day, this.minutes, this.mood);

  final DateTime day;
  final int minutes;
  final DayMood mood;
}

/// The month containing [anchor] as a Sunday-first grid: nulls pad the first week, then one cell per day.
List<CalendarCell?> monthCells(DateTime anchor, Iterable<SessionRec> sessions, DateTime now, {required int goalMin}) {
  final totals = minutesByDay(sessions);
  final first = DateTime(anchor.year, anchor.month);
  final daysInMonth = DateTime(anchor.year, anchor.month + 1, 0).day;
  final today = DateTime(now.year, now.month, now.day);
  return [
    for (var i = 0; i < first.weekday % 7; i++) null,
    for (var d = 1; d <= daysInMonth; d++)
      () {
        final day = DateTime(anchor.year, anchor.month, d);
        final minutes = totals[day] ?? 0;
        final mood = day.isAfter(today)
            ? DayMood.future
            : minutes >= goalMin && goalMin > 0
                ? DayMood.goal
                : minutes > 0
                    ? DayMood.some
                    : DayMood.none;
        return CalendarCell(day, minutes, mood);
      }(),
  ];
}
