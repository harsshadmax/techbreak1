import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api_client.dart';
import '../../shared/models.dart';
import '../../shared/widgets.dart';
import '../auth/auth_controller.dart';

final challengesProvider = FutureProvider.autoDispose<List<ChallengeEntry>>((ref) async {
  final res = await ref.watch(apiProvider).get('/challenges');
  return parseList(res['items'], ChallengeEntry.fromJson);
});

final leaderboardProvider = FutureProvider.autoDispose.family<List<LeaderboardEntry>, String>((ref, scope) async {
  final res = await ref.watch(apiProvider).get('/leaderboard', query: {'scope': scope});
  return parseList(res['entries'], LeaderboardEntry.fromJson);
});

class SocialScreen extends StatelessWidget {
  const SocialScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 3,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Challenges & leaderboard'),
          bottom: const TabBar(tabs: [Tab(text: 'Challenges'), Tab(text: 'Friends'), Tab(text: 'Global')]),
        ),
        body: const TabBarView(
          children: [_ChallengesTab(), _LeaderboardTab(scope: 'friends'), _LeaderboardTab(scope: 'global')],
        ),
      ),
    );
  }
}

class _ChallengesTab extends ConsumerWidget {
  const _ChallengesTab();

  Future<void> _act(BuildContext context, WidgetRef ref, String path, String done) async {
    final messenger = ScaffoldMessenger.of(context);
    try {
      await ref.read(apiProvider).post(path);
      ref.invalidate(challengesProvider);
      await ref.read(authProvider.notifier).refreshUser();
      messenger.showSnackBar(SnackBar(content: Text(done)));
    } catch (e) {
      messenger.showSnackBar(SnackBar(content: Text(apiErrorMessage(e))));
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ref.watch(challengesProvider).when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => ErrorRetry(message: apiErrorMessage(e), onRetry: () => ref.invalidate(challengesProvider)),
          data: (items) {
            return RefreshIndicator(
              onRefresh: () => ref.refresh(challengesProvider.future),
              child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(16),
              children: [
                if (items.isEmpty) const Padding(padding: EdgeInsets.all(32), child: Center(child: Text('No active challenges this week.'))),
                for (final c in items)
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Expanded(child: Text(c.challenge.title, style: Theme.of(context).textTheme.titleMedium)),
                              TokenAmount(c.challenge.rewardTokens),
                            ],
                          ),
                          const SizedBox(height: 4),
                          Text(c.challenge.description),
                          const SizedBox(height: 12),
                          if (c.progress == null)
                            OutlinedButton(
                              onPressed: () => _act(context, ref, '/challenges/${c.challenge.id}/join', 'Joined!'),
                              child: const Text('Join'),
                            )
                          else ...[
                            LinearProgressIndicator(value: c.fraction),
                            const SizedBox(height: 6),
                            Text('${c.progress!.progress} / ${c.challenge.target}'),
                            if (c.progress!.completed && !c.progress!.claimed)
                              Padding(
                                padding: const EdgeInsets.only(top: 8),
                                child: FilledButton(
                                  onPressed: () => _act(context, ref, '/challenges/${c.challenge.id}/claim', 'Reward claimed!'),
                                  child: const Text('Claim reward'),
                                ),
                              ),
                            if (c.progress!.claimed) const Text('Reward claimed ✓'),
                          ],
                        ],
                      ),
                    ),
                  ),
              ],
            ),
            );
          },
        );
  }
}

class _LeaderboardTab extends ConsumerWidget {
  const _LeaderboardTab({required this.scope});

  final String scope;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    return ref.watch(leaderboardProvider(scope)).when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => ErrorRetry(message: apiErrorMessage(e), onRetry: () => ref.invalidate(leaderboardProvider(scope))),
          data: (entries) {
            return RefreshIndicator(
              onRefresh: () => ref.refresh(leaderboardProvider(scope).future),
              child: ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                children: [
                  if (entries.isEmpty)
                    Padding(
                      padding: const EdgeInsets.all(32),
                      child: Center(
                        child: Text(scope == 'friends' ? 'Add friends from your profile to compete.' : 'No focus logged this week yet.'),
                      ),
                    ),
                  for (final e in entries)
                    ListTile(
                      tileColor: e.isMe ? theme.colorScheme.primaryContainer.withValues(alpha: 0.4) : null,
                      leading: CircleAvatar(child: Text('${e.rank}')),
                      title: Text(e.isMe ? '${e.displayName} (you)' : e.displayName),
                      subtitle: Text('Level ${e.level}'),
                      trailing: Text('${e.focusMin} min', style: theme.textTheme.titleMedium),
                    ),
                ],
              ),
            );
          },
        );
  }
}
