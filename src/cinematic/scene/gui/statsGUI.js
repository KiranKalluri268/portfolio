import Stats from 'stats.js';

export function createStatsGUI() {
  const stats = new Stats()
  // Positioning lives in style.css so the preset switcher can be placed against
  // this panel's height without the two definitions drifting apart.
  stats.dom.id = 'stats-panel'
  return stats;
}
