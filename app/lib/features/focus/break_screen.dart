import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api_client.dart';
import '../../shared/models.dart';
import '../../shared/widgets.dart';
import '../auth/auth_controller.dart';
import '../dashboard/dashboard_screen.dart';
import 'platform.dart';

class _BreakKind {
  const _BreakKind(this.id, this.title, this.prompt, this.minutes, this.icon);

  final String id;
  final String title;
  final String prompt;
  final int minutes;
  final IconData icon;
}

const _kinds = [
  _BreakKind('breathing', 'Breathe', 'Breathe in as the circle grows, out as it shrinks.', 3, Icons.air),
  _BreakKind('eye_rest', 'Rest your eyes', 'Look at something 20 feet away. Blink slowly.', 1, Icons.visibility_off_outlined),
  _BreakKind('stretch', 'Stretch', 'Roll your shoulders, stretch your neck, reach up high.', 5, Icons.accessibility_new),
  _BreakKind('walk', 'Short walk', 'Step away from the screen and walk around.', 5, Icons.directions_walk),
];

class BreakScreen extends ConsumerStatefulWidget {
  const BreakScreen({super.key, this.afterSessionId});

  /// The focus session this break follows; required to earn the break reward.
  final String? afterSessionId;

  @override
  ConsumerState<BreakScreen> createState() => _BreakScreenState();
}

class _BreakScreenState extends ConsumerState<BreakScreen> {
  _BreakKind? _kind;
  String? _sessionId;
  DateTime? _startedAt;
  Timer? _ticker;
  Duration _remaining = Duration.zero;
  bool _inhale = true;
  List<Award>? _awards;

  ApiClient get _api => ref.read(apiProvider);

  @override
  void dispose() {
    _ticker?.cancel();
    super.dispose();
  }

  Future<void> _start(_BreakKind kind) async {
    try {
      final res = await _api.post('/sessions', {
        'type': 'break',
        'breakKind': kind.id,
        'plannedMin': kind.minutes,
        'platform': apiPlatform,
        if (widget.afterSessionId != null) 'afterSessionId': widget.afterSessionId,
      });
      _sessionId = (res['session'] as Json)['id'] as String;
      _startedAt = DateTime.now();
      _remaining = Duration(minutes: kind.minutes);
      _ticker = Timer.periodic(const Duration(seconds: 1), (t) {
        final left = Duration(minutes: kind.minutes) - DateTime.now().difference(_startedAt!);
        if (left <= Duration.zero) {
          _finish();
        } else {
          setState(() {
            _remaining = left;
            if (t.tick % 4 == 0) _inhale = !_inhale;
          });
        }
      });
      setState(() => _kind = kind);
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(apiErrorMessage(e))));
    }
  }

  Future<void> _finish() async {
    _ticker?.cancel();
    try {
      final res = await _api.post('/sessions/$_sessionId/complete');
      await ref.read(authProvider.notifier).refreshUser();
      ref.invalidate(dashboardProvider);
      setState(() => _awards = parseList(res['awards'], Award.fromJson));
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(apiErrorMessage(e))));
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final kind = _kind;
    final Widget body;

    if (_awards != null) {
      body = Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text('Nicely done', style: theme.textTheme.headlineSmall),
          const SizedBox(height: 16),
          AwardList(_awards!),
          const SizedBox(height: 32),
          FilledButton(onPressed: () => context.leave(), child: const Text('Back to dashboard')),
        ],
      );
    } else if (kind == null) {
      body = ListView(
        children: [
          Text('Pick a mindful break', style: theme.textTheme.titleLarge),
          const SizedBox(height: 16),
          for (final k in _kinds)
            Card(
              child: ListTile(
                leading: Icon(k.icon),
                title: Text(k.title),
                subtitle: Text('${k.minutes} min'),
                onTap: () => _start(k),
              ),
            ),
        ],
      );
    } else {
      body = Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          AnimatedContainer(
            duration: const Duration(seconds: 4),
            curve: Curves.easeInOut,
            width: _inhale ? 220 : 120,
            height: _inhale ? 220 : 120,
            decoration: BoxDecoration(shape: BoxShape.circle, color: theme.colorScheme.primaryContainer),
          ),
          const SizedBox(height: 32),
          Text(kind.prompt, textAlign: TextAlign.center, style: theme.textTheme.titleMedium),
          const SizedBox(height: 16),
          Text(formatClock(_remaining), style: theme.textTheme.headlineMedium),
          const SizedBox(height: 24),
          TextButton(onPressed: _finish, child: const Text("I'm done")),
        ],
      );
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Mindful break')),
      body: SafeArea(child: Padding(padding: const EdgeInsets.all(24), child: body)),
    );
  }
}
