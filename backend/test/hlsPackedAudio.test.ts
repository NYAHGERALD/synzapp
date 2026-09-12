import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildHlsEventPlaylist,
  measureAdtsDurationSeconds,
  withHlsTimestamp
} from '../src/services/hlsPackedAudio.js';

/** One ADTS frame with a stated length and a 24kHz sample rate index (6). */
function adtsFrame(frameLength: number): Buffer {
  const frame = Buffer.alloc(frameLength);

  frame[0] = 0xff;
  frame[1] = 0xf1;
  frame[2] = (6 << 2) & 0x3c;
  frame[3] = (frameLength >> 11) & 0x03;
  frame[4] = (frameLength >> 3) & 0xff;
  frame[5] = ((frameLength & 0x07) << 5) | 0x1f;
  frame[6] = 0xfc;

  return frame;
}

describe('measureAdtsDurationSeconds', () => {
  it('counts frames rather than guessing from the byte count', () => {
    // 24 frames at 24kHz is 24 * 1024 / 24000 = 1.024 seconds, whatever each
    // frame happens to weigh.
    const audio = Buffer.concat(Array.from({ length: 24 }, () => adtsFrame(200)));

    assert.equal(Number(measureAdtsDurationSeconds(audio).toFixed(6)), 1.024);
  });

  it('is unaffected by how large the frames are', () => {
    const small = Buffer.concat(Array.from({ length: 10 }, () => adtsFrame(120)));
    const large = Buffer.concat(Array.from({ length: 10 }, () => adtsFrame(900)));

    assert.equal(measureAdtsDurationSeconds(small), measureAdtsDurationSeconds(large));
  });

  it('answers zero rather than a wrong number for audio it cannot read', () => {
    assert.equal(measureAdtsDurationSeconds(Buffer.alloc(0)), 0);
    assert.equal(measureAdtsDurationSeconds(Buffer.from('not audio at all')), 0);
  });

  it('does not spin on a frame that claims no length', () => {
    const broken = adtsFrame(0);

    assert.equal(measureAdtsDurationSeconds(broken), 0);
  });
});

describe('withHlsTimestamp', () => {
  it('puts a readable ID3 tag in front of the audio', () => {
    const audio = adtsFrame(200);
    const stamped = withHlsTimestamp(audio, 12.5);

    assert.equal(stamped.subarray(0, 3).toString('latin1'), 'ID3');
    assert.ok(stamped.includes('com.apple.streaming.transportStreamTimestamp'));
    // The audio itself is untouched and still follows the tag.
    assert.ok(stamped.subarray(stamped.length - audio.length).equals(audio));
  });

  it('writes the start time in 90kHz ticks', () => {
    const stamped = withHlsTimestamp(adtsFrame(200), 2);
    const ownerEnd = stamped.indexOf('com.apple.streaming.transportStreamTimestamp') +
      'com.apple.streaming.transportStreamTimestamp'.length + 1;

    assert.equal(stamped.readBigUInt64BE(ownerEnd), BigInt(180000));
  });

  it('never writes a negative time', () => {
    const stamped = withHlsTimestamp(adtsFrame(200), -5);
    const ownerEnd = stamped.indexOf('com.apple.streaming.transportStreamTimestamp') +
      'com.apple.streaming.transportStreamTimestamp'.length + 1;

    assert.equal(stamped.readBigUInt64BE(ownerEnd), BigInt(0));
  });
});

describe('buildHlsEventPlaylist', () => {
  it('writes a playlist a player can start on', () => {
    const playlist = buildHlsEventPlaylist({
      isComplete: false,
      segments: [{ durationSeconds: 8.5, url: 'https://example.test/0.aac' }]
    });

    assert.equal(playlist.split('\n')[0], '#EXTM3U');
    assert.ok(playlist.includes('#EXT-X-PLAYLIST-TYPE:EVENT'));
    assert.ok(playlist.includes('#EXTINF:8.500,'));
    assert.ok(playlist.includes('https://example.test/0.aac'));
  });

  it('leaves the playlist open while the reading is still being made', () => {
    // Ending it early truncates the recording for everybody listening.
    const playlist = buildHlsEventPlaylist({
      isComplete: false,
      segments: [{ durationSeconds: 3, url: 'https://example.test/0.aac' }]
    });

    assert.ok(!playlist.includes('#EXT-X-ENDLIST'));
  });

  it('closes the playlist when the reading is finished', () => {
    // Never closing it leaves the player polling for ever.
    const playlist = buildHlsEventPlaylist({
      isComplete: true,
      segments: [{ durationSeconds: 3, url: 'https://example.test/0.aac' }]
    });

    assert.ok(playlist.trimEnd().endsWith('#EXT-X-ENDLIST'));
  });

  it('sets the target duration from the longest segment', () => {
    const playlist = buildHlsEventPlaylist({
      isComplete: true,
      segments: [
        { durationSeconds: 4.2, url: 'https://example.test/0.aac' },
        { durationSeconds: 11.9, url: 'https://example.test/1.aac' }
      ]
    });

    assert.ok(playlist.includes('#EXT-X-TARGETDURATION:12'));
  });

  it('keeps the segments in playback order', () => {
    const playlist = buildHlsEventPlaylist({
      isComplete: true,
      segments: [
        { durationSeconds: 1, url: 'https://example.test/0.aac' },
        { durationSeconds: 1, url: 'https://example.test/1.aac' },
        { durationSeconds: 1, url: 'https://example.test/2.aac' }
      ]
    });

    const urls = playlist.split('\n').filter((line) => line.startsWith('https://'));

    assert.deepEqual(urls, [
      'https://example.test/0.aac',
      'https://example.test/1.aac',
      'https://example.test/2.aac'
    ]);
  });
});
