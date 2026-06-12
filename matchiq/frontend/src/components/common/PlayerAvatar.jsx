import { useState } from "react";

/* Player photo with graceful degradation: photo → team flag.
   Photos are 640px Wikimedia Commons renders, displayed cropped to a
   circle; faces sit near the top of most portraits, so anchor there. */
export default function PlayerAvatar({ player, size = "md" }) {
  const [failed, setFailed] = useState(false);
  const dims = { sm: "h-8 w-8 text-base", md: "h-12 w-12 text-2xl", lg: "h-16 w-16 text-3xl" }[size];

  if (!player.photo || failed) {
    return (
      <div className={`grid ${dims} shrink-0 place-items-center rounded-full bg-navy-700`}>
        {player.team_flag || "👤"}
      </div>
    );
  }
  return (
    <img
      src={player.photo}
      alt={player.name}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`${dims} shrink-0 rounded-full border border-navy-600 object-cover object-top bg-navy-700`}
    />
  );
}
