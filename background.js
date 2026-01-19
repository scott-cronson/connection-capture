importScripts("constants.js", "utility.js");

const NOTIFICATION_TITLE = "Connection Capture";
const LINKEDIN_HOST = "www.linkedin.com";
const LINKEDIN_PROFILE_PREFIX = "/in/";
const NOTIFICATION_ICON = "icons/icon-128.png";
const PENDING_DOWNLOAD_TIMEOUT_MS = 15000;
const pendingDownloadsByTab = new Map();

const isLinkedInProfileUrl = (urlString) => {
  try {
    const url = new URL(urlString);
    return url.hostname === LINKEDIN_HOST
      && url.pathname.startsWith(LINKEDIN_PROFILE_PREFIX);
  } catch {
    return false;
  }
};

const setPendingDownload = (tabId, urlString) => {
  const slug = extractProfileSlug(urlString, LINKEDIN_HOST);
  if (!slug) {
    return;
  }
  pendingDownloadsByTab.set(tabId, { slug, timestamp: Date.now() });
};

const getPendingSlugForTab = (tabId) => {
  const pending = pendingDownloadsByTab.get(tabId);
  if (!pending) {
    return "";
  }
  if (Date.now() - pending.timestamp > PENDING_DOWNLOAD_TIMEOUT_MS) {
    pendingDownloadsByTab.delete(tabId);
    return "";
  }
  return pending.slug;
};

const getMostRecentPendingSlug = () => {
  let best = null;
  pendingDownloadsByTab.forEach((value) => {
    if (!best || value.timestamp > best.timestamp) {
      best = value;
    }
  });
  if (!best || Date.now() - best.timestamp > PENDING_DOWNLOAD_TIMEOUT_MS) {
    return "";
  }
  return best.slug;
};

const getDownloadExtension = (downloadItem) => {
  const sources = [downloadItem.filename, downloadItem.finalUrl, downloadItem.url];
  for (const source of sources) {
    if (!source) {
      continue;
    }
    const match = String(source).match(/\.([A-Za-z0-9]+)(?:$|\?|#)/);
    if (match) {
      return `.${match[1]}`;
    }
  }
  return ".pdf";
};

const pickFieldValue = (nextValue, prevValue) => {
  if (typeof nextValue === "string") {
    const trimmed = nextValue.trim();
    if (trimmed) {
      return trimmed;
    }
  } else if (nextValue !== undefined && nextValue !== null) {
    return nextValue;
  }
  return prevValue ?? "";
};

const upsertProfileVisit = async (urlString, fields = {}) => {
  const normalizedUrl = normalizeLinkedInUrl(urlString);
  const key = `profile:${normalizedUrl}`;
  const nowDate = formatLocalDate();

  const existing = await chrome.storage.local.get(key);
  const prev = existing[key];
  const mergedFields = {
    cx_level: pickFieldValue(fields.cx_level, prev && prev.cx_level),
    name: pickFieldValue(fields.name, prev && prev.name),
    mutuals: pickFieldValue(fields.mutuals, prev && prev.mutuals)
  };
  const next = prev
    ? {
        ...prev,
        url: normalizedUrl,
        lastSeen: nowDate,
        ...mergedFields
      }
    : {
        url: normalizedUrl,
        lastSeen: nowDate,
        ...mergedFields
      };

  await chrome.storage.local.set({ [key]: next });
  return normalizedUrl;
};

const getAllStorage = async () => chrome.storage.local.get(null);

const showNotification = (message) => {
  chrome.notifications.create({
    type: "basic",
    iconUrl: NOTIFICATION_ICON,
    title: NOTIFICATION_TITLE,
    message
  });
};

const runDownloadProfilePdf = async (tabId) => {
  const response = await chrome.tabs.sendMessage(tabId, {
    type: "downloadProfilePdf"
  });

  if (!response || !response.ok) {
    const errorMessage = response && response.error
      ? response.error
      : "Unknown content script error.";
    throw new Error(errorMessage);
  }
};

const runExtractProfileFields = async (tabId) => {
  const response = await chrome.tabs.sendMessage(tabId, {
    type: "extractProfileFields"
  });

  if (!response || !response.ok) {
    const errorMessage = response && response.error
      ? response.error
      : "Unknown content script error.";
    throw new Error(errorMessage);
  }

  return response.fields || {};
};

chrome.downloads.onDeterminingFilename.addListener((downloadItem, suggest) => {
  const slugFromDownload = extractProfileSlug(
    downloadItem.referrer || downloadItem.finalUrl || downloadItem.url || "",
    LINKEDIN_HOST
  );

  const tabSlug = typeof downloadItem.tabId === "number"
    ? getPendingSlugForTab(downloadItem.tabId)
    : "";
  const fallbackSlug = getMostRecentPendingSlug();
  const slug = slugFromDownload || tabSlug || fallbackSlug;

  if (!slug) {
    return;
  }

  suggest({
    filename: `${DOWNLOADS_SUBDIRECTORY}/${slug}.pdf`,
    conflictAction: "uniquify"
  });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete" || !tab.url) {
    return;
  }

  if (!isLinkedInProfileUrl(tab.url)) {
    return;
  }

  setTimeout(() => {
    setPendingDownload(tabId, tab.url);
    runDownloadProfilePdf(tabId)
      .then(async () => {
        const fields = await runExtractProfileFields(tabId);
        await upsertProfileVisit(tab.url, fields);
        const allStorage = await getAllStorage();
        const storageMessage = JSON.stringify(allStorage);
        showNotification(`Success: downloadProfilePdf triggered. Storage: ${storageMessage}`);
      })
      .catch((error) => {
        const errorMessage = error && error.message ? error.message : String(error);
        showNotification(`Failure: ${errorMessage}`);
      });
  }, 1000);
});
