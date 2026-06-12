const IST_TZ = "Asia/Kolkata";

export function toISTString(isoUtc, opts = {}) {
  const d = new Date(isoUtc);
  return (
    d.toLocaleString("en-IN", {
      timeZone: IST_TZ,
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      ...opts,
    }) + " IST"
  );
}

export function toISTDate(isoUtc) {
  return new Date(isoUtc).toLocaleDateString("en-IN", {
    timeZone: IST_TZ,
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function toISTTime(isoUtc) {
  return (
    new Date(isoUtc).toLocaleTimeString("en-IN", {
      timeZone: IST_TZ,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }) + " IST"
  );
}

export function istNow() {
  return new Date().toLocaleTimeString("en-IN", {
    timeZone: IST_TZ,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export function istToday() {
  return new Date().toLocaleDateString("en-IN", {
    timeZone: IST_TZ,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function countdownParts(isoUtc) {
  const diff = new Date(isoUtc).getTime() - Date.now();
  if (diff <= 0) return null;
  const secs = Math.floor(diff / 1000);
  return {
    days: Math.floor(secs / 86400),
    hours: Math.floor((secs % 86400) / 3600),
    mins: Math.floor((secs % 3600) / 60),
    secs: secs % 60,
  };
}
