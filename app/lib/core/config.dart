class AppConfig {
  /// Override with `--dart-define=API_BASE_URL=...`.
  /// Android emulator: use http://10.0.2.2:4000/api/v1 to reach the host machine.
  static const apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://localhost:4000/api/v1',
  );
}
