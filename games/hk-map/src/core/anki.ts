// ---------- private Anki mode: only in the owner's own browser (open the site once with ?anki) ----------
const params = new URLSearchParams(location.search);
if (params.has('anki')) { try { localStorage.setItem('hkmap-anki', params.get('anki') === 'off' ? '' : '1'); } catch (e) {} history.replaceState(null, '', location.pathname); }
const ANKI = (() => { try { return !!localStorage.getItem('hkmap-anki'); } catch (e) { return false; } })();

export { ANKI, params };
