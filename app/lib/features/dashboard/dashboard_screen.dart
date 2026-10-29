import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api_client.dart';
import '../../shared/avatar_view.dart';
import '../../shared/models.dart';
import '../../shared/ui.dart';
import '../../shared/widgets.dart';
import '../auth/auth_controller.dart';

class DashboardData {
  const DashboardData(this.user, this.goal, this.challenges);

  final User user;
  final Goal goal;
  final List<ChallengeEntry> challenges;
}

final dashboardProvider = FutureProvider.autoDispose<DashboardData>((ref) async {
  final res = await ref.watch(apiProvider).get('/me/dashboard');
  final user = User.fromJson(res['user'] as Json);
  // Keep the global user (balance, streak) in sync with what the dashboard shows.
  ref.read(authProvider.notifier).setUser(user);
  return DashboardData(user, Goal.fromJson(res['goal'] as Json), parseList(res['challenges'], ChallengeEntry.fromJson));
});

class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final data = ref.watch(dashboardProvider);
    return Scaffold(
      body: SafeArea(
        child: data.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => ErrorRetry(message: apiErrorMessage(e), onRetry: () => ref.invalidate(dashboardProvider)),
          data: (d) {
            // The shared auth user is kept current by redeems and claims; the dashboard snapshot can be stale.
            final user = ref.watch(authProvider).valueOrNull ?? d.user;
            return RefreshIndicator(
              onRefresh: () => ref.refresh(dashboardProvider.future),
              child: ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                children: [
                  _Header(user: user),
                  const SizedBox(height: 20),
                  _Greeting(user: user),
                  const SizedBox(height: 16),
                  _FocusChips(onPick: (m) async {
                    await context.push('/focus?min=$m');
                    ref.invalidate(dashboardProvider);
                  }),
                  const SizedBox(height: 16),
                  _Bento(user: user, goal: d.goal),
                  const SizedBox(height: 12),
                  _QuizTile(onYes: () => context.push('/break'), onNo: () => context.push('/focus')),
                  const SizedBox(height: 12),
                  _GoalCard(goal: d.goal),
                  if (d.challenges.isNotEmpty) ...[
                    const SizedBox(height: 24),
                    Text('Your challenges', style: Theme.of(context).textTheme.titleLarge),
                    const SizedBox(height: 8),
                    for (final c in d.challenges)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: Card(
                          child: ListTile(
                            contentPadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 6),
                            title: Text(c.challenge.title, style: const TextStyle(fontWeight: FontWeight.w700)),
                            subtitle: Padding(
                              padding: const EdgeInsets.only(top: 8),
                              child: ClipRRect(borderRadius: BorderRadius.circular(99), child: LinearProgressIndicator(value: c.fraction, minHeight: 8)),
                            ),
                            trailing: TokenAmount(c.challenge.rewardTokens),
                          ),
                        ),
                      ),
                  ],
                ],
              ),
            );
          },
        ),
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.user});

  final User user;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return Row(
      children: [
        AvatarView(user: user, radius: 22),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Welcome back', style: text.bodySmall),
              Text(user.displayName, style: text.titleMedium),
            ],
          ),
        ),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          decoration: BoxDecoration(color: Palette.paper, borderRadius: BorderRadius.circular(999)),
          child: TokenAmount(user.tokenBalance, style: text.titleMedium),
        ),
      ],
    );
  }
}

class _Greeting extends StatelessWidget {
  const _Greeting({required this.user});

  final User user;

  @override
  Widget build(BuildContext context) {
    final first = user.displayName.trim().split(' ').first;
    return Text(
      'Hello $first! How long do you want to focus today?',
      style: Theme.of(context).textTheme.displaySmall?.copyWith(height: 1.05, fontSize: 32),
    );
  }
}

class _FocusChips extends StatelessWidget {
  const _FocusChips({required this.onPick});

  final void Function(int minutes) onPick;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: [
          FaceChip(label: '25 min', face: const FaceBlob(mood: FaceMood.happy, color: Palette.green, size: 34), onTap: () => onPick(25)),
          const SizedBox(width: 8),
          FaceChip(
            label: '45 min',
            face: const FaceBlob(shape: FaceShape.squircle, mood: FaceMood.wink, color: Palette.orange, size: 34),
            onTap: () => onPick(45),
          ),
          const SizedBox(width: 8),
          FaceChip(
            label: '60 min',
            face: const FaceBlob(shape: FaceShape.blob, mood: FaceMood.sleepy, color: Palette.blue, size: 34),
            onTap: () => onPick(60),
          ),
        ],
      ),
    );
  }
}

class _Bento extends ConsumerWidget {
  const _Bento({required this.user, required this.goal});

  final User user;
  final Goal goal;

