import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../features/auth/auth_controller.dart';
import '../features/auth/login_screen.dart';
import '../features/dashboard/dashboard_screen.dart';
import '../features/focus/break_screen.dart';
import '../features/focus/focus_screen.dart';
import '../features/insights/insights_screen.dart';
import '../features/onboarding/onboarding_screen.dart';
import '../features/profile/profile_screen.dart';
import '../features/rewards/rewards_screen.dart';
import '../features/social/social_screen.dart';
import '../shared/home_shell.dart';

final routerProvider = Provider<GoRouter>((ref) {
  // Re-run redirects whenever sign-in state changes, without rebuilding the router.
  final authChanges = ValueNotifier<int>(0);
  ref.listen(authProvider, (prev, next) => authChanges.value++);
  ref.listen(onboardingDoneProvider, (prev, next) => authChanges.value++);
  ref.onDispose(authChanges.dispose);

  return GoRouter(
    initialLocation: '/',
    refreshListenable: authChanges,
    redirect: (context, state) {
      final auth = ref.read(authProvider);
      final location = state.matchedLocation;
      if (!auth.hasValue && auth.isLoading) return location == '/splash' ? null : '/splash';
      final signedIn = auth.valueOrNull != null;
      if (!signedIn) return location == '/login' ? null : '/login';
      final onboarded = ref.read(onboardingDoneProvider).valueOrNull ?? true;
      if (!onboarded) return location == '/onboarding' ? null : '/onboarding';
      if (location == '/login' || location == '/splash' || location == '/onboarding') return '/';
      return null;
    },
    routes: [
      GoRoute(
        path: '/splash',
        builder: (context, state) => const Scaffold(body: Center(child: CircularProgressIndicator())),
      ),
      GoRoute(path: '/login', builder: (context, state) => const LoginScreen()),
      GoRoute(path: '/onboarding', builder: (context, state) => const OnboardingScreen()),
      GoRoute(path: '/insights', builder: (context, state) => const InsightsScreen()),
      GoRoute(path: '/focus', builder: (context, state) => const FocusScreen()),
      GoRoute(
        path: '/break',
        builder: (context, state) => BreakScreen(afterSessionId: state.uri.queryParameters['after']),
      ),
      StatefulShellRoute.indexedStack(
        builder: (context, state, shell) => HomeShell(shell: shell),
        branches: [
          StatefulShellBranch(routes: [GoRoute(path: '/', builder: (context, state) => const DashboardScreen())]),
          StatefulShellBranch(routes: [GoRoute(path: '/rewards', builder: (context, state) => const RewardsScreen())]),
          StatefulShellBranch(routes: [GoRoute(path: '/social', builder: (context, state) => const SocialScreen())]),
          StatefulShellBranch(routes: [GoRoute(path: '/profile', builder: (context, state) => const ProfileScreen())]),
        ],
      ),
    ],
  );
});
