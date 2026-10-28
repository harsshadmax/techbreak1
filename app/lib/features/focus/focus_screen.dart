import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api_client.dart';
import '../../shared/models.dart';
import '../../shared/widgets.dart';
import '../auth/auth_controller.dart';
import '../dashboard/dashboard_screen.dart';
import 'platform.dart';

enum _Phase { choosing, running, finished }

/// Timer-based focus session. Leaving the app while it runs is reported to the
/// server as an interruption, which reduces the reward.
class FocusScreen extends ConsumerStatefulWidget {
  const FocusScreen({super.key});

  @override
  ConsumerState<FocusScreen> createState() => _FocusScreenState();
}

class _FocusScreenState extends ConsumerState<FocusScreen> with WidgetsBindingObserver {
  static const _presets = [25, 45, 60];

  _Phase _phase = _Phase.choosing;
  int _plannedMin = 25;
  String? _sessionId;
  DateTime? _startedAt;
  Timer? _ticker;
  Duration _remaining = Duration.zero;
  int _interruptions = 0;
  bool _away = false;
  bool _busy = false;
  List<Award> _awards = const [];

  ApiClient get _api => ref.read(apiProvider);

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _ticker?.cancel();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (_phase != _Phase.running || _sessionId == null) return;
    final leaving = state == AppLifecycleState.paused || state == AppLifecycleState.hidden;
    if (leaving && !_away) {
      _away = true;
      setState(() => _interruptions++);
      _api.dio.patch('/sessions/$_sessionId/interrupt').ignore();
    } else if (state == AppLifecycleState.resumed) {
      _away = false;
    }
  }

  Future<void> _start() async {
    setState(() => _busy = true);
    try {
      final res = await _api.post('/sessions', {'type': 'focus', 'plannedMin': _plannedMin, 'platform': apiPlatform});
      final session = res['session'] as Json;
      _sessionId = session['id'] as String;
      _startedAt = DateTime.now();
      _remaining = Duration(minutes: _plannedMin);
      _ticker = Timer.periodic(const Duration(seconds: 1), (_) => _tick());
      setState(() => _phase = _Phase.running);
    } catch (e) {
      _snack(apiErrorMessage(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _tick() {
    final left = Duration(minutes: _plannedMin) - DateTime.now().difference(_startedAt!);
    if (left <= Duration.zero) {
      _complete();
    } else {
      setState(() => _remaining = left);
    }
  }

  Future<void> _complete() async {
    _ticker?.cancel();
    setState(() => _busy = true);
    try {
      final res = await _api.post('/sessions/$_sessionId/complete');
      _awards = parseList(res['awards'], Award.fromJson);
      await ref.read(authProvider.notifier).refreshUser();
      ref.invalidate(dashboardProvider);
      setState(() => _phase = _Phase.finished);
    } catch (e) {
      _snack(apiErrorMessage(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _abandon() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Give up this session?'),
        content: const Text("You won't earn tokens for it."),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Keep going')),
          TextButton(onPressed: () => Navigator.pop(context, true), child: const Text('Give up')),
        ],
      ),
    );
    if (ok != true) return;
    _ticker?.cancel();
    try {
      await _api.post('/sessions/$_sessionId/abandon');
    } catch (_) {
      // The server also abandons stale sessions when the next one starts.
    }
    if (mounted) context.leave();
  }

  void _snack(String message) {
    if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return PopScope(
      canPop: _phase != _Phase.running,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _abandon();
      },
      child: Scaffold(
        appBar: AppBar(title: const Text('Focus mode')),
        body: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: switch (_phase) {
              _Phase.choosing => Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text('How long do you want to focus?', style: text.titleLarge),
                    const SizedBox(height: 24),
                    SegmentedButton<int>(
                      segments: [for (final m in _presets) ButtonSegment(value: m, label: Text('$m min'))],
                      selected: {_plannedMin},
                      onSelectionChanged: (s) => setState(() => _plannedMin = s.first),
                    ),
                    const SizedBox(height: 16),
                    Text('Earn 1 token per minute, +20% if you stay in the app.', style: text.bodyMedium),
                    const SizedBox(height: 32),
                    FilledButton(onPressed: _busy ? null : _start, child: const Text('Start')),
                  ],
                ),
              _Phase.running => Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(formatClock(_remaining), style: text.displayLarge),
                    const SizedBox(height: 12),
                    Text(
                      _interruptions == 0 ? 'Distraction-free so far' : '$_interruptions interruption(s)',
                      style: text.bodyLarge,
                    ),
                    const SizedBox(height: 48),
                    FilledButton.tonal(
                      onPressed: _busy ? null : _complete,
                      child: const Text('Finish early'),
                    ),
                    TextButton(onPressed: _busy ? null : _abandon, child: const Text('Give up')),
                  ],
                ),
              _Phase.finished => Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text('Session complete', style: text.headlineSmall),
                    const SizedBox(height: 16),
                    AwardList(_awards),
                    const SizedBox(height: 32),
                    FilledButton.icon(
                      icon: const Icon(Icons.self_improvement),
                      label: const Text('Take a mindful break (+5)'),
                      onPressed: () => context.pushReplacement('/break?after=$_sessionId'),
                    ),
                    TextButton(onPressed: () => context.leave(), child: const Text('Back to dashboard')),
                  ],
                ),
            },
          ),
        ),
      ),
    );
  }
}
