// An always-visible preset dropdown, sitting under the FPS meter.
//
// The lil-gui panel already has a preset control, but it is behind Ctrl+Alt+C,
// which no phone can press. Tier behaviour is most worth watching on exactly the
// devices that cannot open it — a mid-range Android on battery, ten minutes in,
// thermally throttled — so this is plain DOM, always mounted, and a native
// <select> so touch gets the OS picker rather than a hand-rolled menu.
//
// It always shows the tier actually running, whether that came from the
// benchmark or from a selection, so a safety downgrade during the fall is
// visible as it happens rather than inferred afterwards from the console.

const TIERS = ['low', 'medium', 'high'];

export function createPresetSwitcher({ onSelect, onLockChange, root = document.body }) {
  const wrap = document.createElement('div');
  wrap.id = 'preset-switcher-wrap';

  const select = document.createElement('select');
  select.id = 'preset-switcher';
  select.setAttribute('aria-label', 'Graphics preset');

  for (const tier of TIERS) {
    const option = document.createElement('option');
    option.value = tier;
    option.textContent = tier[0].toUpperCase() + tier.slice(1);
    select.appendChild(option);
  }

  select.addEventListener('change', () => onSelect(select.value));

  // A lock stops every automatic tier change — including the safety
  // downgrade a plain selection still allows — so a chosen tier can be held
  // in place for testing regardless of frame rate.
  const lockLabel = document.createElement('label');
  lockLabel.id = 'preset-switcher-lock';
  lockLabel.title = 'Lock preset — block automatic upgrades and downgrades';

  const lockCheckbox = document.createElement('input');
  lockCheckbox.type = 'checkbox';
  lockCheckbox.setAttribute('aria-label', 'Lock graphics preset');
  lockCheckbox.addEventListener('change', () => {
    onLockChange?.(lockCheckbox.checked);
  });

  lockLabel.appendChild(lockCheckbox);
  lockLabel.appendChild(document.createTextNode('Lock'));

  wrap.appendChild(select);
  wrap.appendChild(lockLabel);
  root.appendChild(wrap);

  function setTier(tier) {
    if (!TIERS.includes(tier) || select.value === tier) return;
    select.value = tier;
  }

  function dispose() {
    wrap.remove();
  }

  return { setTier, dispose };
}
