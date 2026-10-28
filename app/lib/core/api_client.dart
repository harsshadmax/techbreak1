import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'config.dart';
import 'token_store.dart';

final tokenStoreProvider = Provider<TokenStore>((ref) => TokenStore());
final apiProvider = Provider<ApiClient>((ref) => ApiClient(ref.watch(tokenStoreProvider)));

typedef Json = Map<String, dynamic>;

/// Thin JSON client for the TechBreak API. Adds the bearer token and
/// transparently refreshes it once when a request comes back 401.
class ApiClient {
  ApiClient(this.tokens)
      : dio = Dio(
          BaseOptions(
            baseUrl: AppConfig.apiBaseUrl,
            connectTimeout: const Duration(seconds: 10),
            receiveTimeout: const Duration(seconds: 15),
          ),
        ) {
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          final token = tokens.accessToken;
          if (token != null) options.headers['Authorization'] = 'Bearer $token';
          handler.next(options);
        },
        onError: (error, handler) async {
          final req = error.requestOptions;
          final canRetry = error.response?.statusCode == 401 &&
              req.extra['retried'] != true &&
              !req.path.startsWith('/auth/') &&
              tokens.refreshToken != null;
          if (!canRetry) {
            handler.next(error);
            return;
          }
          if (await _refresh()) {
            req.extra['retried'] = true;
            req.headers['Authorization'] = 'Bearer ${tokens.accessToken}';
            try {
              handler.resolve(await dio.fetch(req));
            } on DioException catch (e) {
              handler.next(e);
            }
            return;
          }
          onSessionExpired?.call();
          handler.next(error);
        },
      ),
    );
  }

  final TokenStore tokens;
  final Dio dio;

  /// Called when the refresh token is rejected and the user must sign in again.
  void Function()? onSessionExpired;

  Future<bool> _refresh() async {
    try {
      final res = await Dio(BaseOptions(baseUrl: AppConfig.apiBaseUrl))
          .post<Json>('/auth/refresh', data: {'refreshToken': tokens.refreshToken});
      await tokens.save(res.data!['accessToken'] as String, res.data!['refreshToken'] as String);
      return true;
    } catch (_) {
      await tokens.clear();
      return false;
    }
  }

  Future<Json> get(String path, {Map<String, dynamic>? query}) async =>
      (await dio.get<Json>(path, queryParameters: query)).data ?? {};

  Future<Json> post(String path, [Object? body]) async => (await dio.post<Json>(path, data: body)).data ?? {};

  Future<Json> put(String path, [Object? body]) async => (await dio.put<Json>(path, data: body)).data ?? {};

  Future<Json> patch(String path, [Object? body]) async => (await dio.patch<Json>(path, data: body)).data ?? {};
}

/// Human-readable message for an API failure.
String apiErrorMessage(Object error) {
  if (error is DioException) {
    final data = error.response?.data;
    if (data is Map && data['error'] is String) return data['error'] as String;
    if (error.type == DioExceptionType.connectionError || error.type == DioExceptionType.connectionTimeout) {
      return "Can't reach the TechBreak server";
    }
  }
  return 'Something went wrong';
}
