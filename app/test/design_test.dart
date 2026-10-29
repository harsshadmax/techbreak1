import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:techbreak/features/insights/insights_logic.dart';
import 'package:techbreak/shared/models.dart';
import 'package:techbreak/shared/ui.dart';

SessionRec _focus(DateTime at, int minutes) =>
    SessionRec(type: 'focus', status: 'completed', actualMin: minutes, startedAt: at, tokensAwarded: 0);

void main() {
  testWidgets('every face shape and mood paints without error', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Wrap(
          children: [
            for (final shape in FaceShape.values)
              for (final mood in FaceMood.values) FaceBlob(shape: shape, mood: mood, size: 40),
          ],
        ),
      ),
    );
    expect(find.byType(FaceBlob), findsNWidgets(FaceShape.values.length * FaceMood.values.length));
  });

  testWidgets('FaceChip reports taps', (tester) async {
    var taps = 0;
    await tester.pumpWidget(MaterialApp(home: Scaffold(body: FaceChip(label: '25 min', face: const FaceBlob(), onTap: () => taps++))));
    await tester.tap(find.text('25 min'));
    expect(taps, 1);
  });

  group('monthCells', () {
    final now = DateTime(2026, 10, 29, 12);

    test('pads to Sunday and has one cell per day', () {
      final cells = monthCells(now, const [], now, goalMin: 20);
      // 1 Oct 2026 is a Thursday, so four blanks come first.
      expect(cells.take(4).every((c) => c == null), isTrue);
      expect(cells.whereType<CalendarCell>(), hasLength(31));
      expect(cells[4]!.day, DateTime(2026, 10, 1));
    });

    test('marks goal days, some-focus days, empty days and the future', () {
      final cells = monthCells(
        now,
        [_focus(DateTime(2026, 10, 27, 9), 25), _focus(DateTime(2026, 10, 28, 9), 10)],
        now,
        goalMin: 20,
      ).whereType<CalendarCell>().toList();
      DayMood moodOn(int day) => cells[day - 1].mood;
      expect(moodOn(27), DayMood.goal);
      expect(moodOn(28), DayMood.some);
      expect(moodOn(26), DayMood.none);
      expect(moodOn(30), DayMood.future);
    });
  });
}
