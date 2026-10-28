import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'models.dart';

extension LeaveScreen on BuildContext {
  /// Go back, or to the dashboard when this screen was opened directly (e.g. a deep link or page reload).
  void leave() => canPop() ? pop() : go('/');
}

/// The app theme makes filled buttons full-width; dialogs and list rows need them shrink-wrapped.
final dialogButtonStyle = FilledButton.styleFrom(minimumSize: const Size(0, 40));

/// Token amount with the coin icon used everywhere in the app.
class TokenAmount extends StatelessWidget {
  const TokenAmount(this.amount, {super.key, this.style});

  final int amount;
  final TextStyle? style;

  @override
  Widget build(BuildContext context) {
    final color = Theme.of(context).colorScheme.tertiary;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(Icons.toll, color: color, size: (style?.fontSize ?? 16) * 1.1),
        const SizedBox(width: 4),
        // A short scale/fade whenever the total changes, so a reward feels earned.
        AnimatedSwitcher(
          duration: const Duration(milliseconds: 350),
          transitionBuilder: (child, animation) =>
              FadeTransition(opacity: animation, child: ScaleTransition(scale: Tween(begin: 0.6, end: 1.0).animate(animation), child: child)),
          child: Text('$amount', key: ValueKey(amount), style: style),
        ),
      ],
    );
  }
}

/// Breakdown of tokens earned, shown after completing a session.
class AwardList extends StatelessWidget {
  const AwardList(this.awards, {super.key});

  final List<Award> awards;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    if (awards.isEmpty) {
      return Text(
        'No tokens this time — sessions need at least 10 minutes and few interruptions.',
        textAlign: TextAlign.center,
        style: theme.textTheme.bodyMedium,
      );
    }
    final total = awards.fold<int>(0, (n, a) => n + a.amount);
    return Column(
      children: [
        TokenAmount(total, style: theme.textTheme.displaySmall),
        const SizedBox(height: 12),
        for (final a in awards)
          ListTile(dense: true, title: Text(a.label), trailing: Text('+${a.amount}', style: theme.textTheme.titleMedium)),
      ],
    );
  }
}

/// Loading / error wrapper for AsyncValue-driven screens.
class ErrorRetry extends StatelessWidget {
  const ErrorRetry({super.key, required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(message),
          const SizedBox(height: 8),
          OutlinedButton(onPressed: onRetry, child: const Text('Try again')),
        ],
      ),
    );
  }
}
