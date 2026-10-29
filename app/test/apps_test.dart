import 'package:flutter_test/flutter_test.dart';
import 'package:techbreak/features/apps/apps_screen.dart';
import 'package:techbreak/shared/models.dart';

void main() {
  final now = DateTime.utc(2026, 10, 30, 12);

  UnlockApp app(DateTime? until) =>
      UnlockApp(id: 'instagram', name: 'Instagram', category: 'social', cost: 30, minutes: 15, unlockedUntil: until);

  test('remaining is null when locked or expired', () {
    expect(app(null).remaining(now), isNull);
    expect(app(now.subtract(const Duration(seconds: 1))).remaining(now), isNull);
    expect(app(now).remaining(now), isNull);
  });

  test('remaining counts down while unlocked', () {
    expect(app(now.add(const Duration(minutes: 14, seconds: 32))).remaining(now), const Duration(minutes: 14, seconds: 32));
  });

  test('formatLeft shows minutes and zero-padded seconds', () {
    expect(formatLeft(const Duration(minutes: 14, seconds: 32)), '14:32');
    expect(formatLeft(const Duration(minutes: 9, seconds: 5)), '9:05');
  });

  test('UnlockApp parses the API shape', () {
    final a = UnlockApp.fromJson({
      'id': 'netflix',
      'name': 'Netflix',
      'category': 'streaming',
      'cost': 60,
      'minutes': 30,
      'unlockedUntil': '2026-10-30T12:30:00.000Z',
    });
    expect(a.cost, 60);
    expect(a.unlockedUntil, DateTime.utc(2026, 10, 30, 12, 30));
    expect(appIcon('netflix'), isNotNull);
  });
}
