// Weapon Mastery (2024 rules, SRD 5.2). Barbarians, Fighters, Paladins, Rangers and Rogues choose kinds of weapons
// whose mastery property they can use; each weapon in the 2024 equipment list names its property ("Mastery: Topple").
// The property texts below are from the System Reference Document 5.2 by Wizards of the Coast LLC, CC-BY-4.0.
import * as L from './library.js';
import * as R from './rules.js';

export const PROPS = {
  Cleave: "If you hit a creature with a melee attack roll using this weapon, you can make a melee attack roll with the weapon against a second creature within 5 feet of the first that is also within your reach. On a hit, the second creature takes the weapon's damage, but don't add your ability modifier to that damage unless that modifier is negative. You can make this extra attack only once per turn.",
  Graze: 'If your attack roll with this weapon misses a creature, you can deal damage to that creature equal to the ability modifier you used to make the attack roll. This damage is the same type dealt by the weapon, and the damage can be increased only by increasing the ability modifier.',
  Nick: 'When you make the extra attack of the Light property, you can make it as part of the Attack action instead of as a Bonus Action. You can make this extra attack only once per turn.',
  Push: 'If you hit a creature with this weapon, you can push the creature up to 10 feet straight away from yourself if it is Large or smaller.',
  Sap: 'If you hit a creature with this weapon, that creature has Disadvantage on its next attack roll before the start of your next turn.',
  Slow: "If you hit a creature with this weapon and deal damage to it, you can reduce its Speed by 10 feet until the start of your next turn. If the creature is hit more than once by weapons that have this property, the Speed reduction doesn't exceed 10 feet.",
  Topple: 'If you hit a creature with this weapon, you can force the creature to make a Constitution saving throw (DC 8 plus the ability modifier used to make the attack roll and your Proficiency Bonus). On a failed save, the creature has the Prone condition.',
  Vex: 'If you hit a creature with this weapon and deal damage to the creature, you have Advantage on your next attack roll against that creature before the end of your next turn.',
};

const is2024 = () => L.edition() === '2024';
const lvl = (c, name) => (c.classes || []).filter(k => String(k.name || L.get(k.clsId)?.name || '').toLowerCase() === name.toLowerCase()).reduce((t, k) => t + (Number(k.level) || 0), 0);
// How many kinds each class gets, by its level (Barbarian and Fighter grow; the others stay at two)
const COUNT = {
  Barbarian: l => (l >= 10 ? 4 : l >= 4 ? 3 : 2),
  Fighter: l => (l >= 16 ? 6 : l >= 10 ? 5 : l >= 4 ? 4 : 3),
  Paladin: () => 2, Ranger: () => 2, Rogue: () => 2,
};
/** Which of the character's classes give Weapon Mastery: [{ cls, level, count }] */
export const sources = c => (is2024() ? Object.entries(COUNT).map(([cls, f]) => ({ cls, level: lvl(c, cls) })).filter(x => x.level > 0).map(x => ({ ...x, count: COUNT[x.cls](x.level) })) : []);
/** How many kinds of weapon the character can master (the best of their classes) */
export const slots = c => Math.max(0, ...sources(c).map(x => x.count));
export const has = c => slots(c) > 0;
/** Fighter 9: Tactical Master (swap a mastery for Push, Sap or Slow on an attack) */
export const tactical = c => is2024() && lvl(c, 'Fighter') >= 9;

/** The weapon's mastery property, from its "Mastery: X" */
export const propOf = w => (String(w?.weapon?.props || '').match(/Mastery:\s*([A-Za-z]+)/) || [])[1] || '';
/** Every weapon in the library that has a mastery property */
export const weapons = () => L.all('item').filter(e => e.cat === 'weapon' && propOf(e)).sort((a, b) => a.name.localeCompare(b.name));
/** Can this character choose this weapon? Barbarians: Simple or Martial melee; Fighters: Simple or Martial;
 *  Paladins, Rangers and Rogues: weapons they're proficient with. Any one of their classes allowing it is enough. */
export function canChoose(c, w, proficient) {
  const ss = sources(c).map(x => x.cls), kind = w.weapon?.kind, melee = !w.weapon?.ranged;
  if (ss.includes('Fighter') && (kind === 'simple' || kind === 'martial')) return true;
  if (ss.includes('Barbarian') && melee && (kind === 'simple' || kind === 'martial')) return true;
  return ss.some(x => ['Paladin', 'Ranger', 'Rogue'].includes(x)) && proficient(w);
}
/** After a Long Rest: Barbarians and Fighters change one choice; Paladins, Rangers and Rogues may change them all. */
export const swapAfterRest = c => (sources(c).some(x => ['Paladin', 'Ranger', 'Rogue'].includes(x.cls)) ? 'all' : 'one');

export const chosen = c => (c.mastery?.picks || []).filter(Boolean);
// The weapon an attack is made with: the base weapon of a magic item, or the weapon whose name the attack carries
export function weaponOf(atk) {
  if (atk.base) return L.findByName('item', atk.base);
  const n = String(atk.name || '').toLowerCase();
  return weapons().filter(w => n.includes(w.name.toLowerCase().replace(/,.*$/, ''))).sort((a, b) => b.name.length - a.name.length)[0] || null;
}
/** The mastery this attack can use: { prop, text, dc? , graze? } or null */
export function forAttack(c, atk) {
  if (!has(c)) return null;
  const w = weaponOf(atk); if (!w) return null;
  if (!chosen(c).some(p => p.toLowerCase() === w.name.toLowerCase())) return null;
  const prop = propOf(w), m = R.amod(c, R.attackAbil(c, atk));
  return { prop, weapon: w.name, text: PROPS[prop] || '', dc: prop === 'Topple' ? 8 + m + R.prof(c) : null, graze: prop === 'Graze' ? m : null };
}
