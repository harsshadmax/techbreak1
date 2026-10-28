import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Holds the access/refresh token pair in memory and in secure storage.
class TokenStore {
  TokenStore([FlutterSecureStorage? storage]) : _storage = storage ?? const FlutterSecureStorage();

  final FlutterSecureStorage _storage;
  String? accessToken;
  String? refreshToken;

  Future<void> load() async {
    accessToken = await _storage.read(key: 'accessToken');
    refreshToken = await _storage.read(key: 'refreshToken');
  }

  Future<void> save(String access, String refresh) async {
    accessToken = access;
    refreshToken = refresh;
    await _storage.write(key: 'accessToken', value: access);
    await _storage.write(key: 'refreshToken', value: refresh);
  }

  Future<void> clear() async {
    accessToken = null;
    refreshToken = null;
    await _storage.deleteAll();
  }
}
