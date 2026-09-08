/**
 * The editing model behind the Synzapp photo editor.
 *
 * Everything here is pure so the parts that are easy to get subtly wrong — crop
 * geometry, aspect ratios, undo — can be tested directly rather than only being
 * discovered by eye on a device.
 *
 * Coordinates are normalized to 0..1 against the image, never pixels. The same
 * annotation then renders correctly on a thumbnail, on a full-screen canvas, and
 * in the exported file, without a scale factor threaded through every call.
 */

export type PhotoEditorTool = 'arrow' | 'crop' | 'draw' | 'line' | 'text';

export interface PhotoEditorPoint {
  x: number;
  y: number;
}

export interface PhotoEditorStroke {
  color: string;
  id: string;
  points: PhotoEditorPoint[];
  width: number;
}

export interface PhotoEditorText {
  color: string;
  id: string;
  /** Normalized centre of the label. */
  position: PhotoEditorPoint;
  size: number;
  value: string;
}

/**
 * A straight annotation — a line or an arrow.
 *
 * Held as two endpoints rather than a list of points, so it can be redrawn
 * exactly while the user is still dragging it out and nudged afterwards without
 * resampling anything.
 */
export interface PhotoEditorShape {
  color: string;
  from: PhotoEditorPoint;
  id: string;
  kind: 'arrow' | 'line';
  to: PhotoEditorPoint;
  width: number;
}

export interface PhotoEditorCrop {
  height: number;
  width: number;
  x: number;
  y: number;
}

export interface PhotoEditorState {
  crop: PhotoEditorCrop;
  rotation: 0 | 90 | 180 | 270;
  shapes: PhotoEditorShape[];
  strokes: PhotoEditorStroke[];
  texts: PhotoEditorText[];
}

export const FULL_CROP: PhotoEditorCrop = { height: 1, width: 1, x: 0, y: 0 };

/** Small enough to allow a tight crop, large enough that handles stay grabbable. */
const MIN_CROP_SIZE = 0.08;

export function createPhotoEditorState(): PhotoEditorState {
  return {
    crop: FULL_CROP,
    rotation: 0,
    shapes: [],
    strokes: [],
    texts: []
  };
}

export function isPhotoEditorStateEdited(state: PhotoEditorState): boolean {
  return state.rotation !== 0 ||
    state.shapes.length > 0 ||
    state.strokes.length > 0 ||
    state.texts.length > 0 ||
    !isFullCrop(state.crop);
}

export function isFullCrop(crop: PhotoEditorCrop): boolean {
  return crop.x <= 0.0001 &&
    crop.y <= 0.0001 &&
    crop.width >= 0.9999 &&
    crop.height >= 0.9999;
}

export function clampToUnit(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(Math.max(value, 0), 1);
}

/** Converts a touch inside the canvas to normalized image coordinates. */
export function toNormalizedPoint(
  x: number,
  y: number,
  canvasWidth: number,
  canvasHeight: number
): PhotoEditorPoint {
  return {
    x: clampToUnit(canvasWidth > 0 ? x / canvasWidth : 0),
    y: clampToUnit(canvasHeight > 0 ? y / canvasHeight : 0)
  };
}

/**
 * An SVG path for a freehand stroke.
 *
 * Midpoint-quadratic smoothing, which is what keeps a dragged line from looking
 * like the polyline of raw touch samples it actually is.
 */
export function buildStrokePath(
  points: PhotoEditorPoint[],
  canvasWidth: number,
  canvasHeight: number
): string {
  if (!points.length) {
    return '';
  }

  const toCanvas = (point: PhotoEditorPoint) => ({
    x: point.x * canvasWidth,
    y: point.y * canvasHeight
  });

  const first = toCanvas(points[0]);

  if (points.length === 1) {
    // A tap is a dot. Without this, tapping the canvas draws nothing.
    return `M${first.x} ${first.y} L${first.x + 0.01} ${first.y}`;
  }

  let path = `M${first.x} ${first.y}`;

  for (let index = 1; index < points.length - 1; index += 1) {
    const current = toCanvas(points[index]);
    const next = toCanvas(points[index + 1]);
    const midX = (current.x + next.x) / 2;
    const midY = (current.y + next.y) / 2;

    path += ` Q${current.x} ${current.y} ${midX} ${midY}`;
  }

  const last = toCanvas(points[points.length - 1]);

  return `${path} L${last.x} ${last.y}`;
}

/** Keeps a crop inside the image and above the minimum size. */
export function clampCrop(crop: PhotoEditorCrop): PhotoEditorCrop {
  const width = Math.min(Math.max(crop.width, MIN_CROP_SIZE), 1);
  const height = Math.min(Math.max(crop.height, MIN_CROP_SIZE), 1);

  return {
    height,
    width,
    x: Math.min(Math.max(crop.x, 0), 1 - width),
    y: Math.min(Math.max(crop.y, 0), 1 - height)
  };
}

