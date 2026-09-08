import { describe, expect, it } from 'vitest';
import {
  applyCropAspect,
  buildArrowPath,
  buildLinePath,
  buildStrokePath,
  canRedo,
  canUndo,
  clampCrop,
  commitHistory,
  commitPreviewedChange,
  createHistory,
  createPhotoEditorState,
  findCropHandle,
  hitTestText,
  isCropCornerHandle,
  isPhotoEditorStateEdited,
  moveCrop,
  redoHistory,
  resizeCrop,
  rotateClockwise,
  toNormalizedPoint,
  toPixelCrop,
  type PhotoEditorState,
  undoHistory
} from './photoEditorModel';

describe('photo editor model', () => {
  describe('coordinates', () => {
    it('normalizes a touch against the canvas', () => {
      expect(toNormalizedPoint(50, 25, 100, 100)).toEqual({ x: 0.5, y: 0.25 });
    });

    it('keeps a touch that leaves the canvas inside the image', () => {
      expect(toNormalizedPoint(-20, 500, 100, 100)).toEqual({ x: 0, y: 1 });
    });

    it('survives a canvas that has not been measured yet', () => {
      expect(toNormalizedPoint(10, 10, 0, 0)).toEqual({ x: 0, y: 0 });
    });
  });

  describe('strokes', () => {
    it('draws a dot for a single tap', () => {
      expect(buildStrokePath([{ x: 0.5, y: 0.5 }], 200, 200)).toContain('M100 100');
    });

    it('smooths a dragged line instead of joining raw samples', () => {
      const path = buildStrokePath(
        [{ x: 0, y: 0 }, { x: 0.5, y: 0.5 }, { x: 1, y: 1 }],
        100,
        100
      );

      expect(path).toContain('Q');
    });

    it('produces nothing for an empty stroke', () => {
      expect(buildStrokePath([], 100, 100)).toBe('');
    });
  });

  describe('crop', () => {
    it('keeps a crop inside the image', () => {
      expect(clampCrop({ height: 0.5, width: 0.5, x: 0.9, y: 0.9 }))
        .toEqual({ height: 0.5, width: 0.5, x: 0.5, y: 0.5 });
    });

    it('refuses a crop too small to grab', () => {
      const crop = clampCrop({ height: 0.001, width: 0.001, x: 0.5, y: 0.5 });

      expect(crop.width).toBeGreaterThan(0.01);
      expect(crop.height).toBeGreaterThan(0.01);
    });

    it('makes a square crop square on a landscape photo', () => {
      // 2:1 image, asking for 1:1 — the crop should be half the width.
      const crop = applyCropAspect(1, 2);

      expect(crop.width).toBeCloseTo(0.5, 5);
      expect(crop.height).toBeCloseTo(1, 5);
      expect(crop.x).toBeCloseTo(0.25, 5);
    });

    it('makes a square crop square on a portrait photo', () => {
      const crop = applyCropAspect(1, 0.5);

      expect(crop.height).toBeCloseTo(0.5, 5);
      expect(crop.width).toBeCloseTo(1, 5);
      expect(crop.y).toBeCloseTo(0.25, 5);
    });

    it('centres every aspect crop', () => {
      const crop = applyCropAspect(16 / 9, 1);

      expect(crop.x).toBeCloseTo((1 - crop.width) / 2, 5);
      expect(crop.y).toBeCloseTo((1 - crop.height) / 2, 5);
    });

    it('returns the whole image for a free crop', () => {
      expect(applyCropAspect(null, 1.5)).toEqual({ height: 1, width: 1, x: 0, y: 0 });
    });

    it('converts to pixels for the image manipulator', () => {
      expect(toPixelCrop({ height: 0.5, width: 0.5, x: 0.25, y: 0.25 }, 1000, 800))
        .toEqual({ height: 400, originX: 250, originY: 200, width: 500 });
    });

    it('never produces a rectangle that runs past the image edge', () => {
      const pixels = toPixelCrop({ height: 1, width: 1, x: 0.999, y: 0.999 }, 100, 100);

      expect(pixels.originX + pixels.width).toBeLessThanOrEqual(100);
      expect(pixels.originY + pixels.height).toBeLessThanOrEqual(100);
    });
  });

  describe('rotation', () => {
    it('cycles through four quarter turns', () => {
      expect(rotateClockwise(0)).toBe(90);
      expect(rotateClockwise(90)).toBe(180);
      expect(rotateClockwise(180)).toBe(270);
      expect(rotateClockwise(270)).toBe(0);
    });
  });

  describe('edited state', () => {
    it('treats an untouched photo as unedited', () => {
      expect(isPhotoEditorStateEdited(createPhotoEditorState())).toBe(false);
    });

    it('notices a rotation', () => {
      expect(isPhotoEditorStateEdited({ ...createPhotoEditorState(), rotation: 90 })).toBe(true);
    });

    it('notices a crop', () => {
      expect(isPhotoEditorStateEdited({
        ...createPhotoEditorState(),
        crop: { height: 0.5, width: 0.5, x: 0, y: 0 }
      })).toBe(true);
    });
  });

  describe('undo history', () => {
    const withRotation = (rotation: PhotoEditorState['rotation']): PhotoEditorState => ({
      ...createPhotoEditorState(),
      rotation
    });

    it('starts with nothing to undo or redo', () => {
      const history = createHistory();

      expect(canUndo(history)).toBe(false);
      expect(canRedo(history)).toBe(false);
    });

    it('steps back to the previous state', () => {
      const history = commitHistory(createHistory(), withRotation(90));

      expect(undoHistory(history).present.rotation).toBe(0);
    });

    it('redoes what was undone', () => {
      const history = undoHistory(commitHistory(createHistory(), withRotation(90)));

      expect(redoHistory(history).present.rotation).toBe(90);
    });

    it('drops the redone branch once a new edit is made', () => {
      const undone = undoHistory(commitHistory(createHistory(), withRotation(90)));
      const diverged = commitHistory(undone, withRotation(180));

      expect(canRedo(diverged)).toBe(false);
      expect(diverged.present.rotation).toBe(180);
    });

    it('does nothing when there is nothing to undo', () => {
      const history = createHistory();

      expect(undoHistory(history)).toBe(history);
      expect(redoHistory(history)).toBe(history);
    });

    it('bounds the history so a long session cannot grow without limit', () => {
      let history = createHistory();

      for (let index = 0; index < 200; index += 1) {
        history = commitHistory(history, withRotation(index % 2 === 0 ? 90 : 180));
      }

      expect(history.past.length).toBeLessThanOrEqual(40);
    });
  });
});

