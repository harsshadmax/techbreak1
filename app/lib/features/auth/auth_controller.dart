import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api_client.dart';
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
      return User.fromJson((await _api.get('/me'))['user'] as Json);
    } catch (_) {
      return null;
    }
  }

  /// Throws on failure so the login screen can show the message.
  Future<void> login(String email, String password) =>
      _authenticate('/auth/login', {'email': email, 'password': password});

  // TODO(week 5): send the device's IANA time zone (e.g. via the flutter_timezone package)
  // so streaks and daily goals roll over at local midnight. The server defaults to UTC;
  // it can be changed later with PATCH /me {timezone}.
  Future<void> register(String email, String password, String displayName) => _authenticate('/auth/register', {
        'email': email,
        'password': password,
        'displayName': displayName,
      });

  Future<void> _authenticate(String path, Json body) async {
    final res = await _api.post(path, body);
    await _api.tokens.save(res['accessToken'] as String, res['refreshToken'] as String);
    state = AsyncData(User.fromJson(res['user'] as Json));
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
