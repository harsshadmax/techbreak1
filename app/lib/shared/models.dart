int _int(Object? v) => (v as num?)?.toInt() ?? 0;

class Streak {
  const Streak({required this.current, required this.longest, required this.freezes});

  factory Streak.fromJson(Map<String, dynamic>? j) =>
      Streak(current: _int(j?['current']), longest: _int(j?['longest']), freezes: _int(j?['freezes']));

  final int current;
  final int longest;
  final int freezes;
}

class User {
  const User({
    required this.id,
    required this.email,
    required this.displayName,
    required this.tokenBalance,
    required this.xp,
    required this.level,
    required this.streak,
    required this.inviteCode,
    required this.dailyFocusGoalMin,
    required this.avatarBase,
    required this.equipped,
    this.timezone = 'UTC',
  });

  factory User.fromJson(Map<String, dynamic> j) {
    final settings = (j['settings'] as Map?)?.cast<String, dynamic>() ?? {};
    final avatar = (j['avatar'] as Map?)?.cast<String, dynamic>() ?? {};
    return User(
      id: j['id'] as String,
      email: j['email'] as String? ?? '',
      displayName: j['displayName'] as String? ?? '',
      tokenBalance: _int(j['tokenBalance']),
      xp: _int(j['xp']),
      level: _int(j['level']),
      streak: Streak.fromJson((j['streak'] as Map?)?.cast<String, dynamic>()),
      inviteCode: j['inviteCode'] as String? ?? '',
      dailyFocusGoalMin: _int(settings['dailyFocusGoalMin']),
      avatarBase: avatar['base'] as String? ?? 'fox',
      equipped: ((avatar['equipped'] as Map?) ?? {}).map((k, v) => MapEntry(k as String, v.toString())),
      timezone: j['timezone'] as String? ?? 'UTC',
    );
  }

  final String timezone;

  final String id;
  final String email;
  final String displayName;
  final int tokenBalance;
  final int xp;
  final int level;
  final Streak streak;
  final String inviteCode;
  final int dailyFocusGoalMin;
  final String avatarBase;

  /// slot -> rewardId
  final Map<String, String> equipped;
}

class Goal {
  const Goal({
    required this.focusTargetMin,
    required this.focusDoneMin,
    required this.achieved,
    this.screenLimitMin = 0,
    this.screenUsedMin = 0,
  });

  factory Goal.fromJson(Map<String, dynamic> j) => Goal(
        focusTargetMin: _int(j['focusTargetMin']),
        focusDoneMin: _int(j['focusDoneMin']),
        achieved: j['achieved'] == true,
        screenLimitMin: _int(j['screenLimitMin']),
        screenUsedMin: _int(j['screenUsedMin']),
      );

  final int focusTargetMin;
  final int focusDoneMin;
  final bool achieved;
  final int screenLimitMin;
  final int screenUsedMin;

  double get progress => focusTargetMin == 0 ? 0 : (focusDoneMin / focusTargetMin).clamp(0, 1).toDouble();
}

class Award {
  const Award(this.amount, this.reason);

  factory Award.fromJson(Map<String, dynamic> j) => Award(_int(j['amount']), j['reason'] as String? ?? '');

  final int amount;
  final String reason;

  String get label => switch (reason) {
        'focus_complete' => 'Focus time',
        'clean_bonus' => 'No-distraction bonus',
        'break_complete' => 'Mindful break',
        'goal_achieved' => 'Daily goal reached',
        'streak_bonus' => 'Streak bonus',
        'level_up' => 'Level up!',
        'challenge_reward' => 'Challenge complete',
        'screen_limit_kept' => 'Stayed under screen limit',
        _ => reason,
      };
}

class Reward {
  const Reward({
    required this.id,
    required this.kind,
    required this.name,
    required this.description,
    required this.cost,
    this.slot,
    this.slug = '',
  });

  factory Reward.fromJson(Map<String, dynamic> j) => Reward(
        id: j['id'] as String,
        slug: j['slug'] as String? ?? '',
        kind: j['kind'] as String,
        name: j['name'] as String,
        description: j['description'] as String? ?? '',
        cost: _int(j['cost']),
        slot: j['slot'] as String?,
      );

