import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api_client.dart';
import '../../shared/models.dart';
import '../../shared/ui.dart';
import '../../shared/widgets.dart';
import '../auth/auth_controller.dart';
import 'insights_logic.dart';

const _weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const _months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/// Month grid of faces, like a mood calendar: green when the daily goal was met, yellow for some focus.
class _CalendarCard extends StatelessWidget {
  const _CalendarCard({required this.cells, required this.month});

  final List<CalendarCell?> cells;
  final DateTime month;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final goalDays = cells.where((c) => c?.mood == DayMood.goal).length;
    final activeDays = cells.where((c) => c != null && c.minutes > 0).length;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('${_months[month.month - 1]} ${month.year}', style: text.titleLarge),
        const SizedBox(height: 12),
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(color: Palette.paper, borderRadius: BorderRadius.circular(26)),
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 440),
              child: Column(
            children: [
              Row(
                children: [
                  for (final d in const ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'])
                    Expanded(child: Center(child: Text(d, style: text.labelSmall))),
                ],
              ),
              const SizedBox(height: 6),
              GridView.count(
                crossAxisCount: 7,
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                mainAxisSpacing: 6,
                crossAxisSpacing: 6,
                children: [for (final c in cells) c == null ? const SizedBox.shrink() : _DayFace(cell: c)],
              ),
            ],
          ),
            ),
          ),
        ),
        const SizedBox(height: 12),
        BentoTile(
          color: Palette.green,
          title: 'Monthly focus summary',
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(goalDays > 0 ? 'Focused' : 'Getting started', style: text.headlineMedium),
                    Text('$goalDays goal days · $activeDays active days', style: text.bodyMedium),
                  ],
                ),
              ),
              FaceBlob(mood: goalDays > 0 ? FaceMood.happy : FaceMood.calm, color: Colors.white, size: 64),
            ],
          ),
        ),
      ],
    );
  }
}

class _DayFace extends StatelessWidget {
  const _DayFace({required this.cell});

  final CalendarCell cell;

  @override
  Widget build(BuildContext context) {
    final label = '${cell.day.day}: ${cell.minutes} focus minutes';
    final face = switch (cell.mood) {
      DayMood.goal => const FaceBlob(shape: FaceShape.squircle, mood: FaceMood.happy, color: Palette.green),
      DayMood.some => const FaceBlob(shape: FaceShape.squircle, mood: FaceMood.calm, color: Palette.yellow),
      DayMood.none => const SizedBox.expand(child: DecoratedBox(decoration: BoxDecoration(color: Color(0xFFEDEBF1), borderRadius: BorderRadius.all(Radius.circular(10))))),
      DayMood.future => const SizedBox.expand(child: DecoratedBox(decoration: BoxDecoration(color: Color(0xFFF4F2F8), borderRadius: BorderRadius.all(Radius.circular(10))))),
    };
    return Semantics(label: label, child: face);
  }
}

class InsightsScreen extends ConsumerStatefulWidget {
  const InsightsScreen({super.key});

  @override
  ConsumerState<InsightsScreen> createState() => _InsightsScreenState();
}