describe('resizeCrop — free cropping', () => {
  const full = { height: 1, width: 1, x: 0, y: 0 };

  it('moves only the edges the handle holds', () => {
    const next = resizeCrop(full, 'topLeft', 0.2, 0.1, null);

    expect(next.x).toBeCloseTo(0.2);
    expect(next.y).toBeCloseTo(0.1);
    // The opposite corner must not have moved.
    expect(next.x + next.width).toBeCloseTo(1);
    expect(next.y + next.height).toBeCloseTo(1);
  });

  it('leaves three edges alone when a side handle is dragged', () => {
    const next = resizeCrop(full, 'right', -0.3, 0, null);

    expect(next.x).toBeCloseTo(0);
    expect(next.y).toBeCloseTo(0);
    expect(next.height).toBeCloseTo(1);
    expect(next.width).toBeCloseTo(0.7);
  });

  it('lets each corner move independently rather than keeping a ratio', () => {
    const narrow = resizeCrop(full, 'bottomRight', -0.6, -0.1, null);

    // Free cropping means width and height are unrelated. If a ratio were being
    // held, these would have shrunk together.
    expect(narrow.width).toBeCloseTo(0.4);
    expect(narrow.height).toBeCloseTo(0.9);
  });

  it('stops at the minimum instead of inverting the frame', () => {
    const next = resizeCrop(full, 'topLeft', 5, 5, null);

    expect(next.width).toBeGreaterThan(0);
    expect(next.height).toBeGreaterThan(0);
    expect(next.x + next.width).toBeLessThanOrEqual(1.0001);
    expect(next.y + next.height).toBeLessThanOrEqual(1.0001);
  });

  it('never leaves the image', () => {
    const next = resizeCrop({ height: 0.5, width: 0.5, x: 0.4, y: 0.4 }, 'bottomRight', 3, 3, null);

    expect(next.x).toBeGreaterThanOrEqual(0);
    expect(next.y).toBeGreaterThanOrEqual(0);
    expect(next.x + next.width).toBeLessThanOrEqual(1.0001);
    expect(next.y + next.height).toBeLessThanOrEqual(1.0001);
  });

  it('holds the ratio when an aspect is locked', () => {
    const next = resizeCrop(full, 'bottomRight', -0.5, 0, 1);

    expect(next.width / next.height).toBeCloseTo(1, 2);
  });

  it('pins the opposite corner while holding a ratio', () => {
    const start = { height: 0.8, width: 0.8, x: 0.1, y: 0.1 };
    const next = resizeCrop(start, 'topLeft', 0.2, 0.2, 1);

    expect(next.x + next.width).toBeCloseTo(0.9, 5);
    expect(next.y + next.height).toBeCloseTo(0.9, 5);
  });
});

