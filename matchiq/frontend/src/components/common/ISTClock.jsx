import { useEffect, useState } from "react";
import { istNow } from "../../utils/timeUtils";

export default function ISTClock({ className = "" }) {
  const [time, setTime] = useState(istNow());

  useEffect(() => {
    const t = setInterval(() => setTime(istNow()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <span className={`stat text-pitch text-sm ${className}`} title="Indian Standard Time">
      🕐 {time} IST
    </span>
  );
}
