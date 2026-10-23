// Choix de l'organisateur d'une salle, sans dépendance Cloudflare (testable sous Node).
// - Le créateur revenu reprend son rôle (organisateur ou arbitre de sa salle).
// - Organisateur absent depuis plus de 10 s : un joueur présent le remplace,
//   pour que « Manche suivante » / « Rejouer » restent possibles.
// Renvoie le nouvel organisateur, ou null si rien ne change.
export function electHost(meta, players, seen, now, born) {
  if (!meta) return null;
  const live = (u) => now - (seen[u] || 0) < 3000;
  if (meta.creator && meta.host !== meta.creator && (players || {})[meta.creator] && live(meta.creator)) return meta.creator;
  if (now - born > 10000 && now - (seen[meta.host] || 0) > 10000) {
    const next = Object.keys(players || {}).filter(live).sort()[0];
    if (next && next !== meta.host) return next;
  }
  return null;
}
