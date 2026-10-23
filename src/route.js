// Entrée publique : lueurvivante.fr/toctoc/ sert le jeu lui-même (premier plan),
// plus une iframe workers.dev. Sur iPhone (WebKit), le stockage d'une iframe tierce
// est partitionné ET éphémère : l'identité du joueur disparaissait à chaque fermeture.
export const PREFIX = '/toctoc';

// Traduit un chemin public en chemin interne (assets ou /ws).
// { redirect } : /toctoc → /toctoc/ pour que « net.js » relatif se résolve sous /toctoc/.
export function route(pathname) {
  if (pathname === PREFIX) return { redirect: PREFIX + '/' };
  if (pathname.startsWith(PREFIX + '/')) return { path: pathname.slice(PREFIX.length), prefixed: true };
  return { path: pathname, prefixed: false };
}

// Une redirection d'asset (ex. /index.html → /) doit rester sous /toctoc/.
export function prefixLocation(location) {
  return location && location.startsWith('/') && !location.startsWith('//') ? PREFIX + location : location;
}
