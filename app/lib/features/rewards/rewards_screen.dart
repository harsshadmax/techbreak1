import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api_client.dart';
import '../../shared/models.dart';
import '../../shared/widgets.dart';
import '../auth/auth_controller.dart';

class RewardsData {
  const RewardsData(this.rewards, this.ownedIds);

  final List<Reward> rewards;
  final Set<String> ownedIds;
}

final rewardsProvider = FutureProvider.autoDispose<RewardsData>((ref) async {
  final api = ref.watch(apiProvider);
  final results = await Future.wait([api.get('/rewards'), api.get('/inventory')]);
  final owned = ((results[1]['items'] as List?) ?? const [])
      .map((i) => ((i as Map)['rewardId'] as Map)['id'] as String)
      .toSet();
  return RewardsData(parseList(results[0]['items'], Reward.fromJson), owned);
});

class RewardsScreen extends ConsumerWidget {
  const RewardsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final balance = ref.watch(authProvider).valueOrNull?.tokenBalance ?? 0;
    final data = ref.watch(rewardsProvider);
    return DefaultTabController(
      length: 3,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Rewards hub'),
          actions: [Padding(padding: const EdgeInsets.only(right: 16), child: TokenAmount(balance))],
          bottom: const TabBar(tabs: [Tab(text: 'Avatar'), Tab(text: 'Perks'), Tab(text: 'Donate')]),
        ),
        body: data.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => ErrorRetry(message: apiErrorMessage(e), onRetry: () => ref.invalidate(rewardsProvider)),
          data: (d) => TabBarView(
            children: [
              for (final kind in ['avatar_item', 'perk', 'donation'])
                _RewardList(rewards: d.rewards.where((r) => r.kind == kind).toList(), owned: d.ownedIds, balance: balance),
            ],
          ),
        ),
      ),
    );
  }
}

class _RewardList extends ConsumerWidget {
  const _RewardList({required this.rewards, required this.owned, required this.balance});

  final List<Reward> rewards;
  final Set<String> owned;
  final int balance;

  Future<void> _redeem(BuildContext context, WidgetRef ref, Reward reward) async {
    final verb = reward.kind == 'donation' ? 'Pledge' : 'Buy';
    final ok = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('$verb ${reward.name}?'),
        content: Text('This costs ${reward.cost} tokens.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          FilledButton(style: dialogButtonStyle, onPressed: () => Navigator.pop(context, true), child: Text(verb)),
        ],
      ),
    );
    if (ok != true || !context.mounted) return;
    final messenger = ScaffoldMessenger.of(context);
    try {
      final res = await ref.read(apiProvider).post('/rewards/${reward.id}/redeem');
      ref.read(authProvider.notifier).setUser(User.fromJson(res['user'] as Json));
      ref.invalidate(rewardsProvider);
      messenger.showSnackBar(SnackBar(content: Text('${reward.name} — done!')));
    } catch (e) {
      messenger.showSnackBar(SnackBar(content: Text(apiErrorMessage(e))));
    }
  }

  Future<void> _equip(BuildContext context, WidgetRef ref, Reward reward) async {
    final messenger = ScaffoldMessenger.of(context);
    try {
      final res = await ref.read(apiProvider).put('/me/avatar', {'slot': reward.slot, 'rewardId': reward.id});
      ref.read(authProvider.notifier).setUser(User.fromJson(res['user'] as Json));
      messenger.showSnackBar(SnackBar(content: Text('Equipped ${reward.name}')));
    } catch (e) {
      messenger.showSnackBar(SnackBar(content: Text(apiErrorMessage(e))));
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final equipped = ref.watch(authProvider).valueOrNull?.equipped.values.toSet() ?? const {};
    return RefreshIndicator(
      onRefresh: () => ref.refresh(rewardsProvider.future),
      child: rewards.isEmpty
          ? ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              children: const [Padding(padding: EdgeInsets.all(32), child: Center(child: Text('Nothing here yet — run the server seed script.')))],
            )
          : _list(context, ref, equipped),
    );
  }

  Widget _list(BuildContext context, WidgetRef ref, Set<String> equipped) {
    return ListView.builder(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.all(16),
      itemCount: rewards.length,
      itemBuilder: (context, i) {
        final r = rewards[i];
        final isOwned = r.kind == 'avatar_item' && owned.contains(r.id);
        final Widget action;
        if (isOwned) {
          action = equipped.contains(r.id)
              ? const Chip(label: Text('Equipped'))
              : OutlinedButton(onPressed: () => _equip(context, ref, r), child: const Text('Equip'));
        } else {
          action = FilledButton.tonal(
            style: FilledButton.styleFrom(minimumSize: const Size(0, 40)),
            onPressed: balance >= r.cost ? () => _redeem(context, ref, r) : null,
            child: TokenAmount(r.cost),
          );
        }
        return Card(
          child: ListTile(
            title: Text(r.name),
            subtitle: Text([if (r.slot != null) r.slot!, if (r.description.isNotEmpty) r.description].join(' · ')),
            trailing: action,
          ),
        );
      },
    );
  }
}
