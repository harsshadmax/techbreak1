import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../shared/ui.dart';

/// Playful, high-contrast look: lavender ground, white cards, pastel tiles, bold black type and black pill actions.
class AppTheme {
  /// Card tints used across the app (apps, rewards, challenges).
  static const pastels = [Palette.orange, Palette.yellow, Palette.coral, Palette.purple, Palette.blue, Palette.green];

  static ThemeData get light => _build();

  static ThemeData _build() {
    final scheme = ColorScheme.fromSeed(
      seedColor: const Color(0xFF8B6CFF),
      brightness: Brightness.light,
    ).copyWith(
      primary: Palette.ink,
      onPrimary: Colors.white,
      surface: Palette.lavender,
      onSurface: Palette.ink,
      primaryContainer: Palette.purple,
      onPrimaryContainer: Palette.ink,
      surfaceContainerLow: Palette.paper,
      tertiary: const Color(0xFFE08A00),
    );
    final base = ThemeData(useMaterial3: true, colorScheme: scheme);
    final plain = base.textTheme.apply(bodyColor: Palette.ink, displayColor: Palette.ink);
    TextStyle? sans(TextStyle? s) => s == null ? null : GoogleFonts.dmSans(textStyle: s);
    final body = plain.copyWith(
      bodyLarge: sans(plain.bodyLarge),
      bodyMedium: sans(plain.bodyMedium),
      bodySmall: sans(plain.bodySmall),
      labelLarge: sans(plain.labelLarge),
      labelMedium: sans(plain.labelMedium),
      labelSmall: sans(plain.labelSmall),
      titleSmall: sans(plain.titleSmall),
    );
    TextStyle? display(TextStyle? s, FontWeight w) => s == null ? null : GoogleFonts.bricolageGrotesque(textStyle: s, fontWeight: w);
    final textTheme = body.copyWith(
      displayMedium: display(body.displayMedium, FontWeight.w800),
      displaySmall: display(body.displaySmall, FontWeight.w800),
      headlineLarge: display(body.headlineLarge, FontWeight.w800),
      headlineMedium: display(body.headlineMedium, FontWeight.w800),
      headlineSmall: display(body.headlineSmall, FontWeight.w800),
      titleLarge: display(body.titleLarge, FontWeight.w700),
      titleMedium: display(body.titleMedium, FontWeight.w700),
    );
    return base.copyWith(
      scaffoldBackgroundColor: Palette.lavender,
      textTheme: textTheme,
      appBarTheme: AppBarTheme(
        backgroundColor: Colors.transparent,
        surfaceTintColor: Colors.transparent,
        scrolledUnderElevation: 0,
        titleTextStyle: textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800, fontSize: 24),
      ),
      cardTheme: CardThemeData(
        elevation: 0,
        margin: EdgeInsets.zero,
        color: Palette.paper,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(26)),
      ),
      listTileTheme: const ListTileThemeData(iconColor: Palette.ink),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size.fromHeight(54),
          backgroundColor: Palette.ink,
          foregroundColor: Colors.white,
          shape: const StadiumBorder(),
          textStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: Palette.ink,
          side: const BorderSide(color: Palette.ink, width: 1.5),
          shape: const StadiumBorder(),
          textStyle: const TextStyle(fontWeight: FontWeight.w700),
        ),
      ),
      textButtonTheme: TextButtonThemeData(style: TextButton.styleFrom(foregroundColor: Palette.ink, textStyle: const TextStyle(fontWeight: FontWeight.w700))),
      segmentedButtonTheme: SegmentedButtonThemeData(
        style: SegmentedButton.styleFrom(
          backgroundColor: Palette.paper,
          selectedBackgroundColor: Palette.ink,
          selectedForegroundColor: Colors.white,
          foregroundColor: Palette.ink,
        ),
      ),
      tabBarTheme: const TabBarThemeData(
        labelColor: Palette.ink,
        indicatorColor: Palette.ink,
        dividerColor: Colors.transparent,
        unselectedLabelColor: Color(0xFF6B6778),
      ),
      sliderTheme: const SliderThemeData(activeTrackColor: Palette.ink, thumbColor: Palette.ink, inactiveTrackColor: Color(0xFFCFC9E0)),
      progressIndicatorTheme: const ProgressIndicatorThemeData(color: Palette.ink, linearTrackColor: Color(0xFFD9D3EA), circularTrackColor: Color(0xFFD9D3EA)),
      bottomSheetTheme: const BottomSheetThemeData(
        backgroundColor: Palette.paper,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(32))),
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: Palette.paper,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(28)),
      ),
      snackBarTheme: SnackBarThemeData(
        backgroundColor: Palette.ink,
        contentTextStyle: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: Palette.paper,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(18), borderSide: BorderSide.none),
        focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(18), borderSide: const BorderSide(color: Palette.ink, width: 1.5)),
      ),
    );
  }
}
