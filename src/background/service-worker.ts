import { initIconUpdater } from "./icon-updater.ts";

initIconUpdater();

chrome.runtime.onMessage.addListener((message: { type: string; file?: string }) => {
  if (message.type === "openGame" && message.file) {
    void chrome.windows.create({
      url: chrome.runtime.getURL(message.file),
      type: "popup",
      width: 480,
      height: 640,
    });
  }
});