/**
 * Fits the largest crop of a given aspect ratio, centred.
 *
 * `aspect` is width divided by height *of the displayed image*, so the caller
 * passes the on-screen ratio and gets a crop that looks square when it should.
 */
export function applyCropAspect(
  aspect: number | null,
  imageAspect: number
): PhotoEditorCrop {
  if (!aspect || !Number.isFinite(aspect) || aspect <= 0 || imageAspect <= 0) {
    return FULL_CROP;
  }

  // Normalized space is a unit square, so the target ratio has to be expressed
  // relative to the image's own ratio before it means anything.
  const relative = aspect / imageAspect;

  if (relative >= 1) {
    const height = 1 / relative;

    return clampCrop({ height, width: 1, x: 0, y: (1 - height) / 2 });
  }

  return clampCrop({ height: 1, width: relative, x: (1 - relative) / 2, y: 0 });
}

/** Converts a normalized crop to the pixel rectangle an image manipulator wants. */
export function toPixelCrop(
  crop: PhotoEditorCrop,
  imageWidth: number,
  imageHeight: number
): { height: number; originX: number; originY: number; width: number } {
  const safeCrop = clampCrop(crop);
  const originX = Math.round(safeCrop.x * imageWidth);
  const originY = Math.round(safeCrop.y * imageHeight);

  return {
    // Never let rounding push the rectangle past the edge; a crop one pixel
    // outside the image fails rather than clipping.
    height: Math.max(1, Math.min(Math.round(safeCrop.height * imageHeight), imageHeight - originY)),
    originX,
    originY,
    width: Math.max(1, Math.min(Math.round(safeCrop.width * imageWidth), imageWidth - originX))
  };
}

export function rotateClockwise(rotation: PhotoEditorState['rotation']): PhotoEditorState['rotation'] {
  return ((rotation + 90) % 360) as PhotoEditorState['rotation'];
}

/**
 * Undo history.
 *
 * A bounded stack of whole states rather than a diff log. Editor states are tiny
 * — a few strokes and labels — so storing snapshots avoids an entire class of
 * inverse-operation bugs for no meaningful memory cost.
 */
/**
 * Which part of the crop frame a drag is holding.
 *
 * Corners move two edges, side handles move one. Free cropping means each of
 * those moves independently — the frame is defined by its four edges, not by a
 * ratio, which is what makes it behave like the iPhone's own cropper.
 */
export type PhotoEditorCropHandle =
  | 'bottom'
  | 'bottomLeft'
  | 'bottomRight'
  | 'left'
  | 'right'
  | 'top'
  | 'topLeft'
  | 'topRight';

export const PHOTO_EDITOR_CROP_HANDLES: PhotoEditorCropHandle[] = [
  'topLeft',
  'top',
  'topRight',
  'right',
  'bottomRight',
  'bottom',
  'bottomLeft',
  'left'
];

