import 'package:flutter/material.dart';

/// Palette taken from the playful mood-app look: lavender ground, white cards, pastel tiles, black actions.
class Palette {
  static const ink = Color(0xFF111111);
  static const lavender = Color(0xFFE9E4F5);
  static const paper = Color(0xFFFFFFFF);
  static const orange = Color(0xFFFFB38A);
  static const purple = Color(0xFFCDB8FF);
  static const green = Color(0xFFB9F5A3);
  static const yellow = Color(0xFFFFE06B);
  static const pink = Color(0xFFFF9EDB);
  static const blue = Color(0xFF9CC4FF);
  static const coral = Color(0xFFFF8B84);

  static const faces = [green, purple, orange, yellow, pink, blue, coral];
}

enum FaceShape { circle, squircle, bolt, blob, tri }

enum FaceMood { happy, sleepy, surprised, angry, wink, calm }

/// A cartoon face on a coloured shape, used instead of icons for personality.
class FaceBlob extends StatelessWidget {
  const FaceBlob({super.key, this.shape = FaceShape.circle, this.mood = FaceMood.happy, this.color = Palette.green, this.size = 56});

  final FaceShape shape;
  final FaceMood mood;
  final Color color;
  final double size;

  @override
  Widget build(BuildContext context) {
    return ExcludeSemantics(
      child: SizedBox.square(dimension: size, child: CustomPaint(painter: _FacePainter(shape, mood, color))),
    );
  }
}

class _FacePainter extends CustomPainter {
  _FacePainter(this.shape, this.mood, this.color);

  final FaceShape shape;
  final FaceMood mood;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final fill = Paint()..color = color;
    switch (shape) {
      case FaceShape.circle:
        canvas.drawCircle(size.center(Offset.zero), w / 2, fill);
      case FaceShape.squircle:
        canvas.drawRRect(RRect.fromRectAndRadius(Offset.zero & size, Radius.circular(w * 0.3)), fill);
      case FaceShape.blob:
        final p = Path()
          ..moveTo(0, w)
          ..quadraticBezierTo(0, w * 0.15, w * 0.5, w * 0.15)
          ..quadraticBezierTo(w, w * 0.15, w, w)
          ..close();
        canvas.drawPath(p, fill);
      case FaceShape.tri:
        final p = Path()
          ..moveTo(w * 0.5, w * 0.05)
          ..quadraticBezierTo(w * 0.62, w * 0.05, w * 0.95, w * 0.82)
          ..quadraticBezierTo(w, w * 0.95, w * 0.85, w * 0.95)
          ..lineTo(w * 0.15, w * 0.95)
          ..quadraticBezierTo(0, w * 0.95, w * 0.05, w * 0.82)
          ..quadraticBezierTo(w * 0.38, w * 0.05, w * 0.5, w * 0.05)
          ..close();
        canvas.drawPath(p, fill);
      case FaceShape.bolt:
        final p = Path()
          ..moveTo(w * 0.55, 0)
          ..lineTo(w * 0.1, w * 0.58)
          ..lineTo(w * 0.42, w * 0.58)
          ..lineTo(w * 0.3, w)
          ..lineTo(w * 0.92, w * 0.38)
          ..lineTo(w * 0.58, w * 0.38)
          ..close();
        canvas.drawPath(p, fill);
    }

    final ink = Paint()
      ..color = Palette.ink
      ..style = PaintingStyle.stroke
      ..strokeWidth = w * 0.045
      ..strokeCap = StrokeCap.round;
    final dot = Paint()..color = Palette.ink;
    // Features sit a little lower on shapes that taper at the top.
    final cy = switch (shape) {
      FaceShape.blob => w * 0.62,
      FaceShape.tri => w * 0.62,
      FaceShape.bolt => w * 0.5,
      _ => w * 0.5,
    };
    final dx = w * 0.17;
    final left = Offset(w * 0.5 - dx, cy - w * 0.06);
    final right = Offset(w * 0.5 + dx, cy - w * 0.06);

    void arcEye(Offset c, {bool up = false}) {
      final r = Rect.fromCenter(center: c, width: w * 0.16, height: w * 0.1);
      canvas.drawArc(r, up ? 3.14 : 0, 3.14, false, ink);
    }

