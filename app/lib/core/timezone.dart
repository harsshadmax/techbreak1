import 'package:flutter_timezone/flutter_timezone.dart';

/// The device's IANA time zone (e.g. "Asia/Kolkata"), or null if it can't be read.
Future<String?> deviceTimezone() async {
  try {
    return (await FlutterTimezone.getLocalTimezone()).identifier;
  } catch (_) {
    return null;
  }
}
