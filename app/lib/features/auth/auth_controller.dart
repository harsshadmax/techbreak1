import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api_client.dart';
import '../../core/timezone.dart';
import '../../shared/models.dart';

/// The signed-in user, or null when signed out.
final authProvider = AsyncNotifierProvider<AuthController, User?>(AuthController.new);

class AuthController extends AsyncNotifier<User?> {
  ApiClient get _api => ref.read(apiProvider);

  @override
  Future<User?> build() async {
    _api.onSessionExpired = () => state = const AsyncData(null);
    await _api.tokens.load();
    if (_api.tokens.accessToken == null) return null;
    try {
      final user = User.fromJson((await _api.get('/me'))['user'] as Json);
      return await _syncTimezone(user);
    } catch (_) {
      return null;
    }
  }

  /// Streaks and daily goals roll over at local midnight, so keep the server's zone in step with the device.
  Future<User> _syncTimezone(User user) async {
    final zone = await deviceTimezone();
    if (zone == null || zone == user.timezone) return user;
    try {
      return User.fromJson((await _api.patch('/me', {'timezone': zone}))['user'] as Json);
    } catch (_) {
      return user;
    }
  }

  /// Throws on failure so the login screen can show the message.
  Future<void> login(String email, String password) =>
      _authenticate('/auth/login', {'email': email, 'password': password});

  Future<void> register(String email, String password, String displayName) async => _authenticate('/auth/register', {
        'email': email,
        'password': password,
        'displayName': displayName,
        if (await deviceTimezone() case final zone?) 'timezone': zone,
      });

  Future<void> _authenticate(String path, Json body) async {
    final res = await _api.post(path, body);
    await _api.tokens.save(res['accessToken'] as String, res['refreshToken'] as String);
    state = AsyncData(await _syncTimezone(User.fromJson(res['user'] as Json)));
  }

  /// Re-fetch the user after anything that changes balance, streak or avatar.
  Future<void> refreshUser() async {
    final res = await _api.get('/me');
    state = AsyncData(User.fromJson(res['user'] as Json));
  }

  void setUser(User user) => state = AsyncData(user);

  Future<void> logout() async {
    final refresh = _api.tokens.refreshToken;
    if (refresh != null) {
      try {
        await _api.post('/auth/logout', {'refreshToken': refresh});
      } catch (_) {
        // Signing out locally still works if the server is unreachable.
      }
    }
    await _api.tokens.clear();
    state = const AsyncData(null);
  }
}
