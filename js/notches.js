// Notches (a Table Rules option): weapons and armor wear down and break.
// A natural 1 on an attack notches the weapon; a natural 20 against the wearer notches the shield first, then the armor.
// At the table's limit for that kind of item it breaks: unusable until a blacksmith repairs it. A broken magic item that's
// Common or Uncommon loses its magic for good (it's ordinary once repaired); Rare and up (or no rarity given) go dormant
// until an Artificer awakens them. Inventory rows keep their count on the row (r.nt); magic items from the DM keep
// theirs on the character (c.wear[cid] = { n, st: '' | 'lost' | 'dormant' }), since the DM's apps own those items.
import * as L from './library.js';

const KINDS = ['light', 'medium', 'heavy', 'shield', 'weapon', 'mlight', 'mmedium', 'mheavy', 'mshield', 'mweapon'];
const DEF = '3,5,7,1,5,9,15,21,4,15';
export const enabled = () => L.tableSettings().notches === 'on';
export function limits() {
  const v = String(L.tableSettings().notchMax || DEF).split(',').map(Number), d = DEF.split(',').map(Number);
  return Object.fromEntries(KINDS.map((k, i) => [k, Number.isFinite(v[i]) && v[i] > 0 ? Math.floor(v[i]) : d[i]]));
}

const ARMOR = { light: ['padded', 'leather', 'studded leather'], medium: ['hide', 'chain shirt', 'scale mail', 'breastplate', 'half plate', 'spiked armor'], heavy: ['ring mail', 'chain mail', 'splint', 'plate'] };
const plain = n => String(n || '').toLowerCase().replace(/\([^)]*\)/g, '').replace(/,?\s*\+\d+/g, '').replace(/\s+armor$/, '').trim();
const armorKindByName = n => (/shield/i.test(n) ? 'shield' : Object.entries(ARMOR).find(([, l]) => l.includes(plain(n)))?.[0] || '');

/** The kind of an inventory row in the Armor or Weapons section: 'light' | 'medium' | 'heavy' | 'shield' | 'weapon' | '' */
export function rowKind(sec, r) {
  const e = r.eqId ? L.get(r.eqId) : L.findByName('item', plain(r.name)) || L.findByName('item', r.name);
  if (e?.cat === 'armor') return e.armor?.kind === 'shield' ? 'shield' : ['light', 'medium', 'heavy'].includes(e.armor?.kind) ? e.armor.kind : 'medium';
  if (e?.cat === 'weapon') return 'weapon';
  if (sec === 'weapons') return String(r.name || '').trim() ? 'weapon' : '';
  if (sec === 'armor') return String(r.name || '').trim() ? armorKindByName(r.name) || 'medium' : '';
  return '';
}
/** The kind of a magic item from the DM, or '' if it isn't a weapon, armor or shield */
export function miKind(m) {
  if (m.baseKind === 'weapon') return 'weapon';
  if (m.baseKind === 'armor') {
    if (m.base === 'Shield' || /shield/i.test(m.base || '')) return 'shield';
    const e = L.findByName('item', m.base);
    return ['light', 'medium', 'heavy'].includes(e?.armor?.kind) ? e.armor.kind : armorKindByName(m.base) || 'medium';
  }
  const t = String(m.type || '');
  if (/^\s*weapon/i.test(t)) return 'weapon';
  if (/shield/i.test(t) || /shield/i.test(m.name)) return 'shield';
  if (/^\s*armor/i.test(t)) return /\blight\b/i.test(t) ? 'light' : /\bheavy\b/i.test(t) ? 'heavy' : 'medium';
  return '';
}
/** 'lost' for Common and Uncommon, 'dormant' for Rare and up (and anything without a rarity) */
export function breakFate(m) {
  const r = (String(m.type || '').toLowerCase().match(/\b(very rare|uncommon|common|rare|legendary|artifact)\b/g) || []).pop();
  return r === 'common' || r === 'uncommon' ? 'lost' : 'dormant';
}

// ---------- state
export const miWear = (c, m) => (c.wear || {})[m.cid] || { n: 0, st: '' };
export function rowState(sec, r) {
  const k = rowKind(sec, r); if (!k) return null;
  const magic = !!r.magic && r.mst !== 'lost';
  const max = limits()[(magic ? 'm' : '') + k], n = Math.max(0, Number(r.nt) || 0);
  return { kind: k, n, max, broken: n >= max, magic, st: r.mst || '' };
}
export function miState(c, m) {
  const k = miKind(m); if (!k) return null;
  const w = miWear(c, m), lost = w.st === 'lost';
  const max = limits()[(lost ? '' : 'm') + k], n = Math.max(0, Number(w.n) || 0);
  return { kind: k, n, max, broken: n >= max, magic: !lost, st: w.st || '' };
}
/** Does this magic item's magic work right now? (broken, lost or dormant: no) */
export function magicWorks(c, m) {
  if (!enabled()) return true;
  const s = miState(c, m); if (!s) return true;
  return !s.broken && !s.st;
}
/** Is what the AC comes from broken? from: an inventory row id, or 'mi:<cid>' */
export function brokenFrom(c, from) {
  if (!enabled() || !from) return false;
  if (String(from).startsWith('mi:')) { const m = (c.magicItems || []).find(x => `mi:${x.cid}` === from); return !!(m && miState(c, m)?.broken); }
  for (const sec of ['armor', 'weapons']) { const r = (c.inv?.[sec] || []).find(x => x.id === from); if (r) return !!rowState(sec, r)?.broken; }
  return false;
}
/** Is the weapon behind this attack broken? */
export function attackBroken(c, a) {
  if (!enabled()) return false;
  if (a.miCid) return brokenFrom(c, `mi:${a.miCid}`);
  if (a.eqRow) return brokenFrom(c, a.eqRow);
  return false;
}
