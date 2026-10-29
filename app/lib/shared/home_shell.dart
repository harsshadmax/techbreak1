import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'ui.dart';

class _Tab {
  const _Tab(this.label, this.icon, this.selectedIcon);

  final String label;
  final IconData icon;
  final IconData selectedIcon;
}

const _tabs = [
  _Tab('Home', Icons.home_outlined, Icons.home_rounded),
  _Tab('Apps', Icons.grid_view_outlined, Icons.grid_view_rounded),
  _Tab('Rewards', Icons.storefront_outlined, Icons.storefront),
  _Tab('Challenges', Icons.emoji_events_outlined, Icons.emoji_events),
  _Tab('Profile', Icons.person_outline, Icons.person),
];

class HomeShell extends StatelessWidget {
  const HomeShell({super.key, required this.shell});

  final StatefulNavigationShell shell;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: shell,
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
          child: Container(
            height: 68,
            padding: const EdgeInsets.symmetric(horizontal: 8),
            decoration: BoxDecoration(color: Palette.ink, borderRadius: BorderRadius.circular(999)),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                for (var i = 0; i < _tabs.length; i++)
                  Semantics(
                    button: true,
                    selected: i == shell.currentIndex,
                    label: _tabs[i].label,
                    child: InkResponse(
                      radius: 30,
                      onTap: () => shell.goBranch(i, initialLocation: i == shell.currentIndex),
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 180),
                        width: 52,
                        height: 52,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: i == shell.currentIndex ? Colors.white : Colors.transparent,
                        ),
                        child: Icon(
                          i == shell.currentIndex ? _tabs[i].selectedIcon : _tabs[i].icon,
                          color: i == shell.currentIndex ? Palette.ink : Colors.white,
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
