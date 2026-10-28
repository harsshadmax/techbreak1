import '../../shared/models.dart';

class DayMinutes {
  const DayMinutes(this.day, this.minutes);

  final DateTime day;
  final int minutes;
}

/// Completed focus minutes per local calendar day for the last [days] days, oldest first and ending today.
List<DayMinutes> focusMinutesByDay(Iterable<SessionRec> sessions, DateTime now, {int days = 7}) {
  final today = DateTime(now.year, now.month, now.day);
  final totals = <DateTime, int>{};
  for (final s in sessions) {
    if (s.type != 'focus' || s.status != 'completed') continue;
    final local = s.startedAt.toLocal();
    final day = DateTime(local.year, local.month, local.day);
    totals[day] = (totals[day] ?? 0) + s.actualMin;
  }
  return [
    for (var i = days - 1; i >= 0; i--)
      DayMinutes(DateTime(today.year, today.month, today.day - i), totals[DateTime(today.year, today.month, today.day - i)] ?? 0),
  ];
}
