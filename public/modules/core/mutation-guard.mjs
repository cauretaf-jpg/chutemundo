if (!window.__chuteMutationGuardInstalled) {
  window.__chuteMutationGuardInstalled = true;
  const NativeMutationObserver = window.MutationObserver;
  const ignoredContainers = [
    '#cmDiagnosticsPanel',
    '#cmTournamentReadiness',
    '#cmCupGroupEditor',
    '#cmDisciplineMetrics',
    '#cmDisciplineRules',
    '#cmDisciplineTable',
    '#topScorers',
    '#topAssists',
    '#cmPlayersGrid',
    '#teamList',
    '.cm-event-summary',
    '.cm-tournament-logos'
  ].join(',');
  const ignoredAddedNodes = [
    '.cm-picker-logo',
    '.cm-group-team',
    '.cm-event-summary',
    '.cm-tournament-logos',
    '#cmCardsMetric',
    '#cmDiagnosticsPanel',
    '#cmTournamentReadiness',
    '#cmCupGroupEditor'
  ].join(',');

  function elementFor(node) {
    if (!node) return null;
    if (node.nodeType === Node.ELEMENT_NODE) return node;
    return node.parentElement || null;
  }

  function isIgnoredAddedNode(node) {
    const element = elementFor(node);
    if (!element) return node.nodeType === Node.TEXT_NODE;
    return element.matches?.(ignoredAddedNodes) || Boolean(element.closest?.(ignoredContainers));
  }

  function isSelfMutation(mutation) {
    const target = elementFor(mutation.target);
    if (target?.closest?.(ignoredContainers)) return true;

    const added = Array.from(mutation.addedNodes || []);
    const removed = Array.from(mutation.removedNodes || []);
    if (added.length && added.every(isIgnoredAddedNode) && removed.every(isIgnoredAddedNode)) return true;
    return false;
  }

  window.MutationObserver = class ChuteStableMutationObserver {
    constructor(callback) {
      this.callback = callback;
      this.nativeObserver = new NativeMutationObserver((mutations) => {
        const meaningful = mutations.filter((mutation) => !isSelfMutation(mutation));
        if (meaningful.length) this.callback(meaningful, this);
      });
    }

    observe(target, options) {
      return this.nativeObserver.observe(target, options);
    }

    disconnect() {
      return this.nativeObserver.disconnect();
    }

    takeRecords() {
      return this.nativeObserver.takeRecords().filter((mutation) => !isSelfMutation(mutation));
    }
  };
}