  final String id;
  final String slug;
  final String kind;
  final String name;
  final String description;
  final int cost;
  final String? slot;
}

class Challenge {
  const Challenge({
    required this.id,
    required this.title,
    required this.description,
    required this.target,
    required this.rewardTokens,
    required this.endsAt,
  });

  factory Challenge.fromJson(Map<String, dynamic> j) => Challenge(
        id: j['id'] as String,
        title: j['title'] as String,
        description: j['description'] as String? ?? '',
        target: _int(j['target']),
        rewardTokens: _int(j['rewardTokens']),
        endsAt: DateTime.parse(j['endsAt'] as String),
      );

  final String id;
  final String title;
  final String description;
  final int target;
  final int rewardTokens;
  final DateTime endsAt;
}

class ChallengeProgress {
  const ChallengeProgress({required this.progress, required this.completed, required this.claimed});

  factory ChallengeProgress.fromJson(Map<String, dynamic> j) => ChallengeProgress(
        progress: _int(j['progress']),
        completed: j['completed'] == true,
        claimed: j['claimedAt'] != null,
      );

  final int progress;
  final bool completed;
  final bool claimed;
}

class ChallengeEntry {
  const ChallengeEntry(this.challenge, this.progress);

  factory ChallengeEntry.fromJson(Map<String, dynamic> j) => ChallengeEntry(
        Challenge.fromJson((j['challenge'] as Map).cast<String, dynamic>()),
        j['progress'] == null ? null : ChallengeProgress.fromJson((j['progress'] as Map).cast<String, dynamic>()),
      );

  final Challenge challenge;

  /// Null when the user hasn't joined.
  final ChallengeProgress? progress;

  double get fraction =>
      challenge.target == 0 ? 0 : ((progress?.progress ?? 0) / challenge.target).clamp(0, 1).toDouble();
}

class LeaderboardEntry {
  const LeaderboardEntry({
    required this.rank,
    required this.displayName,
    required this.focusMin,
    required this.level,
    required this.isMe,
  });

  factory LeaderboardEntry.fromJson(Map<String, dynamic> j) => LeaderboardEntry(
        rank: _int(j['rank']),
        displayName: j['displayName'] as String? ?? '',
        focusMin: _int(j['focusMin']),
        level: _int(j['level']),
        isMe: j['isMe'] == true,
      );

  final int rank;
  final String displayName;
  final int focusMin;
  final int level;
  final bool isMe;
}

/// A focus or break session from `GET /sessions`.
class SessionRec {
  const SessionRec({required this.type, required this.status, required this.actualMin, required this.startedAt, required this.tokensAwarded});

  factory SessionRec.fromJson(Map<String, dynamic> j) => SessionRec(
        type: j['type'] as String? ?? 'focus',
        status: j['status'] as String? ?? '',
        actualMin: _int(j['actualMin']),
        startedAt: DateTime.parse(j['startedAt'] as String),
        tokensAwarded: _int(j['tokensAwarded']),
      );

  final String type;
  final String status;
  final int actualMin;
  final DateTime startedAt;
  final int tokensAwarded;
}

/// One row of the token ledger from `GET /tokens/transactions`.
class TokenTx {
  const TokenTx({required this.id, required this.amount, required this.reason, required this.createdAt});

  factory TokenTx.fromJson(Map<String, dynamic> j) => TokenTx(
        id: j['id'] as String? ?? j['_id'] as String,
        amount: _int(j['amount']),
        reason: j['reason'] as String? ?? '',
        createdAt: DateTime.parse(j['createdAt'] as String),
      );

  final String id;
  final int amount;
  final String reason;
  final DateTime createdAt;
}

List<T> parseList<T>(Object? raw, T Function(Map<String, dynamic>) fromJson) =>
    ((raw as List?) ?? const []).map((e) => fromJson((e as Map).cast<String, dynamic>())).toList();
