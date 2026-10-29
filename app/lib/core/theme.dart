import 'package:flutter/material.dart';

/// Soft pastel look with bold headings and a black pill navigation bar.
class AppTheme {
  static const _seed = Color(0xFF7B61FF);

  /// Card tints used across the app (apps, rewards, challenges).
  static const pastels = [
    Color(0xFFFFBB5C), // orange
    Color(0xFFFFE76A), // yellow
    Color(0xFFFF9B9B), // coral
    Color(0xFFB9A4FF), // purple
    Color(0xFFA9C8FF), // blue
    Color(0xFFB7F5A0), // green
  ];

  static ThemeData get light => _build(Brightness.light);
  static ThemeData get dark => _build(Brightness.dark);

  static ThemeData _build(Brightness brightness) {
    final isLight = brightness == Brightness.light;
    final scheme = ColorScheme.fromSeed(seedColor: _seed, brightness: brightness);
    final base = ThemeData(useMaterial3: true, colorScheme: scheme);
    const heavy = FontWeight.w800;
    return base.copyWith(
      scaffoldBackgroundColor: isLight ? const Color(0xFFF4F3F6) : scheme.surface,
      textTheme: base.textTheme.copyWith(
        displaySmall: base.textTheme.displaySmall?.copyWith(fontWeight: heavy),
        headlineMedium: base.textTheme.headlineMedium?.copyWith(fontWeight: heavy),
        headlineSmall: base.textTheme.headlineSmall?.copyWith(fontWeight: heavy),
        titleLarge: base.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700),
        titleMedium: base.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: Colors.transparent,
        scrolledUnderElevation: 0,
        titleTextStyle: base.textTheme.titleLarge?.copyWith(fontWeight: heavy, color: scheme.onSurface),
      ),
      cardTheme: CardThemeData(
        elevation: 0,
        color: isLight ? Colors.white : scheme.surfaceContainerLow,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size.fromHeight(52),
          backgroundColor: isLight ? const Color(0xFF111111) : scheme.primary,
          foregroundColor: isLight ? Colors.white : scheme.onPrimary,
          shape: const StadiumBorder(),
          textStyle: const TextStyle(fontWeight: FontWeight.w700),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(style: OutlinedButton.styleFrom(shape: const StadiumBorder())),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: isLight ? const Color(0xFF111111) : null,
        indicatorColor: isLight ? Colors.white : null,
        height: 68,
        iconTheme: WidgetStateProperty.resolveWith(
          (states) => IconThemeData(
            color: !isLight ? null : (states.contains(WidgetState.selected) ? const Color(0xFF111111) : Colors.white),
          ),
        ),
        labelTextStyle: WidgetStateProperty.resolveWith(
          (states) => TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w700,
            color: isLight ? Colors.white : null,
          ),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(16)),
      ),
    );
  }
}
