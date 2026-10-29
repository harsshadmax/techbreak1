import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../core/api_client.dart';
import '../../shared/models.dart';
import '../../shared/ui.dart';
import '../auth/auth_controller.dart';

String _flagKey(String userId) => 'onboarded_$userId';

/// Whether the signed-in user has finished onboarding on this device. True when signed out.
final onboardingDoneProvider = FutureProvider<bool>((ref) async {
  final id = ref.watch(authProvider.select((a) => a.valueOrNull?.id));
  if (id == null) return true;
  try {
    return (await SharedPreferences.getInstance()).getBool(_flagKey(id)) ?? false;
  } catch (_) {
    return true;
  }
});

const _slides = [
  (FaceShape.circle, FaceMood.calm, Palette.green, 'Earn tokens for focus', 'Start a focus session and earn a token for every minute you stay off your phone.'),
  (FaceShape.blob, FaceMood.sleepy, Palette.blue, 'Take mindful breaks', 'Breathe, rest your eyes or stretch between sessions. Breaks earn bonus tokens too.'),
  (FaceShape.bolt, FaceMood.happy, Palette.yellow, 'Unlock your apps', 'Spend tokens on timed access to Instagram, YouTube and more, guilt free.'),
];

class OnboardingScreen extends ConsumerStatefulWidget {
  const OnboardingScreen({super.key});

  @override
  ConsumerState<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends ConsumerState<OnboardingScreen> {
  final _pages = PageController();
  int _page = 0;
  double _goal = 120;
  bool _saving = false;

  static const _lastPage = 3;

  @override
  void dispose() {
    _pages.dispose();
    super.dispose();
  }

  Future<void> _finish() async {
    final user = ref.read(authProvider).valueOrNull;
    if (user == null) return;
    setState(() => _saving = true);
    final minutes = _goal.round();
    final messenger = ScaffoldMessenger.of(context);
    try {
      final api = ref.read(apiProvider);
      final res = await api.patch('/me', {
        'settings': {'dailyFocusGoalMin': minutes},
      });
      await api.put('/goals/today', {'focusTargetMin': minutes});
      ref.read(authProvider.notifier).setUser(User.fromJson(res['user'] as Json));
    } catch (e) {
      messenger.showSnackBar(SnackBar(content: Text(apiErrorMessage(e))));
    }
    try {
      await (await SharedPreferences.getInstance()).setBool(_flagKey(user.id), true);
    } catch (_) {
      // Without storage the intro simply shows again next time.
    }
    ref.invalidate(onboardingDoneProvider);
  }

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final isLast = _page == _lastPage;
    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: PageView(
                controller: _pages,
                onPageChanged: (i) => setState(() => _page = i),
                children: [
                  for (final (shape, mood, color, title, body) in _slides)
                    Padding(
                      padding: const EdgeInsets.all(32),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          FaceBlob(shape: shape, mood: mood, color: color, size: 180),
                          const SizedBox(height: 28),
                          Text(title, style: text.headlineSmall, textAlign: TextAlign.center),
                          const SizedBox(height: 12),
                          Text(body, style: text.bodyLarge, textAlign: TextAlign.center),
                        ],
                      ),
                    ),
                  Padding(
                    padding: const EdgeInsets.all(32),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text('Set your daily focus goal', style: text.headlineSmall, textAlign: TextAlign.center),
                        const SizedBox(height: 24),
                        Text('${_goal.round()} minutes', style: text.displaySmall),
                        Slider(
                          value: _goal,
                          min: 10,
                          max: 300,
                          divisions: 29,
                          label: '${_goal.round()}',
                          onChanged: (v) => setState(() => _goal = v),
                        ),
                        Text('You can change this any time in your profile.', style: text.bodyMedium),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                for (var i = 0; i <= _lastPage; i++)
                  AnimatedContainer(
                    duration: const Duration(milliseconds: 200),
                    margin: const EdgeInsets.all(4),
                    width: i == _page ? 20 : 8,
                    height: 8,
                    decoration: BoxDecoration(
                      color: i == _page ? Palette.ink : const Color(0xFFCFC9E0),
                      borderRadius: BorderRadius.circular(4),
                    ),
                  ),
              ],
            ),
            Padding(
              padding: const EdgeInsets.all(24),
              child: FilledButton(
                onPressed: _saving
                    ? null
                    : isLast
                        ? _finish
                        : () => _pages.nextPage(duration: const Duration(milliseconds: 250), curve: Curves.easeOut),
                child: Text(isLast ? "Let's go" : 'Next'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
