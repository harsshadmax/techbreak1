import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:techbreak/features/auth/login_screen.dart';
import 'package:techbreak/features/insights/insights_logic.dart';
import 'package:techbreak/shared/avatar_view.dart';
import 'package:techbreak/shared/models.dart';
import 'package:techbreak/shared/widgets.dart';

SessionRec _session(DateTime startedAt, int minutes, {String type = 'focus', String status = 'completed'}) =>
    SessionRec(type: type, status: status, actualMin: minutes, startedAt: startedAt, tokensAwarded: 0);

void main() {
  testWidgets('login form validates email and password', (tester) async {
    await tester.pumpWidget(const ProviderScope(child: MaterialApp(home: LoginScreen())));
    await tester.tap(find.widgetWithText(FilledButton, 'Sign in'));
    await tester.pump();
    expect(find.text('Enter a valid email'), findsOneWidget);
    expect(find.text('At least 8 characters'), findsOneWidget);
  });

  testWidgets('AwardList shows the total and each line', (tester) async {
    const awards = [Award(25, 'focus_complete'), Award(5, 'clean_bonus'), Award(30, 'goal_achieved'), Award(5, 'streak_bonus')];
    await tester.pumpWidget(const MaterialApp(home: Scaffold(body: SingleChildScrollView(child: AwardList(awards)))));
    await tester.pumpAndSettle();
    expect(find.text('65'), findsOneWidget);
    expect(find.text('Focus time'), findsOneWidget);
    expect(find.text('+30'), findsOneWidget);
  });

  test('focusMinutesByDay groups completed focus sessions by local day', () {
    final now = DateTime(2026, 10, 29, 15);
    final days = focusMinutesByDay([
      _session(DateTime(2026, 10, 29, 9), 25),
      _session(DateTime(2026, 10, 29, 11), 20),
      _session(DateTime(2026, 10, 27, 9), 45),
      _session(DateTime(2026, 10, 28, 9), 30, status: 'abandoned'),
      _session(DateTime(2026, 10, 28, 10), 5, type: 'break'),
      _session(DateTime(2026, 10, 1, 9), 60),
    ], now);
    expect(days, hasLength(7));
    expect(days.last.day, DateTime(2026, 10, 29));
    expect(days.last.minutes, 45);
    expect(days[4].minutes, 45); // 27 Oct
    expect(days[5].minutes, 0); // abandoned and break sessions don't count
    expect(days.first.day, DateTime(2026, 10, 23));
    expect(days.fold<int>(0, (n, d) => n + d.minutes), 90);
  });

  test('avatar mapping resolves reward ids to visuals via slugs', () {
    final visuals = equippedVisuals(
      {'hat': 'id-beanie', 'background': 'id-forest', 'outfit': 'id-unknown'},
      {'id-beanie': 'hat-beanie', 'id-forest': 'bg-forest'},
    );
    expect(visuals['hat']?.emoji, '🧢');
    expect(visuals['background']?.color, isNotNull);
    expect(visuals.containsKey('outfit'), isFalse);
    expect(avatarBaseEmoji('fox'), '🦊');
  });
}
