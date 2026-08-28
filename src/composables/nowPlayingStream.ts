import { computed } from "vue";
import { store } from "@/plugins/store";

/**
 * What a live stream says is on air right now, ready for display.
 */
export interface NowPlayingStream {
  /** Track currently playing on the station. */
  title: string;
  /** Performer, when the station bothers to send one separately. */
  artist?: string;
  /** Show / DJ / episode blurb, when the provider populates it. */
  description?: string;
}

/**
 * Composable exposing the live-stream metadata of the current queue item.
 *
 * For radio, `current_media` describes the *station*: its title is the station
 * name and it never changes as songs go by, because nothing merges
 * `stream_metadata` into it server-side. The song actually on air only exists
 * on `streamdetails.stream_metadata`, which until now reached the browser and
 * was dropped everywhere except the party view.
 */
export function useNowPlayingStream() {
  const nowPlayingStream = computed((): NowPlayingStream | undefined => {
    const player = store.activePlayer;
    if (!player || player.powered === false) return undefined;

    const media = player.current_media;
    const queueItem = store.curQueueItem;
    // The queue item is only describing this player's media if the two agree
    // on which item it is. A null queue_item_id means the media did not come
    // from the queue controller at all, so there is nothing to line up.
    // queueItem is tested on its own rather than through the comparison: two
    // absent ids compare equal, which would let an undefined queue item
    // through even though the types say it cannot.
    if (
      !media ||
      !queueItem ||
      !media.queue_item_id ||
      media.queue_item_id !== queueItem.queue_item_id
    ) {
      return undefined;
    }

    const meta = queueItem.streamdetails?.stream_metadata;
    if (!meta?.title) return undefined;
    // A regular track's stream_metadata just restates the title we are already
    // showing above. Only render this line when it adds something.
    if (meta.title === media.title) return undefined;

    return {
      title: meta.title,
      artist: meta.artist ?? undefined,
      description: meta.description ?? undefined,
    };
  });

  return { nowPlayingStream };
}
