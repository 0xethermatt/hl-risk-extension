import { DEFAULT_STORAGE } from "../lib/storage";

/**
 * MV3 service worker. Seeds default settings on install so the popup and
 * content script always have well-defined values to read. Does not place
 * trades, sign anything, or talk to the exchange endpoint — the popup talks
 * directly to the content script via chrome.tabs.sendMessage.
 */
chrome.runtime.onInstalled.addListener(() => {
  void chrome.storage.local.get(Object.keys(DEFAULT_STORAGE)).then((existing) => {
    const missing = Object.fromEntries(
      Object.entries(DEFAULT_STORAGE).filter(([key]) => !(key in existing)),
    );
    if (Object.keys(missing).length > 0) {
      void chrome.storage.local.set(missing);
    }
  });
});
