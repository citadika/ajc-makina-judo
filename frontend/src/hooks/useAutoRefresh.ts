import { useEffect, useRef } from 'react'

/**
 * Actualisation automatique et périodique des données d'une page —
 * porté depuis core/utils/auto-refresh.ts (Angular).
 *
 * Relance silencieusement `refresh()` toutes les `periodMs`
 * millisecondes tant que le composant est monté, SAUF :
 *  - si l'onglet du navigateur n'est pas visible ;
 *  - si `shouldSkip()` renvoie `true` (formulaire ouvert,
 *    sauvegarde/suppression en cours...).
 *
 * Contrairement à la version Angular (qui doit contourner
 * l'absence de zone.js avec `appRef.tick()` pour forcer le
 * rafraîchissement de l'écran après chaque réponse HTTP), React
 * re-rend automatiquement à chaque `setState` : aucun contournement
 * n'est nécessaire ici, `refresh` peut être un simple appel
 * `fetchData().then(setState)`.
 */
export function useAutoRefresh(periodMs: number, refresh: () => void, shouldSkip: () => boolean = () => false): void {
  const refreshRef = useRef(refresh)
  const shouldSkipRef = useRef(shouldSkip)

  refreshRef.current = refresh
  shouldSkipRef.current = shouldSkip

  useEffect(() => {
    const id = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
        return
      }

      if (shouldSkipRef.current()) {
        return
      }

      refreshRef.current()
    }, periodMs)

    return () => window.clearInterval(id)
  }, [periodMs])
}
