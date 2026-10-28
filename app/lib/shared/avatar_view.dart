import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../features/rewards/rewards_screen.dart';
import 'models.dart';

/// How one avatar item looks. Reward slug -> visual lives in this single table.
class AvatarVisual {
  const AvatarVisual({this.emoji, this.color});

  final String? emoji;
  final Color? color;
}

const avatarVisuals = <String, AvatarVisual>{
  'hat-beanie': AvatarVisual(emoji: '🧢'),
  'hat-headphones': AvatarVisual(emoji: '🎧'),
  'hat-crown': AvatarVisual(emoji: '👑'),
  'outfit-hoodie': AvatarVisual(emoji: '🧥'),
  'outfit-yoga': AvatarVisual(emoji: '🧘'),
  'bg-forest': AvatarVisual(color: Color(0xFF2E7D32)),
  'bg-ocean': AvatarVisual(color: Color(0xFF0277BD)),
};

/// Equipped items by slot, resolved from reward ids (as the API stores them) via the catalog's id -> slug map.
Map<String, AvatarVisual> equippedVisuals(Map<String, String> equippedIds, Map<String, String> slugById) => {
      for (final e in equippedIds.entries)
        if (avatarVisuals[slugById[e.value]] case final visual?) e.key: visual,
    };

String avatarBaseEmoji(String base) => base == 'fox' ? '🦊' : '🙂';

class AvatarView extends ConsumerWidget {
  const AvatarView({super.key, required this.user, this.radius = 44});

  final User user;
  final double radius;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final catalog = ref.watch(rewardsProvider).valueOrNull;
    final visuals = catalog == null
        ? const <String, AvatarVisual>{}
        : equippedVisuals(user.equipped, {for (final r in catalog.rewards) r.id: r.slug});
    final size = radius * 2;
    return SizedBox.square(
      dimension: size + radius * 0.6,
      child: Stack(
        alignment: Alignment.center,
        clipBehavior: Clip.none,
        children: [
          CircleAvatar(
            radius: radius,
            backgroundColor: visuals['background']?.color ?? Theme.of(context).colorScheme.primaryContainer,
            child: Text(avatarBaseEmoji(user.avatarBase), style: TextStyle(fontSize: radius * 0.9)),
          ),
          if (visuals['outfit']?.emoji case final outfit?)
            Positioned(bottom: 0, right: 0, child: Text(outfit, style: TextStyle(fontSize: radius * 0.6))),
          if (visuals['hat']?.emoji case final hat?)
            Positioned(top: 0, child: Text(hat, style: TextStyle(fontSize: radius * 0.7))),
        ],
      ),
    );
  }
}