    switch (mood) {
      case FaceMood.happy:
        arcEye(left, up: true);
        arcEye(right, up: true);
        canvas.drawArc(Rect.fromCenter(center: Offset(w * 0.5, cy + w * 0.08), width: w * 0.3, height: w * 0.2), 0.2, 2.7, false, ink);
      case FaceMood.sleepy:
        arcEye(left);
        arcEye(right);
        canvas.drawArc(Rect.fromCenter(center: Offset(w * 0.5, cy + w * 0.14), width: w * 0.18, height: w * 0.1), 3.4, 2.4, false, ink);
      case FaceMood.surprised:
        canvas.drawCircle(left, w * 0.035, dot);
        canvas.drawCircle(right, w * 0.035, dot);
        canvas.drawOval(Rect.fromCenter(center: Offset(w * 0.5, cy + w * 0.14), width: w * 0.12, height: w * 0.16), ink);
      case FaceMood.angry:
        canvas.drawLine(left.translate(-w * 0.07, -w * 0.07), left.translate(w * 0.07, -w * 0.02), ink);
        canvas.drawLine(right.translate(w * 0.07, -w * 0.07), right.translate(-w * 0.07, -w * 0.02), ink);
        canvas.drawCircle(left.translate(0, w * 0.03), w * 0.03, dot);
        canvas.drawCircle(right.translate(0, w * 0.03), w * 0.03, dot);
        canvas.drawArc(Rect.fromCenter(center: Offset(w * 0.5, cy + w * 0.2), width: w * 0.26, height: w * 0.14), 3.3, 2.5, false, ink);
      case FaceMood.wink:
        arcEye(left, up: true);
        canvas.drawCircle(right, w * 0.035, dot);
        canvas.drawArc(Rect.fromCenter(center: Offset(w * 0.5, cy + w * 0.08), width: w * 0.3, height: w * 0.2), 0.2, 2.7, false, ink);
      case FaceMood.calm:
        arcEye(left);
        arcEye(right);
        canvas.drawArc(Rect.fromCenter(center: Offset(w * 0.5, cy + w * 0.08), width: w * 0.24, height: w * 0.14), 0.3, 2.5, false, ink);
    }
  }

  @override
  bool shouldRepaint(_FacePainter old) => old.shape != shape || old.mood != mood || old.color != color;
}

/// A rounded pastel tile in the bento grid.
class BentoTile extends StatelessWidget {
  const BentoTile({super.key, required this.color, required this.child, this.title, this.icon, this.onTap, this.padding = const EdgeInsets.all(16)});

  final Color color;
  final Widget child;
  final String? title;
  final IconData? icon;
  final VoidCallback? onTap;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final body = Padding(
      padding: padding,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (title != null)
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Row(
                children: [
                  if (icon != null) ...[Icon(icon, size: 16, color: Palette.ink), const SizedBox(width: 6)],
                  Expanded(child: Text(title!, style: text.labelLarge?.copyWith(color: Palette.ink, fontWeight: FontWeight.w600))),
                ],
              ),
            ),
          child,
        ],
      ),
    );
    return Material(
      color: color,
      borderRadius: BorderRadius.circular(26),
      clipBehavior: Clip.antiAlias,
      child: onTap == null ? body : InkWell(onTap: onTap, child: body),
    );
  }
}

/// Small rounded chip, optionally with a face, like the mood chips in the reference.
class FaceChip extends StatelessWidget {
  const FaceChip({super.key, required this.label, required this.face, this.onTap, this.selected = false});

  final String label;
  final FaceBlob face;
  final VoidCallback? onTap;
  final bool selected;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: onTap != null,
      label: label,
      child: Material(
        color: selected ? Palette.ink : Palette.paper,
        borderRadius: BorderRadius.circular(999),
        child: InkWell(
          borderRadius: BorderRadius.circular(999),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(6, 6, 16, 6),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                face,
                const SizedBox(width: 8),
                Text(
                  label,
                  style: TextStyle(fontWeight: FontWeight.w700, color: selected ? Colors.white : Palette.ink),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Black, round "go" button with an arrow.
class ArrowButton extends StatelessWidget {
  const ArrowButton({super.key, required this.label, required this.onPressed});

  final String label;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: const Color(0xFFEDEBF1),
      borderRadius: BorderRadius.circular(999),
      child: InkWell(
        borderRadius: BorderRadius.circular(999),
        onTap: onPressed,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(22, 8, 8, 8),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(label, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
              const SizedBox(width: 14),
              const CircleAvatar(radius: 22, backgroundColor: Palette.ink, child: Icon(Icons.arrow_forward, color: Colors.white)),
            ],
          ),
        ),
      ),
    );
  }
}

/// Collage of colourful faces, used on the welcome screen.
class FaceCollage extends StatelessWidget {
  const FaceCollage({super.key, this.height = 300});

  final double height;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: height,
      child: LayoutBuilder(
        builder: (context, c) {
          final w = c.maxWidth;
          final s = w / 400;
          Widget at(double x, double y, double size, FaceShape shape, FaceMood mood, Color color) => Positioned(
                left: x * s,
                top: y * s,
                child: FaceBlob(shape: shape, mood: mood, color: color, size: size * s),
              );
          return Stack(
            clipBehavior: Clip.hardEdge,
            children: [
              at(10, 40, 130, FaceShape.circle, FaceMood.calm, Palette.green),
              at(150, 0, 140, FaceShape.circle, FaceMood.surprised, Palette.purple),
              at(290, 60, 120, FaceShape.squircle, FaceMood.angry, Palette.orange),
              at(-20, 160, 120, FaceShape.circle, FaceMood.wink, Palette.pink),
              at(120, 130, 120, FaceShape.bolt, FaceMood.happy, Palette.yellow),
              at(40, 230, 130, FaceShape.blob, FaceMood.sleepy, Palette.blue),
              at(230, 210, 150, FaceShape.tri, FaceMood.surprised, Palette.coral),
            ],
          );
        },
      ),
    );
  }
}
