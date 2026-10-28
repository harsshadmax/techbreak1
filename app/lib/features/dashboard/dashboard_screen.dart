import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api_client.dart';
import '../../shared/avatar_view.dart';
import '../../shared/models.dart';
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
      appBar: AppBar(
        title: const Text('Today'),
        actions: [
          if (ref.watch(authProvider).valueOrNull case final user?)
            Padding(padding: const EdgeInsets.only(right: 12), child: AvatarView(user: user, radius: 16)),
        ],
      ),
      body: data.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => ErrorRetry(message: apiErrorMessage(e), onRetry: () => ref.invalidate(dashboardProvider)),
        data: (d) => RefreshIndicator(
          onRefresh: () => ref.refresh(dashboardProvider.future),
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              _SummaryRow(user: d.user),
              const SizedBox(height: 16),
              _GoalCard(goal: d.goal),
              const SizedBox(height: 16),
              FilledButton.icon(
                icon: const Icon(Icons.play_arrow_rounded),
                label: const Text('Start focus session'),
                onPressed: () async {
                  await context.push('/focus');
                  ref.invalidate(dashboardProvider);
                },
              ),
              const SizedBox(height: 16),
              _ScreenTimeCard(goal: d.goal),
              if (d.challenges.isNotEmpty) ...[
                const SizedBox(height: 24),
                Text('Your challenges', style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 8),
                for (final c in d.challenges)
                  Card(
                    child: ListTile(
                      title: Text(c.challenge.title),
                      subtitle: Padding(
                        padding: const EdgeInsets.only(top: 8),
                        child: LinearProgressIndicator(value: c.fraction),
                      ),
                      trailing: TokenAmount(c.challenge.rewardTokens),
                    ),
                  ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _ScreenTimeCard extends ConsumerWidget {
  const _ScreenTimeCard({required this.goal});

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
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Screen time today', style: text.titleMedium),
                  const SizedBox(height: 4),
                  Text('${goal.screenUsedMin} of ${goal.screenLimitMin} minutes${over ? ' — over your limit' : ''}', style: text.bodyMedium),
                  const SizedBox(height: 4),
                  Text('Stay under your limit for +20 tokens, paid tomorrow.', style: text.bodySmall),
                ],
              ),
            ),
            OutlinedButton(
              style: OutlinedButton.styleFrom(minimumSize: const Size(0, 40)),
              onPressed: () => _log(context, ref),
              child: const Text('Log'),
            ),
          ],
        ),
      ),
    );
  }
}

class _SummaryRow extends StatelessWidget {
  const _SummaryRow({required this.user});

  final User user;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    Widget tile(String label, Widget value) => Expanded(
          child: Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [Text(label, style: text.labelMedium), const SizedBox(height: 6), value],
              ),
            ),
          ),
        );
    return Row(
      children: [
        tile('Tokens', TokenAmount(user.tokenBalance, style: text.headlineSmall)),
        tile('Streak', Text('🔥 ${user.streak.current} days', style: text.headlineSmall)),
        tile('Level', Text('${user.level}', style: text.headlineSmall)),
      ],
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
              dimension: 88,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  CircularProgressIndicator(value: goal.progress, strokeWidth: 8),
                  Center(child: Text('${(goal.progress * 100).round()}%', style: text.titleMedium)),
                ],
              ),
            ),
            const SizedBox(width: 20),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(goal.achieved ? 'Daily goal reached 🎉' : 'Daily focus goal', style: text.titleMedium),
                  const SizedBox(height: 4),
                  Text('${goal.focusDoneMin} of ${goal.focusTargetMin} minutes', style: text.bodyMedium),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
