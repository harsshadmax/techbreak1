import 'package:flutter_test/flutter_test.dart';
import 'package:techbreak/shared/models.dart';

void main() {
  test('User parses the API shape', () {
    final user = User.fromJson({
      'id': 'u1',
      'email': 'a@b.test',
      'displayName': 'Ana',
      'tokenBalance': 65,
      'xp': 65,
      'level': 1,
      'streak': {'current': 1, 'longest': 1, 'freezes': 0, 'lastActiveDate': '2026-10-28'},
      'settings': {'dailyFocusGoalMin': 120},
      'inviteCode': 'ABCD1234',
      'avatar': {
        'base': 'fox',
        'equipped': {'hat': 'r1'},
      },
    });
    expect(user.tokenBalance, 65);
    expect(user.streak.current, 1);
    expect(user.equipped['hat'], 'r1');
  });

  test('Goal progress is clamped', () {
    expect(Goal.fromJson({'focusTargetMin': 60, 'focusDoneMin': 90, 'achieved': true}).progress, 1.0);
    expect(Goal.fromJson({'focusTargetMin': 120, 'focusDoneMin': 30}).progress, 0.25);
  });

  test('Award labels', () {
    expect(Award.fromJson({'amount': 5, 'reason': 'clean_bonus'}).label, 'No-distraction bonus');
  });
}