  Future<void> _log(BuildContext context, WidgetRef ref) async {
    final controller = TextEditingController(text: goal.screenUsedMin > 0 ? '${goal.screenUsedMin}' : '');
    final minutes = await showDialog<int>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text("Today's screen time"),
        content: TextField(
          controller: controller,
          autofocus: true,
          keyboardType: TextInputType.number,
          inputFormatters: [FilteringTextInputFormatter.digitsOnly],
          decoration: const InputDecoration(labelText: 'Total minutes so far'),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
          FilledButton(
            style: dialogButtonStyle,
            onPressed: () => Navigator.pop(context, int.tryParse(controller.text.trim())),
            child: const Text('Save'),
          ),
        ],
      ),
    );
    if (minutes == null || !context.mounted) return;
    final messenger = ScaffoldMessenger.of(context);
    try {
      await ref.read(apiProvider).post('/goals/today/screen-time', {'minutes': minutes});
      ref.invalidate(dashboardProvider);
    } catch (e) {
      messenger.showSnackBar(SnackBar(content: Text(apiErrorMessage(e))));
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final text = Theme.of(context).textTheme;
    final over = goal.screenUsedMin > goal.screenLimitMin;
    final used = goal.screenLimitMin == 0 ? 0.0 : (goal.screenUsedMin / goal.screenLimitMin).clamp(0.0, 1.0);
    final streakBars = user.streak.current.clamp(1, 7);
    // Fixed height keeps the two tiles level without IntrinsicHeight, which can't measure every child.
    return SizedBox(
      height: 236,
      child: Row(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Expanded(
          child: BentoTile(
            color: Palette.orange,
            icon: Icons.phone_iphone,
            title: 'Screen time',
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                RichText(
                  text: TextSpan(
                    style: text.displaySmall?.copyWith(fontSize: 34),
                    children: [
                      TextSpan(text: '${goal.screenUsedMin ~/ 60}'),
                      TextSpan(text: 'h ', style: text.titleMedium),
                      TextSpan(text: '${goal.screenUsedMin % 60}'),
                      TextSpan(text: 'min', style: text.titleMedium),
                    ],
                  ),
                ),
                const SizedBox(height: 10),
                ClipRRect(
                  borderRadius: BorderRadius.circular(99),
                  child: LinearProgressIndicator(value: used, minHeight: 8, backgroundColor: Colors.white54),
                ),
                const SizedBox(height: 6),
                Text(over ? 'Over your ${goal.screenLimitMin} min limit' : 'Limit ${goal.screenLimitMin} min', style: text.bodySmall),
                const SizedBox(height: 10),
                OutlinedButton(
                  style: OutlinedButton.styleFrom(minimumSize: const Size(0, 38), padding: const EdgeInsets.symmetric(horizontal: 16)),
                  onPressed: () => _log(context, ref),
                  child: const Text('Log'),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: BentoTile(
            color: Palette.purple,
            icon: Icons.local_fire_department_outlined,
            title: 'Streak',
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SizedBox(
                  height: 70,
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      for (var i = 0; i < 7; i++) ...[
                        Expanded(
                          child: Container(
                            height: 14.0 + i * 8,
                            decoration: BoxDecoration(
                              color: i < streakBars ? Palette.ink : Colors.white54,
                              borderRadius: BorderRadius.circular(99),
                            ),
                          ),
                        ),
                        if (i < 6) const SizedBox(width: 4),
                      ],
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                Text('${user.streak.current} ${user.streak.current == 1 ? 'day' : 'days'}', style: text.headlineSmall),
                Text('Level ${user.level} · ${user.streak.freezes} freezes', style: text.bodySmall),
              ],
            ),
          ),
        ),
      ],
      ),
    );
  }
}

class _QuizTile extends StatelessWidget {
  const _QuizTile({required this.onYes, required this.onNo});

  final VoidCallback onYes;
  final VoidCallback onNo;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return BentoTile(
      color: Palette.green,
      icon: Icons.extension_outlined,
      title: 'Yes or No quiz',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Have you taken a mindful break since your last session?', style: text.titleLarge?.copyWith(height: 1.15)),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(child: FilledButton(style: dialogButtonStyle, onPressed: onYes, child: const Text('Yes, break time'))),
              const SizedBox(width: 10),
              Expanded(child: FilledButton(style: dialogButtonStyle, onPressed: onNo, child: const Text('No, focus'))),
            ],
          ),
        ],
      ),
    );
  }
}

class _GoalCard extends StatelessWidget {
  const _GoalCard({required this.goal});

  final Goal goal;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Row(
          children: [
            SizedBox.square(
              dimension: 80,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  CircularProgressIndicator(value: goal.progress, strokeWidth: 9, strokeCap: StrokeCap.round),
                  Center(child: Text('${(goal.progress * 100).round()}%', style: text.titleMedium)),
                ],
              ),
            ),
            const SizedBox(width: 20),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(goal.achieved ? 'Daily goal reached' : 'Daily focus goal', style: text.titleLarge),
                  const SizedBox(height: 4),
                  Text('${goal.focusDoneMin} of ${goal.focusTargetMin} minutes', style: text.bodyMedium),
                ],
              ),
            ),
            FaceBlob(mood: goal.achieved ? FaceMood.happy : FaceMood.calm, color: goal.achieved ? Palette.green : Palette.purple, size: 52),
          ],
        ),
      ),
    );
  }
}
