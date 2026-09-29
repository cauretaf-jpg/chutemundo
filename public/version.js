(() => {
  const VERSION = '6.0.1';
  const RELEASE_DATE = '2026-09-29';
  globalThis.CHUTE_APP_VERSION = VERSION;
  globalThis.CHUTE_RELEASE_DATE = RELEASE_DATE;
  globalThis.ChuteRelease = Object.freeze({ version: VERSION, releaseDate: RELEASE_DATE });
})();