describe('moveCrop', () => {
  it('slides the frame without resizing it', () => {
    const next = moveCrop({ height: 0.4, width: 0.4, x: 0.1, y: 0.1 }, 0.2, 0.3);

    expect(next.width).toBeCloseTo(0.4);
    expect(next.height).toBeCloseTo(0.4);
    expect(next.x).toBeCloseTo(0.3);
    expect(next.y).toBeCloseTo(0.4);
  });

  it('stops at the edge rather than sliding off the image', () => {
    const next = moveCrop({ height: 0.4, width: 0.4, x: 0.1, y: 0.1 }, 5, 5);

    expect(next.x + next.width).toBeLessThanOrEqual(1.0001);
    expect(next.y + next.height).toBeLessThanOrEqual(1.0001);
  });
});

describe('isCropCornerHandle', () => {
  it('separates corners from side handles', () => {
    expect(isCropCornerHandle('topLeft')).toBe(true);
    expect(isCropCornerHandle('bottomRight')).toBe(true);
    expect(isCropCornerHandle('top')).toBe(false);
    expect(isCropCornerHandle('left')).toBe(false);
  });
});

describe('buildArrowPath', () => {
  const shape = {
    color: '#fff',
    from: { x: 0, y: 0.5 },
    id: 'a',
    kind: 'arrow' as const,
    to: { x: 1, y: 0.5 },
    width: 8
  };

  it('draws a head and a line', () => {
    const { head, line } = buildArrowPath(shape, 200, 100);

    expect(head).toContain('Z');
    expect(line.startsWith('M 0 50')).toBe(true);
  });

  it('stops the line short of the tip so the head stays sharp', () => {
    const { line } = buildArrowPath(shape, 200, 100);
    const endX = Number(line.split('L ')[1].split(' ')[0]);

    expect(endX).toBeLessThan(200);
    expect(endX).toBeGreaterThan(150);
  });

  it('returns nothing for a zero-length drag', () => {
    const { head, line } = buildArrowPath(
      { ...shape, to: { x: 0, y: 0.5 } },
      200,
      100
    );

    expect(head).toBe('');
    expect(line).toBe('');
  });

  it('points the head along the drag direction', () => {
    const down = buildArrowPath(
      { ...shape, from: { x: 0.5, y: 0 }, to: { x: 0.5, y: 1 } },
      200,
      100
    );

    expect(down.head.startsWith('M 100 100')).toBe(true);
  });
});

describe('buildLinePath', () => {
  it('joins the two endpoints', () => {
    const path = buildLinePath(
      { color: '#fff', from: { x: 0, y: 0 }, id: 'l', kind: 'line', to: { x: 1, y: 1 }, width: 4 },
      200,
      100
    );

    expect(path).toBe('M 0 0 L 200 100');
  });
});

