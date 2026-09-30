export const VINYL_REFRESH_MS = 2000;
export const VINYL_MAX_AGE_MS = 6000;
const PHONO_SOURCES = new Set(["phono", "phono_in", "phono in"]);

export interface VinylSnapshot {
  player_id: string;
  state: "playing";
  source_type: "vinyl";
  title: string;
  artist: string;
  album: string;
  artwork_url: string | null;
}

export interface VinylPlayer {
  player_id: string;
  available?: boolean;
  powered?: boolean | null;
  active_source?: string | null;
  current_media?: { source_id?: string | null } | null;
}

export function isPhonoPlayer(player: VinylPlayer | undefined): boolean {
  if (!player || player.available === false || player.powered === false)
    return false;
  const source = player.active_source || player.current_media?.source_id || "";
  return PHONO_SOURCES.has(source.trim().toLowerCase());
}

export function currentVinylSnapshot(
  player: VinylPlayer | undefined,
  snapshot: VinylSnapshot | null,
  receivedAt: number,
  now: number,
): VinylSnapshot | null {
  if (
    !isPhonoPlayer(player) ||
    !snapshot ||
    snapshot.player_id !== player?.player_id
  )
    return null;
  if (now - receivedAt >= VINYL_MAX_AGE_MS || now < receivedAt) return null;
  return snapshot.state === "playing" && snapshot.source_type === "vinyl"
    ? snapshot
    : null;
}