class _InsightsScreenState extends ConsumerState<InsightsScreen> {
  final _scroll = ScrollController();
  List<SessionRec> _sessions = [];
  final List<TokenTx> _history = [];
  String? _cursor;
  bool _loading = true;
  bool _loadingMore = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _scroll.addListener(() {
      if (_scroll.position.extentAfter < 200) _loadMore();
    });
    _refresh();
  }

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _refresh() async {
    final api = ref.read(apiProvider);
    final from = DateTime.now().subtract(const Duration(days: 40)).toUtc().toIso8601String();
    try {
      final results = await Future.wait([
        api.get('/sessions', query: {'from': from, 'limit': 200}),
        api.get('/tokens/transactions', query: {'limit': 30}),
      ]);
      if (!mounted) return;
      setState(() {
        _sessions = parseList(results[0]['items'], SessionRec.fromJson);
        _history
          ..clear()
          ..addAll(parseList(results[1]['items'], TokenTx.fromJson));
        _cursor = results[1]['nextCursor'] as String?;
        _error = null;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = apiErrorMessage(e);
        _loading = false;
      });
    }
  }

  Future<void> _loadMore() async {
    if (_cursor == null || _loadingMore) return;
    setState(() => _loadingMore = true);
    try {
      final res = await ref.read(apiProvider).get('/tokens/transactions', query: {'before': _cursor, 'limit': 30});
      if (!mounted) return;
      setState(() {
        _history.addAll(parseList(res['items'], TokenTx.fromJson));
        _cursor = res['nextCursor'] as String?;
      });
    } catch (_) {
      // Leave the cursor so scrolling again retries.
    }
    if (mounted) setState(() => _loadingMore = false);
  }

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return Scaffold(
      appBar: AppBar(title: const Text('Insights')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? ErrorRetry(message: _error!, onRetry: _refresh)
              : RefreshIndicator(
                  onRefresh: _refresh,
                  child: ListView(
                    controller: _scroll,
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.all(16),
                    children: [
                      _CalendarCard(
                        cells: monthCells(
                          DateTime.now(),
                          _sessions,
                          DateTime.now(),
                          goalMin: ref.watch(authProvider).valueOrNull?.dailyFocusGoalMin ?? 0,
                        ),
                        month: DateTime.now(),
                      ),
                      const SizedBox(height: 16),
                      Text('Focus minutes, last 7 days', style: text.titleMedium),
                      const SizedBox(height: 16),
                      _WeekChart(days: focusMinutesByDay(_sessions, DateTime.now())),
                      const SizedBox(height: 16),
                      _Totals(sessions: _sessions.where((s) => s.startedAt.isAfter(DateTime.now().subtract(const Duration(days: 7)))).toList()),
                      const SizedBox(height: 24),
                      Text('Token history', style: text.titleMedium),
                      const SizedBox(height: 8),
                      if (_history.isEmpty)
                        const Padding(padding: EdgeInsets.all(24), child: Center(child: Text('No tokens earned yet — start a focus session!'))),
                      for (final t in _history)
                        ListTile(
                          dense: true,
                          title: Text(Award(t.amount, t.reason).label),
                          subtitle: Text(t.createdAt.toLocal().toString().substring(0, 16)),
                          trailing: Text('${t.amount > 0 ? '+' : ''}${t.amount}', style: text.titleMedium),
                        ),
                      if (_loadingMore) const Padding(padding: EdgeInsets.all(16), child: Center(child: CircularProgressIndicator())),
                    ],
                  ),
                ),
    );
  }
}

class _WeekChart extends StatelessWidget {
  const _WeekChart({required this.days});

  final List<DayMinutes> days;

  @override
  Widget build(BuildContext context) {
    final color = Theme.of(context).colorScheme.primary;
    final max = days.fold<int>(0, (m, d) => d.minutes > m ? d.minutes : m);
    return SizedBox(
      height: 200,
      child: BarChart(
        BarChartData(
          maxY: (max < 30 ? 30 : max * 1.2).toDouble(),
          gridData: const FlGridData(drawVerticalLine: false),
          borderData: FlBorderData(show: false),
          barTouchData: BarTouchData(enabled: true),
          titlesData: FlTitlesData(
            topTitles: const AxisTitles(),
            rightTitles: const AxisTitles(),
            leftTitles: const AxisTitles(sideTitles: SideTitles(showTitles: true, reservedSize: 36)),
            bottomTitles: AxisTitles(
              sideTitles: SideTitles(
                showTitles: true,
                getTitlesWidget: (value, meta) => Padding(
                  padding: const EdgeInsets.only(top: 6),
                  child: Text(_weekdays[days[value.toInt()].day.weekday - 1], style: Theme.of(context).textTheme.labelSmall),
                ),
              ),
            ),
          ),
          barGroups: [
            for (var i = 0; i < days.length; i++)
              BarChartGroupData(x: i, barRods: [
                BarChartRodData(toY: days[i].minutes.toDouble(), color: color, width: 18, borderRadius: BorderRadius.circular(4)),
              ]),
          ],
        ),
      ),
    );
  }
}

class _Totals extends StatelessWidget {
  const _Totals({required this.sessions});

  final List<SessionRec> sessions;

  @override
  Widget build(BuildContext context) {
    final focus = sessions.where((s) => s.type == 'focus' && s.status == 'completed');
    final minutes = focus.fold<int>(0, (n, s) => n + s.actualMin);
    final tokens = sessions.fold<int>(0, (n, s) => n + s.tokensAwarded);
    final text = Theme.of(context).textTheme;
    Widget tile(String label, Widget value) => Expanded(
          child: Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(label, style: text.labelMedium), const SizedBox(height: 6), value]),
            ),
          ),
        );
    return Row(
      children: [
        tile('Minutes', Text('$minutes', style: text.headlineSmall)),
        tile('Sessions', Text('${focus.length}', style: text.headlineSmall)),
        tile('Tokens', TokenAmount(tokens, style: text.headlineSmall)),
      ],
    );
  }
}
