(() => {
  const VERSION = '6.2.1';
  const RELEASE_DATE = '2026-11-22';
  globalThis.CHUTE_APP_VERSION = VERSION;
  globalThis.CHUTE_RELEASE_DATE = RELEASE_DATE;
  globalThis.ChuteRelease = Object.freeze({ version: VERSION, releaseDate: RELEASE_DATE });
})();