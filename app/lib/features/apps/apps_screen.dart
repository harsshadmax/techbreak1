import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api_client.dart';
import '../../core/theme.dart';
import '../../shared/models.dart';
import '../../shared/ui.dart';
import '../../shared/widgets.dart';
import '../auth/auth_controller.dart';

class AppsData {
  const AppsData(this.items, this.clockOffset);

  final List<UnlockApp> items;

  /// Server time minus device time, so countdowns stay right when the device clock is off.
  final Duration clockOffset;
}

final appsProvider = FutureProvider.autoDispose<AppsData>((ref) async {
  final res = await ref.watch(apiProvider).get('/apps');
  final serverNow = DateTime.tryParse(res['now'] as String? ?? '');
  return AppsData(
    parseList(res['items'], UnlockApp.fromJson),
    serverNow == null ? Duration.zero : serverNow.difference(DateTime.now()),
  );
});

const _icons = <String, IconData>{
  'instagram': Icons.photo_camera_outlined,
  'snapchat': Icons.chat_bubble_outline,
  'tiktok': Icons.music_note,
  'youtube': Icons.play_circle_outline,
  'netflix': Icons.movie_outlined,
  'spotify': Icons.graphic_eq,
};

IconData appIcon(String id) => _icons[id] ?? Icons.apps;

/// "14:32" for a countdown.
String formatLeft(Duration d) {
  final m = d.inMinutes;
  final s = d.inSeconds % 60;
  return '$m:${s.toString().padLeft(2, '0')}';
}

class AppsScreen extends ConsumerStatefulWidget {
  const AppsScreen({super.key});

  @override
  ConsumerState<AppsScreen> createState() => _AppsScreenState();
}

class _AppsScreenState extends ConsumerState<AppsScreen> {
  Timer? _ticker;

  @override
  void initState() {
    super.initState();
    _ticker = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _ticker?.cancel();
    super.dispose();
  }

  Future<void> _openSheet(UnlockApp app, Duration? left, AppsData data) async {
    final balance = ref.read(authProvider).valueOrNull?.tokenBalance ?? 0;
    final action = await showModalBottomSheet<String>(
      context: context,
      showDragHandle: true,
      builder: (context) => _UnlockSheet(app: app, left: left, balance: balance),
    );
    if (action == null || !mounted) return;
    if (action == 'earn') {
      context.push('/focus');
      return;
    }
    final messenger = ScaffoldMessenger.of(context);
    try {
      final res = await ref.read(apiProvider).post('/apps/${app.id}/unlock');
      ref.read(authProvider.notifier).setUser(User.fromJson(res['user'] as Json));
      ref.invalidate(appsProvider);
      messenger.showSnackBar(SnackBar(content: Text('${app.name} unlocked for ${app.minutes} min')));
    } catch (e) {
      messenger.showSnackBar(SnackBar(content: Text(apiErrorMessage(e))));
    }
  }

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final balance = ref.watch(authProvider).valueOrNull?.tokenBalance ?? 0;
    final data = ref.watch(appsProvider);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Unlock your apps'),
        actions: [Padding(padding: const EdgeInsets.only(right: 16), child: TokenAmount(balance))],
      ),
      body: data.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => ErrorRetry(message: apiErrorMessage(e), onRetry: () => ref.invalidate(appsProvider)),
        data: (d) {
          final now = DateTime.now().add(d.clockOffset);
          return RefreshIndicator(
            onRefresh: () => ref.refresh(appsProvider.future),
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(16),
              children: [
                Text('Spend tokens for guilt-free time.', style: text.bodyMedium),
                const SizedBox(height: 16),
                GridView.extent(
                  maxCrossAxisExtent: 220,
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  mainAxisSpacing: 12,
                  crossAxisSpacing: 12,
                  childAspectRatio: 0.95,
                  children: [
                    for (var i = 0; i < d.items.length; i++)
                      _AppCard(
                        app: d.items[i],
                        tint: AppTheme.pastels[i % AppTheme.pastels.length],
                        left: d.items[i].remaining(now),
                        onTap: () => _openSheet(d.items[i], d.items[i].remaining(now), d),
                      ),
                  ],
                ),
                const SizedBox(height: 12),
                Text(
                  'TechBreak tracks the time you unlock. It does not block other apps on your device.',
                  style: text.bodySmall,
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _AppCard extends StatelessWidget {
  const _AppCard({required this.app, required this.tint, required this.left, required this.onTap});

  final UnlockApp app;
  final Color tint;
  final Duration? left;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final open = left != null;
    final label = open ? '${app.name} unlocked, ${left!.inMinutes} minutes left' : 'Unlock ${app.name} for ${app.cost} tokens';
    return Semantics(
      button: true,
      label: label,
      child: Material(
        color: tint,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(24),
          side: open ? const BorderSide(width: 3, color: Color(0xFF111111)) : BorderSide.none,
        ),
        child: InkWell(
          borderRadius: BorderRadius.circular(24),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Stack(
                      alignment: Alignment.center,
                      children: [
                        FaceBlob(
                          shape: FaceShape.values[app.id.codeUnits.fold<int>(0, (n, c) => n + c) % FaceShape.values.length],
                          mood: open ? FaceMood.happy : FaceMood.sleepy,
                          color: Colors.white.withValues(alpha: 0.7),
                          size: 52,
                        ),
                      ],
                    ),
                    Icon(open ? Icons.lock_open : Icons.lock_outline, size: 20, color: const Color(0xFF111111)),
                  ],
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      app.name,
                      style: text.titleLarge?.copyWith(fontWeight: FontWeight.w800, color: const Color(0xFF111111)),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      open ? 'Unlocked · ${formatLeft(left!)} left' : '${app.minutes} min · ${app.cost} tokens',
                      style: text.bodySmall?.copyWith(color: const Color(0xFF111111)),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _UnlockSheet extends StatelessWidget {
  const _UnlockSheet({required this.app, required this.left, required this.balance});

  final UnlockApp app;
  final Duration? left;
  final int balance;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final String title;
    final String body;
    final String cta;
    final String result;
    if (left != null) {
      title = '${app.name} is open';
      body = '${left!.inMinutes} minutes left. It locks again by itself when the time is up.';
      cta = 'Got it';
      result = 'close';
    } else if (balance >= app.cost) {
      title = 'Unlock ${app.name}?';
      body = '${app.minutes} minutes of access for ${app.cost} tokens. You will have ${balance - app.cost} tokens left.';
      cta = 'Unlock for ${app.cost}';
      result = 'unlock';
    } else {
      title = 'Not enough tokens';
      body = '${app.name} costs ${app.cost} tokens and you have $balance. A focus session earns more.';
      cta = 'Earn tokens';
      result = 'earn';
    }
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(24, 0, 24, 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: text.headlineSmall),
            const SizedBox(height: 8),
            Text(body, style: text.bodyLarge),
            const SizedBox(height: 20),
            Row(
              children: [
                Expanded(child: OutlinedButton(onPressed: () => Navigator.pop(context), child: const Text('Not now'))),
                const SizedBox(width: 12),
                Expanded(flex: 2, child: FilledButton(onPressed: () => Navigator.pop(context, result), child: Text(cta))),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
