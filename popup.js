const KEY_SEPARATOR = ":";
const PREFERRED_FIELDS = ["url", "name", "cx_level", "mutuals", "lastSeen"];
const EXTENSION_ENABLED_KEY = "extensionEnabled";

const escapeCsvValue = (value) => {
  const stringValue = value === null || value === undefined ? "" : String(value);
  const escaped = stringValue.replace(/"/g, "\"\"");
  if (/[",\r\n]/.test(escaped)) {
    return `"${escaped}"`;
  }
  return escaped;
};

const parseStorageKey = (storageKey) => {
  const separatorIndex = storageKey.indexOf(KEY_SEPARATOR);
  if (separatorIndex === -1) {
    return { header: "key", value: storageKey };
  }
  return {
    header: storageKey.slice(0, separatorIndex),
    value: storageKey.slice(separatorIndex + 1)
  };
};

const collectFieldNames = (entries) => {
  const fields = new Set();
  entries.forEach((entry) => {
    if (entry.data && typeof entry.data === "object" && !Array.isArray(entry.data)) {
      Object.keys(entry.data).forEach((field) => fields.add(field));
    }
  });

  const ordered = [];
  PREFERRED_FIELDS.forEach((field) => {
    if (fields.has(field)) {
      ordered.push(field);
      fields.delete(field);
    }
  });

  Array.from(fields).sort().forEach((field) => ordered.push(field));
  return ordered;
};

const buildCsvFromStorage = (storage) => {
  const entries = Object.entries(storage)
    .filter(([key]) => key.startsWith("profile:"))
    .map(([key, value]) => {
      const parsedKey = parseStorageKey(key);
      return {
        originalKey: key,
        keyValue: parsedKey.value,
        data: value
      };
    });

  if (entries.length === 0) {
    return "url";
  }

  const fieldNames = collectFieldNames(entries);
  const headerRow = ["url", ...fieldNames];

  const rows = entries.map((entry) => {
    const firstValue = entry.keyValue || entry.originalKey;
    const data = entry.data && typeof entry.data === "object" && !Array.isArray(entry.data)
      ? entry.data
      : {};
    const values = fieldNames.map((field) => data[field]);
    return [firstValue, ...values];
  });

  const allRows = [headerRow, ...rows];
  return allRows
    .map((row) => row.map(escapeCsvValue).join(","))
    .join("\r\n");
};

const setStatus = (message, isError = false) => {
  const status = document.getElementById("status");
  if (status) {
    status.textContent = message;
    status.classList.toggle("is-error", isError);
  }
};

const setConfirmClearVisible = (visible) => {
  const confirmButton = document.getElementById("confirm-clear");
  if (!confirmButton) {
    return;
  }
  confirmButton.classList.toggle("hidden", !visible);
};

const clearStorage = async () => {
  await chrome.storage.local.clear();
};

const loadExtensionEnabled = async () => {
  const result = await chrome.storage.local.get(EXTENSION_ENABLED_KEY);
  if (typeof result[EXTENSION_ENABLED_KEY] === "boolean") {
    return result[EXTENSION_ENABLED_KEY];
  }
  await chrome.storage.local.set({ [EXTENSION_ENABLED_KEY]: true });
  return true;
};

const downloadCsv = async () => {
  setStatus("Preparing CSV...");
  const storage = await chrome.storage.local.get(null);
  const csvContent = buildCsvFromStorage(storage);
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  chrome.downloads.download(
    { url, saveAs: false, conflictAction: "uniquify" },
    () => {
      const error = chrome.runtime.lastError;
      if (error) {
        setStatus(`Download failed: ${error.message}`, true);
        void logError("download CSV", error);
      } else {
        setStatus("CSV downloaded.");
        void logInfo("Profile metadata CSV downloaded.");
      }
      URL.revokeObjectURL(url);
    }
  );
};

document.addEventListener("DOMContentLoaded", () => {
  const downloadCSVButton = document.getElementById("download-csv");
  const clearButton = document.getElementById("clear-csv");
  const confirmClearButton = document.getElementById("confirm-clear");
  const toggle = document.getElementById("extension-toggle");
  const logToggle = document.getElementById("log-toggle");
  const logList = document.getElementById("log-list");
  const logEmpty = document.getElementById("log-empty");
  let logsVisible = true;
  let cachedLogs = [];
  if (!downloadCSVButton) {
    return;
  }

  const renderLogs = () => {
    if (!logList || !logEmpty) {
      return;
    }
    logList.innerHTML = "";
    if (!logsVisible) {
      logList.classList.add("hidden");
      logEmpty.classList.add("hidden");
      return;
    }
    if (!cachedLogs.length) {
      logEmpty.classList.remove("hidden");
      logList.classList.add("hidden");
      return;
    }
    logEmpty.classList.add("hidden");
    logList.classList.remove("hidden");
    cachedLogs.forEach((entry) => {
      const item = document.createElement("div");
      const timestamp = entry && entry.timestamp ? entry.timestamp : "";
      const message = entry && entry.message ? entry.message : "";
      const text = timestamp ? `${timestamp} - ${message}` : message;
      item.className = `log-entry${entry && entry.level === "error" ? " is-error" : ""}`;
      item.textContent = text;
      logList.appendChild(item);
    });
  };

  const loadLogs = () => chrome.storage.local.get(LOGS_KEY)
    .then((result) => {
      cachedLogs = Array.isArray(result[LOGS_KEY]) ? result[LOGS_KEY] : [];
      renderLogs();
    });

  const loadLogVisibility = () => chrome.storage.local.get(LOG_VISIBILITY_KEY)
    .then((result) => {
      if (typeof result[LOG_VISIBILITY_KEY] === "boolean") {
        return result[LOG_VISIBILITY_KEY];
      }
      return chrome.storage.local.set({ [LOG_VISIBILITY_KEY]: true }).then(() => true);
    });

  if (toggle) {
    loadExtensionEnabled()
      .then((enabled) => {
        toggle.checked = enabled;
      })
      .catch((error) => {
        const message = error && error.message ? error.message : String(error);
        setStatus(`Failed to load setting: ${message}`, true);
        void logError("load extension setting", error);
      });

    toggle.addEventListener("change", () => {
      const enabled = toggle.checked;
      chrome.storage.local.set({ [EXTENSION_ENABLED_KEY]: enabled })
        .then(() => {
          setStatus(enabled ? "Extension enabled." : "Extension disabled.");
        })
        .catch((error) => {
          const message = error && error.message ? error.message : String(error);
          setStatus(`Failed to save setting: ${message}`, true);
          void logError("save extension setting", error);
        });
    });
  }

  if (logToggle) {
    loadLogVisibility()
      .then((visible) => {
        logsVisible = visible;
        logToggle.checked = visible;
        renderLogs();
      })
      .catch((error) => {
        const message = error && error.message ? error.message : String(error);
        setStatus(`Failed to load log visibility: ${message}`, true);
        void logError("load log visibility", error);
      });

    logToggle.addEventListener("change", () => {
      logsVisible = logToggle.checked;
      chrome.storage.local.set({ [LOG_VISIBILITY_KEY]: logsVisible })
        .then(() => {
          renderLogs();
        })
        .catch((error) => {
          const message = error && error.message ? error.message : String(error);
          setStatus(`Failed to save log visibility: ${message}`, true);
          void logError("save log visibility", error);
        });
    });
  }

  loadLogs()
    .catch((error) => {
      const message = error && error.message ? error.message : String(error);
      setStatus(`Failed to load logs: ${message}`, true);
      void logError("load logs", error);
    });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") {
      return;
    }
    if (changes[LOGS_KEY]) {
      cachedLogs = Array.isArray(changes[LOGS_KEY].newValue)
        ? changes[LOGS_KEY].newValue
        : [];
      renderLogs();
    }
    if (changes[LOG_VISIBILITY_KEY]) {
      logsVisible = Boolean(changes[LOG_VISIBILITY_KEY].newValue);
      if (logToggle) {
        logToggle.checked = logsVisible;
      }
      renderLogs();
    }
  });

  downloadCSVButton.addEventListener("click", () => {
    downloadCsv().catch((error) => {
      const message = error && error.message ? error.message : String(error);
      setStatus(`Download failed: ${message}`, true);
      void logError("download CSV", error);
    });
  });

  if (clearButton) {
    clearButton.addEventListener("click", () => {
      setConfirmClearVisible(true);
      setStatus("Click Confirm Clear to erase all stored data.");
    });
  }

  if (confirmClearButton) {
    confirmClearButton.addEventListener("click", () => {
      clearStorage()
        .then(() => {
          setConfirmClearVisible(false);
          setStatus("Local storage cleared.");
          void logInfo("Profile metadata cleared.");
        })
        .catch((error) => {
          const message = error && error.message ? error.message : String(error);
          setStatus(`Clear failed: ${message}`, true);
          void logError("clear storage", error);
        });
    });
  }
});