/** -1 moves the near edge, 1 moves the far edge, 0 leaves that axis alone. */
const CROP_HANDLE_EDGES: Record<PhotoEditorCropHandle, { x: -1 | 0 | 1; y: -1 | 0 | 1 }> = {
  bottom: { x: 0, y: 1 },
  bottomLeft: { x: -1, y: 1 },
  bottomRight: { x: 1, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  top: { x: 0, y: -1 },
  topLeft: { x: -1, y: -1 },
  topRight: { x: 1, y: -1 }
};

export function isCropCornerHandle(handle: PhotoEditorCropHandle): boolean {
  const edge = CROP_HANDLE_EDGES[handle];

  return edge.x !== 0 && edge.y !== 0;
}

/**
 * Moves one handle of the crop frame.
 *
 * The edges the handle does not hold stay exactly where they were, so dragging a
 * corner pins the opposite corner and dragging a side leaves the other three
 * alone. That is the whole of free cropping.
 *
 * `aspect` locks the frame to a ratio when a preset is chosen, and is null for
 * free cropping. It is expressed in the same normalized space as the crop, so
 * the caller has already divided out the image's own ratio.
 */
export function resizeCrop(
  start: PhotoEditorCrop,
  handle: PhotoEditorCropHandle,
  dx: number,
  dy: number,
  aspect: number | null = null
): PhotoEditorCrop {
  const edge = CROP_HANDLE_EDGES[handle];

  let left = start.x;
  let top = start.y;
  let right = start.x + start.width;
  let bottom = start.y + start.height;

  if (edge.x < 0) {
    left = clampToUnit(left + dx);
  } else if (edge.x > 0) {
    right = clampToUnit(right + dx);
  }

  if (edge.y < 0) {
    top = clampToUnit(top + dy);
  } else if (edge.y > 0) {
    bottom = clampToUnit(bottom + dy);
  }

  // A handle dragged past the opposite edge would invert the frame. Stop it at
  // the minimum instead, so the frame shrinks to a floor rather than flipping.
  if (right - left < MIN_CROP_SIZE) {
    if (edge.x < 0) {
      left = right - MIN_CROP_SIZE;
    } else if (edge.x > 0) {
      right = left + MIN_CROP_SIZE;
    }
  }

  if (bottom - top < MIN_CROP_SIZE) {
    if (edge.y < 0) {
      top = bottom - MIN_CROP_SIZE;
    } else if (edge.y > 0) {
      bottom = top + MIN_CROP_SIZE;
    }
  }

  if (aspect && aspect > 0) {
    const anchorX = edge.x < 0 ? right : left;
    const anchorY = edge.y < 0 ? bottom : top;

    if (edge.x === 0) {
      // A top or bottom handle sets the height; the width follows from the
      // ratio and grows either side of where it already was.
      const width = (bottom - top) * aspect;
      const centreX = (left + right) / 2;

      left = centreX - width / 2;
      right = centreX + width / 2;
    } else if (edge.y === 0) {
      const height = (right - left) / aspect;
      const centreY = (top + bottom) / 2;

      top = centreY - height / 2;
      bottom = centreY + height / 2;
    } else {
      // A corner is fitted inside the box the finger described, pinned to the
      // corner opposite the one being held.
      const width = Math.min(right - left, (bottom - top) * aspect);
      const height = width / aspect;

      left = edge.x < 0 ? anchorX - width : anchorX;
      right = left + width;
      top = edge.y < 0 ? anchorY - height : anchorY;
      bottom = top + height;
    }
  }

  return clampCrop({
    height: bottom - top,
    width: right - left,
    x: left,
    y: top
  });
}

/** Moves the whole frame without resizing it. */
export function moveCrop(start: PhotoEditorCrop, dx: number, dy: number): PhotoEditorCrop {
  return clampCrop({ ...start, x: start.x + dx, y: start.y + dy });
}

/**
 * The line and head of an arrow, in pixels.
 *
 * The line stops short of the tip so the round stroke cap does not push past the
 * point of the head and blunt it.
 */
export function buildArrowPath(
  shape: PhotoEditorShape,
  width: number,
  height: number
): { head: string; line: string } {
  const fromX = shape.from.x * width;
  const fromY = shape.from.y * height;
  const toX = shape.to.x * width;
  const toY = shape.to.y * height;
  const deltaX = toX - fromX;
  const deltaY = toY - fromY;
  const length = Math.hypot(deltaX, deltaY);

  if (length < 0.5) {
    return { head: '', line: '' };
  }

  const angle = Math.atan2(deltaY, deltaX);
  const headLength = Math.min(Math.max(shape.width * 3.4, 14), length);
  const spread = 0.44;
  const leftX = toX - headLength * Math.cos(angle - spread);
  const leftY = toY - headLength * Math.sin(angle - spread);
  const rightX = toX - headLength * Math.cos(angle + spread);
  const rightY = toY - headLength * Math.sin(angle + spread);
  const lineEnd = Math.max(0, length - headLength * 0.8);

  return {
    head: `M ${toX} ${toY} L ${leftX} ${leftY} L ${rightX} ${rightY} Z`,
    line: `M ${fromX} ${fromY} L ${fromX + Math.cos(angle) * lineEnd} ${fromY + Math.sin(angle) * lineEnd}`
  };
}

export function buildLinePath(
  shape: PhotoEditorShape,
  width: number,
  height: number
): string {
  return `M ${shape.from.x * width} ${shape.from.y * height} L ${shape.to.x * width} ${shape.to.y * height}`;
}

/**
 * The label under a touch, if any.
 *
 * SVG text cannot be measured without rendering it, so the box is estimated from
 * the glyph count and font size. It only has to be close enough to grab, and it
 * is deliberately generous — a label that is slightly hard to miss is better
 * than one that is hard to hit.
 */
export function hitTestText(
  texts: PhotoEditorText[],
  point: PhotoEditorPoint,
  width: number,
  height: number
): PhotoEditorText | null {
  if (!width || !height) {
    return null;
  }

  const touchX = point.x * width;
  const touchY = point.y * height;

  // Later labels are drawn on top, so they are tested first.
  for (let index = texts.length - 1; index >= 0; index -= 1) {
    const label = texts[index];
    const boxWidth = Math.max(label.value.length * label.size * 0.58, label.size);
    const boxHeight = label.size * 1.5;
    const centreX = label.position.x * width;
    const centreY = label.position.y * height;

    if (
      Math.abs(touchX - centreX) <= boxWidth / 2 + 8 &&
      Math.abs(touchY - centreY) <= boxHeight / 2 + 8
    ) {
      return label;
    }
  }

  return null;
}

/**
 * What a touch on the crop frame is grabbing.
 *
 * Hit testing happens here, against the frame's geometry, rather than by putting
 * a touchable view on each handle. Handles have to sit half outside the frame to
 * look right, and a view cannot receive touches outside its parent's bounds — so
 * handle-shaped views look correct and are only half grabbable, which is exactly
 * how a crop frame ends up feeling broken.
 *
 * Distances are in pixels because the grab radius is about fingers, not about
 * the image.
 */
export function findCropHandle(
  touch: PhotoEditorPoint,
  crop: PhotoEditorCrop,
  width: number,
  height: number,
  grabRadius = 32
): PhotoEditorCropHandle | 'move' | null {
  if (!width || !height) {
    return null;
  }

  const touchX = touch.x * width;
  const touchY = touch.y * height;
  const left = crop.x * width;
  const top = crop.y * height;
  const right = (crop.x + crop.width) * width;
  const bottom = (crop.y + crop.height) * height;

  const corners: Array<[PhotoEditorCropHandle, number, number]> = [
    ['topLeft', left, top],
    ['topRight', right, top],
    ['bottomLeft', left, bottom],
    ['bottomRight', right, bottom]
  ];

  // Corners win over sides: at a corner both side handles are also in range, and
  // resizing two edges is almost always what was meant.
  let nearestCorner: PhotoEditorCropHandle | null = null;
  let nearestDistance = grabRadius;

  corners.forEach(([handle, cornerX, cornerY]) => {
    const distance = Math.hypot(touchX - cornerX, touchY - cornerY);

    if (distance <= nearestDistance) {
      nearestCorner = handle;
      nearestDistance = distance;
    }
  });

  if (nearestCorner) {
    return nearestCorner;
  }

  const withinRows = touchY >= top - grabRadius && touchY <= bottom + grabRadius;
  const withinColumns = touchX >= left - grabRadius && touchX <= right + grabRadius;

  if (withinRows && Math.abs(touchX - left) <= grabRadius) {
    return 'left';
  }

  if (withinRows && Math.abs(touchX - right) <= grabRadius) {
    return 'right';
  }

  if (withinColumns && Math.abs(touchY - top) <= grabRadius) {
    return 'top';
  }

  if (withinColumns && Math.abs(touchY - bottom) <= grabRadius) {
    return 'bottom';
  }

  if (touchX >= left && touchX <= right && touchY >= top && touchY <= bottom) {
    return 'move';
  }

  return null;
}

export interface PhotoEditorHistory {
  future: PhotoEditorState[];
  past: PhotoEditorState[];
  present: PhotoEditorState;
}

const MAX_HISTORY = 40;

export function createHistory(present = createPhotoEditorState()): PhotoEditorHistory {
  return { future: [], past: [], present };
}

export function commitHistory(
  history: PhotoEditorHistory,
  present: PhotoEditorState
): PhotoEditorHistory {
  return {
    // A new action makes any redone-away branch unreachable.
    future: [],
    past: [...history.past, history.present].slice(-MAX_HISTORY),
    present
  };
}

/**
 * Closes a drag that has been previewing straight onto `present`.
 *
 * Dragging a crop handle or a label updates `present` on every finger move so
 * the frame tracks the finger, deliberately without touching history — one drag
 * should be one undo, not one per pixel. That leaves the state before the drag
 * nowhere in history, so it has to be handed back here to be pushed.
 *
 * Committing `present` onto itself instead would record the dragged frame as its
 * own predecessor, and the first undo would appear to do nothing.
 */
export function commitPreviewedChange(
  history: PhotoEditorHistory,
  baseline: PhotoEditorState
): PhotoEditorHistory {
  if (history.present === baseline) {
    return history;
  }

  return {
    future: [],
    past: [...history.past, baseline].slice(-MAX_HISTORY),
    present: history.present
  };
}

export function undoHistory(history: PhotoEditorHistory): PhotoEditorHistory {
  if (!history.past.length) {
    return history;
  }

  const previous = history.past[history.past.length - 1];

  return {
    future: [history.present, ...history.future].slice(0, MAX_HISTORY),
    past: history.past.slice(0, -1),
    present: previous
  };
}

export function redoHistory(history: PhotoEditorHistory): PhotoEditorHistory {
  if (!history.future.length) {
    return history;
  }

  return {
    future: history.future.slice(1),
    past: [...history.past, history.present].slice(-MAX_HISTORY),
    present: history.future[0]
  };
}

export function canUndo(history: PhotoEditorHistory): boolean {
  return history.past.length > 0;
}

export function canRedo(history: PhotoEditorHistory): boolean {
  return history.future.length > 0;
}
