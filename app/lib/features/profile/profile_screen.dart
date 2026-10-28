import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api_client.dart';
import '../../shared/models.dart';
import '../../shared/widgets.dart';
import '../auth/auth_controller.dart';
import '../dashboard/dashboard_screen.dart';
import '../social/social_screen.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  Future<void> _addFriend(BuildContext context, WidgetRef ref) async {
    final controller = TextEditingController();
    final code = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Add a friend'),
        content: TextField(
          controller: controller,
          textCapitalization: TextCapitalization.characters,
          decoration: const InputDecoration(labelText: "Friend's invite code"),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(context, controller.text.trim()), child: const Text('Add')),
        ],
      ),
    );
    controller.dispose();
    if (code == null || code.isEmpty || !context.mounted) return;
    final messenger = ScaffoldMessenger.of(context);
    try {
      final res = await ref.read(apiProvider).post('/friends', {'inviteCode': code});
      ref.invalidate(leaderboardProvider);
      messenger.showSnackBar(SnackBar(content: Text('You and ${(res['friend'] as Json)['displayName']} are now friends')));
    } catch (e) {
      messenger.showSnackBar(SnackBar(content: Text(apiErrorMessage(e))));
    }
  }

  Future<void> _setGoal(BuildContext context, WidgetRef ref, User user) async {
    var minutes = user.dailyFocusGoalMin.toDouble().clamp(30, 300);
    final chosen = await showDialog<int>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setState) => AlertDialog(
          title: const Text('Daily focus goal'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text('${minutes.round()} minutes', style: Theme.of(context).textTheme.headlineSmall),
              Slider(
                value: minutes.toDouble(),
                min: 30,
                max: 300,
                divisions: 9,
                onChanged: (v) => setState(() => minutes = v),
              ),
            ],
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
            FilledButton(onPressed: () => Navigator.pop(context, minutes.round()), child: const Text('Save')),
          ],
        ),
      ),
    );
    if (chosen == null || !context.mounted) return;
    final messenger = ScaffoldMessenger.of(context);
    try {
      final res = await ref.read(apiProvider).patch('/me', {
        'settings': {'dailyFocusGoalMin': chosen},
      });
      ref.read(authProvider.notifier).setUser(User.fromJson(res['user'] as Json));
      messenger.showSnackBar(const SnackBar(content: Text('Saved — applies from tomorrow')));
    } catch (e) {
      messenger.showSnackBar(SnackBar(content: Text(apiErrorMessage(e))));
    }
    ref.invalidate(dashboardProvider);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authProvider).valueOrNull;
    if (user == null) return const SizedBox.shrink();
    final text = Theme.of(context).textTheme;
    return Scaffold(
      appBar: AppBar(title: const Text('Profile')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Center(
            child: CircleAvatar(radius: 44, child: Text(user.avatarBase == 'fox' ? '🦊' : '🙂', style: const TextStyle(fontSize: 40))),
          ),
          const SizedBox(height: 12),
          Center(child: Text(user.displayName, style: text.headlineSmall)),
          Center(child: Text('Level ${user.level} · ${user.xp} XP', style: text.bodyMedium)),
          const SizedBox(height: 8),
          Center(child: TokenAmount(user.tokenBalance, style: text.titleLarge)),
          const SizedBox(height: 24),
          Card(
            child: Column(
              children: [
                ListTile(
                  leading: const Icon(Icons.local_fire_department_outlined),
                  title: const Text('Streak'),
                  subtitle: Text('Longest: ${user.streak.longest} days · Freezes: ${user.streak.freezes}'),
                  trailing: Text('${user.streak.current}', style: text.titleLarge),
                ),
                ListTile(
                  leading: const Icon(Icons.flag_outlined),
                  title: const Text('Daily focus goal'),
                  subtitle: Text('${user.dailyFocusGoalMin} minutes'),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => _setGoal(context, ref, user),
                ),
                ListTile(
                  leading: const Icon(Icons.qr_code_2),
                  title: const Text('Your invite code'),
                  subtitle: Text(user.inviteCode),
                  trailing: IconButton(
                    icon: const Icon(Icons.copy),
                    tooltip: 'Copy',
                    onPressed: () {
                      Clipboard.setData(ClipboardData(text: user.inviteCode));
                      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Invite code copied')));
                    },
                  ),
                ),
                ListTile(
                  leading: const Icon(Icons.person_add_alt),
                  title: const Text('Add a friend'),
                  onTap: () => _addFriend(context, ref),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          OutlinedButton.icon(
            icon: const Icon(Icons.logout),
            label: const Text('Sign out'),
            onPressed: () => ref.read(authProvider.notifier).logout(),
          ),
        ],
      ),
    );
  }
}