describe('hitTestText', () => {
  const label = {
    color: '#fff',
    id: 'text-1',
    position: { x: 0.5, y: 0.5 },
    size: 30,
    value: 'Check this'
  };

  it('finds a label under the touch', () => {
    expect(hitTestText([label], { x: 0.5, y: 0.5 }, 400, 400)?.id).toBe('text-1');
  });

  it('ignores a touch well away from every label', () => {
    expect(hitTestText([label], { x: 0.05, y: 0.05 }, 400, 400)).toBeNull();
  });

  it('picks the label drawn on top when two overlap', () => {
    const top = { ...label, id: 'text-2' };

    expect(hitTestText([label, top], { x: 0.5, y: 0.5 }, 400, 400)?.id).toBe('text-2');
  });

  it('returns nothing before the surface has been measured', () => {
    expect(hitTestText([label], { x: 0.5, y: 0.5 }, 0, 0)).toBeNull();
  });
});

describe('shapes count as edits', () => {
  it('treats an arrow as an edit', () => {
    const state = createPhotoEditorState();

    expect(isPhotoEditorStateEdited(state)).toBe(false);
    expect(isPhotoEditorStateEdited({
      ...state,
      shapes: [{
        color: '#fff',
        from: { x: 0, y: 0 },
        id: 'a',
        kind: 'arrow',
        to: { x: 1, y: 1 },
        width: 6
      }]
    })).toBe(true);
  });
});

describe('findCropHandle', () => {
  const crop = { height: 0.6, width: 0.6, x: 0.2, y: 0.2 };
  const size = 400;

  it('grabs a corner that is touched', () => {
    // 0.2 * 400 = 80, the top-left corner of the frame.
    expect(findCropHandle({ x: 0.2, y: 0.2 }, crop, size, size)).toBe('topLeft');
    expect(findCropHandle({ x: 0.8, y: 0.8 }, crop, size, size)).toBe('bottomRight');
  });

  it('prefers the corner when a side handle is also in range', () => {
    expect(findCropHandle({ x: 0.21, y: 0.2 }, crop, size, size)).toBe('topLeft');
  });

  it('grabs a side away from the corners', () => {
    expect(findCropHandle({ x: 0.2, y: 0.5 }, crop, size, size)).toBe('left');
    expect(findCropHandle({ x: 0.5, y: 0.8 }, crop, size, size)).toBe('bottom');
  });

  it('reads a touch inside the frame as a move', () => {
    expect(findCropHandle({ x: 0.5, y: 0.5 }, crop, size, size)).toBe('move');
  });

  it('ignores a touch well outside the frame', () => {
    expect(findCropHandle({ x: 0.01, y: 0.01 }, crop, size, size)).toBeNull();
  });

  it('reaches handles that sit outside the frame edge', () => {
    // The whole point: a touch just beyond the frame still grabs the handle,
    // which a view clipped to the frame's bounds could never receive.
    expect(findCropHandle({ x: 0.18, y: 0.18 }, crop, size, size)).toBe('topLeft');
  });

  it('returns nothing before the surface has been measured', () => {
    expect(findCropHandle({ x: 0.5, y: 0.5 }, crop, 0, 0)).toBeNull();
  });
});

describe('commitPreviewedChange', () => {
  it('makes one drag undo back to where the drag started', () => {
    const before = createPhotoEditorState();
    const dragged = { ...before, crop: { height: 0.5, width: 0.5, x: 0.1, y: 0.1 } };
    // A drag previews straight onto present without touching history.
    const previewing = { ...createHistory(before), present: dragged };
    const committed = commitPreviewedChange(previewing, before);

    expect(canUndo(committed)).toBe(true);
    // The bug this guards: committing present onto itself records the dragged
    // frame as its own predecessor, so the first undo changes nothing.
    expect(undoHistory(committed).present.crop).toEqual(before.crop);
  });

  it('drops the redo branch, like any other edit', () => {
    const before = createPhotoEditorState();
    const previewing = {
      future: [before],
      past: [],
      present: { ...before, rotation: 90 as const }
    };

    expect(commitPreviewedChange(previewing, before).future).toEqual([]);
  });

  it('does nothing when the drag moved nothing', () => {
    const history = createHistory();

    expect(commitPreviewedChange(history, history.present)).toBe(history);
  });

  it('stays bounded over a long editing session', () => {
    let history = createHistory();

    for (let index = 0; index < 60; index += 1) {
      const baseline = history.present;

      history = commitPreviewedChange(
        { ...history, present: { ...baseline, rotation: 90 } },
        baseline
      );
    }

    expect(history.past.length).toBeLessThanOrEqual(40);
  });
});
