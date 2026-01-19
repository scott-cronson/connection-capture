const KEY_SEPARATOR = ":";
const PREFERRED_FIELDS = ["url", "name", "cx_level", "mutuals", "lastSeen", "visits"];

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

const determineKeyHeader = (entries) => {
  const headers = new Set(entries.map((entry) => entry.keyHeader));
  if (headers.size === 1) {
    return entries[0].keyHeader;
  }
  return "key";
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
  const entries = Object.entries(storage).map(([key, value]) => {
    const parsedKey = parseStorageKey(key);
    return {
      originalKey: key,
      keyHeader: parsedKey.header,
      keyValue: parsedKey.value,
      data: value
    };
  });

  if (entries.length === 0) {
    return "key";
  }

  const keyHeader = determineKeyHeader(entries);
  const fieldNames = collectFieldNames(entries);
  const headerRow = [keyHeader, ...fieldNames];

  const rows = entries.map((entry) => {
    const firstValue = entry.keyHeader === keyHeader
      ? entry.keyValue
      : entry.originalKey;

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

const setStatus = (message) => {
  const status = document.getElementById("status");
  if (status) {
    status.textContent = message;
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

const downloadCsv = async () => {
  setStatus("Preparing CSV...");
  const storage = await chrome.storage.local.get(null);
  const csvContent = buildCsvFromStorage(storage);
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = `${DOWNLOADS_SUBDIRECTORY}/linkedin-profiles-${formatLocalDate()}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  setStatus("CSV downloaded.");
};

document.addEventListener("DOMContentLoaded", () => {
  const button = document.getElementById("download-csv");
  const clearButton = document.getElementById("clear-csv");
  const confirmClearButton = document.getElementById("confirm-clear");
  if (!button) {
    return;
  }

  button.addEventListener("click", () => {
    downloadCsv().catch((error) => {
      const message = error && error.message ? error.message : String(error);
      setStatus(`Download failed: ${message}`);
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
        })
        .catch((error) => {
          const message = error && error.message ? error.message : String(error);
          setStatus(`Clear failed: ${message}`);
        });
    });
  }
});
