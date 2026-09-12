# Saved transcript read-aloud

Plan of record, rewritten after the first attempt shipped broken.

## What the first attempt got wrong

It split the transcript, rendered each part separately and stitched them. It
shipped with four faults, and they are worth writing down because three of them
were mine and one was the approach's.

### 1. It repeated text at every seam

```ts
const first = splitTextForSpeech(cleaned, firstPartCharacters)[0];
const remainder = cleaned.slice(first.length).trim();   // wrong
```

`splitTextForSpeech` **rebuilds** the text it returns — it trims each block and
rejoins with `\n\n`. So the string it hands back is shorter than the span it came
from, and slicing by its length starts too early. Measured on a real transcript:

- part 0 ended `"...Raymond Lopez is a Chicago alderman."`
- part 1 began `"rman."`

The test that should have caught this generated its input with
`Array.from(...).join('\n\n')` — tidy text that round-trips perfectly. It tested
the formatter's own output, not a transcript.

**The rule: never locate a piece of text by the length of a rewritten copy of
it. Split by offsets into the original string and slice the original.**

### 2. It played parts out of order

The finish handler read the current part number from React state inside an
effect keyed only on `didJustFinish`. That closure captures the number as it was
when the effect was set up, so it could advance from a stale index and replay a
part that had already been heard.

**The rule: anything a player callback reads after the fact comes from a ref.**

### 3. It failed halfway and said "Retry needed"

The parts were produced in a background task after the response had been sent.
The Cloud Run service has **no `cpu-throttling` annotation**, which means CPU
outside a request is throttled to near zero. A short burst survives that; a long
sequential loop does not.

**The rule: work that must finish happens inside a request. The service's
timeout is an hour, so there is no reason to orphan it.**

### 4. It sounded stitched, and always would have

Each piece was rendered with no knowledge of its neighbours, so the reader
started cold every time and reset its tone at every join. Position hints helped
a little; they were not the fix.

## What the platforms that do this well actually do

ElevenLabs' own guidance for long-form: **split the text, stream the audio, and
pass `previous_text` / `next_text` across the joins so prosody flows between
chunks.** The splitting is not the mistake. Rendering each piece in ignorance of
its neighbours is.

OpenAI's speech endpoint streams over chunked transfer encoding, and recommends
`wav` or `pcm` over `mp3` when time-to-first-byte matters.

**But the phone cannot consume a live stream.** `expo-audio` plays a URL that
resolves to a complete audio file; playing bytes as they arrive needs a native
module or `react-native-track-player`, and adding a native module here means a
CocoaPods step that has already caused one silent iOS launch failure in this
project. That is not a trade worth making for this screen.

So: parts, done properly.

## The design

### Splitting

By **offset into the original string**, never by re-measuring rewritten text.
Each part records where it starts and ends, and the text is `source.slice(start,
end)`. Rejoining every part must reproduce the source exactly — that is the test.

### Prosody across joins

Each part is rendered with the tail of the part before it and the head of the
part after it supplied as context, marked as *not to be read*. This is the
technique ElevenLabs documents for long-form, and it is what makes consecutive
pieces sound like one person rather than a dozen cold starts.

### Production happens inside a request

The phone drives it:

```
  POST .../read-aloud            → holds the request open, makes part 0, returns it
  POST .../read-aloud?after=0    → holds the request open, makes part 1, returns it
  POST .../read-aloud?after=1    → ...
```

Each part is produced with CPU allocated for the whole of its own request, so
nothing is starved and nothing is orphaned. A part that fails fails one request,
which the phone can retry on its own without the person ever seeing the word
"retry".

### Playback is gapless

Two players, ping-ponging. Part *n+1* is loaded while part *n* is playing, and
started the instant *n* ends. One player swapping its source leaves an audible
hole at every join, which is the other half of the stitched feeling.

### Nobody is shown a failure they did not cause

"Retry needed" was the artifact's status leaking into the interface. A part that
fails is retried behind the scenes. Only when a reading genuinely cannot be
produced does the screen say anything, and then it says what to do about it.

## Order of work

1. Splitting by offsets, with a test built from **real transcript whitespace**,
   not from tidy generated text.
2. The per-request endpoint.
3. Prosody context across joins.
4. Two-player gapless handover.
5. Remove the failure wording from the screen.

## What is deliberately not being done

- **A native streaming player.** True byte-level streaming would start sound a
  few hundred milliseconds sooner and costs a native module, a CocoaPods step
  and a class of iOS launch failure this project has already hit once.
- **Switching TTS provider.** The model in use honours delivery instructions and
  is not the problem. The problem was rendering pieces in ignorance of each
  other.
