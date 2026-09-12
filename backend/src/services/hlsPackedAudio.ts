/**
 * Building an HLS playlist for audio that is still being made.
 *
 * The player does the hard part. Given a playlist marked `EVENT`, ExoPlayer and
 * AVPlayer fetch the first segment and begin, re-read the playlist as it grows,
 * and play each new segment in order with no gap — buffering ahead, retrying a
 * segment that fails, and stopping when the playlist says it has ended.
 *
 * That is why this is the right shape for a reading that is being produced
 * while it is heard: **ordering, joining and recovery are the player's job**,
 * and none of that logic exists in this codebase to get wrong.
 *
 * No network calls here, so the format can be tested byte for byte.
 */

/** AAC always codes this many samples per frame. */
const AAC_SAMPLES_PER_FRAME = 1024;

const ADTS_SAMPLE_RATES = [
  96000, 88200, 64000, 48000, 44100, 32000,
  24000, 22050, 16000, 12000, 11025, 8000, 7350
];

/**
 * How long a packed AAC segment lasts, from its own frames.
 *
 * `#EXTINF` has to be close to the truth or the player's idea of the timeline
 * drifts from the audio, and seeking lands in the wrong place. Counting ADTS
 * frames gives the exact answer rather than an estimate: every frame carries
 * its own length, so walking them is precise.
 */
export function measureAdtsDurationSeconds(audio: Buffer): number {
  let offset = 0;
  let frames = 0;
  let sampleRate = 24000;

  while (offset + 7 <= audio.length) {
    // Sync word: eleven set bits opening every ADTS frame.
    if (audio[offset] !== 0xff || (audio[offset + 1] & 0xf0) !== 0xf0) {
      offset += 1;

      continue;
    }

    const sampleRateIndex = (audio[offset + 2] & 0x3c) >> 2;

    if (sampleRateIndex < ADTS_SAMPLE_RATES.length) {
      sampleRate = ADTS_SAMPLE_RATES[sampleRateIndex];
    }

    const frameLength =
      ((audio[offset + 3] & 0x03) << 11) |
      (audio[offset + 4] << 3) |
      ((audio[offset + 5] & 0xe0) >> 5);

    if (frameLength <= 0) {
      break;
    }

    frames += 1;
    offset += frameLength;
  }

  if (!frames || !sampleRate) {
    return 0;
  }

  return (frames * AAC_SAMPLES_PER_FRAME) / sampleRate;
}

const TIMESTAMP_OWNER = 'com.apple.streaming.transportStreamTimestamp';
/** HLS timestamps are counted in 90kHz ticks. */
const HLS_TIMESCALE = 90000;

/** ID3 sizes are stored seven bits per byte, so no byte can look like a sync word. */
function toSyncSafe(size: number): Buffer {
  return Buffer.from([
    (size >> 21) & 0x7f,
    (size >> 14) & 0x7f,
    (size >> 7) & 0x7f,
    size & 0x7f
  ]);
}

/**
 * Stamps a packed audio segment with where it belongs in the timeline.
 *
 * RFC 8216 requires a packed audio segment to carry its start time in an ID3
 * PRIV frame. Without it a player has to infer the timeline from the segments
 * themselves, and the further into a long reading somebody gets the more the
 * inference drifts — which shows up as seeking landing in the wrong place.
 */
export function withHlsTimestamp(audio: Buffer, startSeconds: number): Buffer {
  const owner = Buffer.from(`${TIMESTAMP_OWNER}\0`, 'latin1');
  const ticks = Buffer.alloc(8);

  ticks.writeBigUInt64BE(BigInt(Math.max(0, Math.round(startSeconds * HLS_TIMESCALE))));

  const frameBody = Buffer.concat([owner, ticks]);
  const frameHeader = Buffer.concat([
    Buffer.from('PRIV', 'latin1'),
    toSyncSafe(frameBody.length),
    Buffer.from([0x00, 0x00])
  ]);
  const frame = Buffer.concat([frameHeader, frameBody]);
  const tagHeader = Buffer.concat([
    Buffer.from('ID3', 'latin1'),
    Buffer.from([0x04, 0x00, 0x00]),
    toSyncSafe(frame.length)
  ]);

  return Buffer.concat([tagHeader, frame, audio]);
}

export interface HlsSegment {
  durationSeconds: number;
  url: string;
}

/**
 * Writes the playlist.
 *
 * `EVENT` is the type for a playlist that only ever grows, which is exactly a
 * reading being produced: the player keeps re-reading it and appends what it
 * finds. `#EXT-X-ENDLIST` is what tells it to stop looking, and it is written
 * only when the reading is genuinely finished — writing it early truncates the
 * recording, and never writing it leaves the player polling for ever.
 */
export function buildHlsEventPlaylist(input: {
  isComplete: boolean;
  segments: HlsSegment[];
}): string {
  const targetDuration = input.segments.reduce(
    (longest, segment) => Math.max(longest, Math.ceil(segment.durationSeconds)),
    1
  );

  const lines = [
    '#EXTM3U',
    '#EXT-X-VERSION:3',
    `#EXT-X-TARGETDURATION:${targetDuration}`,
    '#EXT-X-MEDIA-SEQUENCE:0',
    '#EXT-X-PLAYLIST-TYPE:EVENT'
  ];

  for (const segment of input.segments) {
    lines.push(`#EXTINF:${segment.durationSeconds.toFixed(3)},`);
    lines.push(segment.url);
  }

  if (input.isComplete) {
    lines.push('#EXT-X-ENDLIST');
  }

  return `${lines.join('\n')}\n`;
}
