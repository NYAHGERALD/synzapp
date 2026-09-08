import { Feather, Ionicons } from '@expo/vector-icons';
import * as ImageManipulator from 'expo-image-manipulator';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  LayoutChangeEvent,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import Svg, { G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { captureRef } from 'react-native-view-shot';
import { useAppTheme } from '../../theme/AppThemeProvider';
import type { AppColors } from '../../theme/colors';
import {
  applyCropAspect,
  buildArrowPath,
  buildLinePath,
  buildStrokePath,
  canRedo,
  canUndo,
  commitHistory,
  commitPreviewedChange,
  createHistory,
  createPhotoEditorState,
  findCropHandle,
  hitTestText,
  isFullCrop,
  isPhotoEditorStateEdited,
  moveCrop,
  redoHistory,
  resizeCrop,
  rotateClockwise,
  toNormalizedPoint,
  toPixelCrop,
  undoHistory,
  type PhotoEditorCrop,
  type PhotoEditorCropHandle,
  type PhotoEditorHistory,
  type PhotoEditorPoint,
  type PhotoEditorShape,
  type PhotoEditorState,
  type PhotoEditorStroke,
  type PhotoEditorText,
  type PhotoEditorTool
} from './photoEditorModel';

export interface SynzappPhotoEditorResult {
  caption: string;
  height: number;
  uri: string;
  width: number;
}

export interface SynzappPhotoEditorProps {
  captionPlaceholder?: string;
  fileName?: string;
  height?: number;
  isSending?: boolean;
  onCancel: () => void;
  onDone: (result: SynzappPhotoEditorResult) => void;
  showCaption?: boolean;
  sourceUri: string;
  width?: number;
}

const INK_COLORS = ['#FFFFFF', '#0B1220', '#EF4444', '#F97316', '#FACC15', '#22C55E', '#38BDF8', '#A855F7'];
const INK_WIDTHS = [4, 9, 16];
const TEXT_SIZES = [22, 30, 40];
const CROP_PRESETS: Array<{ label: string; value: number | null }> = [
  { label: 'Free', value: null },
  { label: 'Square', value: 1 },
  { label: '3:4', value: 3 / 4 },
  { label: '4:3', value: 4 / 3 },
  { label: '16:9', value: 16 / 9 }
];
const TOOLS: Array<{ icon: keyof typeof Feather.glyphMap; label: string; value: PhotoEditorTool }> = [
  { icon: 'edit-2', label: 'Draw', value: 'draw' },
  { icon: 'minus', label: 'Line', value: 'line' },
  { icon: 'arrow-up-right', label: 'Arrow', value: 'arrow' },
  { icon: 'type', label: 'Text', value: 'text' },
  { icon: 'crop', label: 'Crop', value: 'crop' }
];
/** How far a finger may travel and still count as a tap rather than a drag. */
const TAP_SLOP = 6;

type Gesture =
  | {
    baseline: PhotoEditorState;
    handle: PhotoEditorCropHandle | 'move';
    kind: 'crop';
    start: PhotoEditorCrop;
  }
  | { kind: 'draw' }
  | { kind: 'none' }
  | { kind: 'shape' }
  | {
    baseline: PhotoEditorState;
    kind: 'text';
    moved: boolean;
    origin: PhotoEditorPoint;
    textId: string;
  };

/**
 * Synzapp's photo editor.
 *
 * Scoped on purpose to what people actually do to a photo before sending it at
 * work — crop it, straighten it, point at the thing that matters, label it. That
 * scope is what lets it be built in-house: it follows the app's own theme in
 * light and dark, carries no third-party licence or watermark, and adds nothing
 * to the download size beyond what the app already ships.
 *
 * Two decisions hold the whole thing together:
 *
 * Annotations are normalized 0..1 and only rasterized on export, so the surface
 * can be any size, every edit stays undoable, and the original file is untouched
 * until the user is finished.
 *
 * Every tool — including crop and text — runs through one gesture on the surface
 * rather than a touchable per control. Overlapping touch targets were what made
 * the text tool dead and crop corners half-grabbable: a handle has to sit partly
 * outside the frame to look right, and a view cannot be touched outside its
 * parent's bounds. Handles are now drawn, and hit-tested by geometry.
 */
export function SynzappPhotoEditor({
  captionPlaceholder,
  fileName,
  height,
  isSending,
  onCancel,
  onDone,
  showCaption,
  sourceUri,
  width
}: SynzappPhotoEditorProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme.colors), [theme.colors]);

  const [history, setHistory] = useState<PhotoEditorHistory>(() => createHistory());
  const [tool, setTool] = useState<PhotoEditorTool>('draw');
  const [color, setColor] = useState(INK_COLORS[2]);
  const [inkWidth, setInkWidth] = useState(INK_WIDTHS[1]);
  const [textSize, setTextSize] = useState(TEXT_SIZES[1]);
  const [cropAspect, setCropAspect] = useState<number | null>(null);
  const [caption, setCaption] = useState('');
  const [draftStroke, setDraftStroke] = useState<PhotoEditorStroke | null>(null);
  const [draftShape, setDraftShape] = useState<PhotoEditorShape | null>(null);
  const [composer, setComposer] = useState<
    { position: PhotoEditorPoint; textId: string | null; value: string } | null
  >(null);
  const [isExporting, setIsExporting] = useState(false);
  const [area, setArea] = useState({ height: 0, width: 0 });
  const [imageSize, setImageSize] = useState(width && height ? { height, width } : null);
  const [workingUri, setWorkingUri] = useState(sourceUri);

  const surfaceRef = useRef<View | null>(null);
  const surfaceSizeRef = useRef({ height: 0, width: 0 });
  const gestureRef = useRef<Gesture>({ kind: 'none' });
  const originRef = useRef<PhotoEditorPoint>({ x: 0, y: 0 });
  const draftStrokeRef = useRef<PhotoEditorStroke | null>(null);
  const draftShapeRef = useRef<PhotoEditorShape | null>(null);
  const stateRef = useRef<PhotoEditorState>(history.present);
  const toolRef = useRef(tool);
  const inkRef = useRef({ color, textSize, width: inkWidth });
  const cropAspectRef = useRef(cropAspect);
  // A quarter turn re-encodes the photo, so each one is produced once and kept.
  // Undo then only has to restore a number.
  const rotatedUriRef = useRef<Map<number, string>>(new Map([[0, sourceUri]]));

  const state = history.present;
  const isBusy = Boolean(isSending) || isExporting;

  stateRef.current = state;
  toolRef.current = tool;
  inkRef.current = { color, textSize, width: inkWidth };
  cropAspectRef.current = cropAspect;

  // A photo the sender never opened may not carry its dimensions, and the
  // surface cannot be fitted to the image without them.
  useEffect(() => {
    if (imageSize || !sourceUri) {
      return;
    }

    let isActive = true;

    Image.getSize(
      sourceUri,
      (nextWidth, nextHeight) => isActive && setImageSize({ height: nextHeight, width: nextWidth }),
      () => isActive && setImageSize({ height: 4, width: 3 })
    );

    return () => {
      isActive = false;
    };
  }, [imageSize, sourceUri]);

  const isQuarterTurned = state.rotation === 90 || state.rotation === 270;
  const naturalWidth = Math.max(1, imageSize?.width || 3);
  const naturalHeight = Math.max(1, imageSize?.height || 4);
  const surfaceAspect = isQuarterTurned
    ? naturalHeight / naturalWidth
    : naturalWidth / naturalHeight;

  // The surface is fitted to the photo rather than the photo being letterboxed
  // inside the surface, so every normalized coordinate lands on the same part of
  // the image on screen and in the exported file.
  const surface = useMemo(() => {
    if (!area.width || !area.height) {
      return { height: 0, width: 0 };
    }

    const fitted = Math.min(area.width / surfaceAspect, area.height);

    return {
      height: Math.max(1, Math.floor(fitted)),
      width: Math.max(1, Math.floor(fitted * surfaceAspect))
    };
  }, [area.height, area.width, surfaceAspect]);

  surfaceSizeRef.current = surface;

  function commit(next: PhotoEditorState) {
    setHistory((current) => commitHistory(current, next));
  }

  /** Updates the frame mid-drag without writing history — one drag, one undo. */
  function previewCrop(crop: PhotoEditorCrop) {
    setHistory((current) => ({ ...current, present: { ...current.present, crop } }));
  }

  function handleAreaLayout(event: LayoutChangeEvent) {
    const { height: layoutHeight, width: layoutWidth } = event.nativeEvent.layout;

    setArea({ height: layoutHeight, width: layoutWidth });
  }

  /**
   * Where the finger is now.
   *
   * Taken from the grant point plus the gesture's total travel rather than each
   * move event's own coordinates: those are reported against whichever subview
   * is under the finger, which drifts as a drag crosses the overlay.
   */
  function currentPoint(dx: number, dy: number): PhotoEditorPoint {
    const size = surfaceSizeRef.current;
    const origin = originRef.current;

    return toNormalizedPoint(
      origin.x * size.width + dx,
      origin.y * size.height + dy,
      size.width,
      size.height
    );
  }

  // One responder for every tool. Built once — it reads live values from refs,
  // so it never needs rebuilding as the tool or colour changes.
  const responder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (event) => {
      const size = surfaceSizeRef.current;
      const point = toNormalizedPoint(
        event.nativeEvent.locationX,
        event.nativeEvent.locationY,
        size.width,
        size.height
      );

      originRef.current = point;
      beginGesture(point);
    },
    onPanResponderMove: (_event, gesture) => {
      continueGesture(gesture.dx, gesture.dy);
    },
    onPanResponderRelease: (_event, gesture) => {
      endGesture(gesture.dx, gesture.dy);
    },
    onPanResponderTerminate: (_event, gesture) => {
      endGesture(gesture.dx, gesture.dy);
    },
    onStartShouldSetPanResponder: () => true
  }), []);

  function beginGesture(point: PhotoEditorPoint) {
    const activeTool = toolRef.current;
    const size = surfaceSizeRef.current;
    const ink = inkRef.current;
    const current = stateRef.current;

    if (activeTool === 'crop') {
      const handle = findCropHandle(point, current.crop, size.width, size.height);

      gestureRef.current = handle
        ? { baseline: current, handle, kind: 'crop', start: current.crop }
        : { kind: 'none' };
      return;
    }

    if (activeTool === 'text') {
      const label = hitTestText(current.texts, point, size.width, size.height);

      gestureRef.current = {
        baseline: current,
        kind: 'text',
        moved: false,
        origin: label ? label.position : point,
        textId: label?.id || ''
      };
      return;
    }

    if (activeTool === 'draw') {
      const stroke: PhotoEditorStroke = {
        color: ink.color,
        id: createId('stroke'),
        points: [point],
        width: ink.width
      };

      draftStrokeRef.current = stroke;
      setDraftStroke(stroke);
      gestureRef.current = { kind: 'draw' };
      return;
    }

    const shape: PhotoEditorShape = {
      color: ink.color,
      from: point,
      id: createId(activeTool),
      kind: activeTool === 'arrow' ? 'arrow' : 'line',
      to: point,
      width: ink.width
    };

    draftShapeRef.current = shape;
    setDraftShape(shape);
    gestureRef.current = { kind: 'shape' };
  }

  function continueGesture(dx: number, dy: number) {
    const gesture = gestureRef.current;
    const point = currentPoint(dx, dy);

    if (gesture.kind === 'draw') {
      const stroke = draftStrokeRef.current;

      if (!stroke) {
        return;
      }

      const next = { ...stroke, points: [...stroke.points, point] };

      draftStrokeRef.current = next;
      setDraftStroke(next);
      return;
    }

    if (gesture.kind === 'shape') {
      const shape = draftShapeRef.current;

      if (!shape) {
        return;
      }

      const next = { ...shape, to: point };

      draftShapeRef.current = next;
      setDraftShape(next);
      return;
    }

    if (gesture.kind === 'crop') {
      const size = surfaceSizeRef.current;
      const normalizedDx = dx / (size.width || 1);
      const normalizedDy = dy / (size.height || 1);

      previewCrop(gesture.handle === 'move'
        ? moveCrop(gesture.start, normalizedDx, normalizedDy)
        : resizeCrop(gesture.start, gesture.handle, normalizedDx, normalizedDy, cropAspectRef.current));
      return;
    }

    if (gesture.kind === 'text' && gesture.textId) {
      const travelled = Math.hypot(dx, dy);

      if (!gesture.moved && travelled <= TAP_SLOP) {
        return;
      }

      gestureRef.current = { ...gesture, moved: true };

      const size = surfaceSizeRef.current;
      const position = {
        x: clamp01(gesture.origin.x + dx / (size.width || 1)),
        y: clamp01(gesture.origin.y + dy / (size.height || 1))
      };

      setHistory((current) => ({
        ...current,
        present: {
          ...current.present,
          texts: current.present.texts.map((label) =>
            label.id === gesture.textId ? { ...label, position } : label
          )
        }
      }));
    }
  }

  function endGesture(dx: number, dy: number) {
    const gesture = gestureRef.current;

    gestureRef.current = { kind: 'none' };

    if (gesture.kind === 'draw') {
      const stroke = draftStrokeRef.current;

      draftStrokeRef.current = null;
      setDraftStroke(null);

      if (stroke?.points.length) {
        commit({ ...stateRef.current, strokes: [...stateRef.current.strokes, stroke] });
      }

      return;
    }

    if (gesture.kind === 'shape') {
      const shape = draftShapeRef.current;

      draftShapeRef.current = null;
      setDraftShape(null);

      // A tap is not a line. Anything shorter than the tap slop was a stray
      // touch, not an annotation the user meant to leave behind.
      if (shape && Math.hypot(dx, dy) > TAP_SLOP) {
        commit({ ...stateRef.current, shapes: [...stateRef.current.shapes, shape] });
      }

      return;
    }

    if (gesture.kind === 'crop') {
      setHistory((current) => commitPreviewedChange(current, gesture.baseline));
      return;
    }

    if (gesture.kind === 'text') {
      if (gesture.moved) {
        setHistory((current) => commitPreviewedChange(current, gesture.baseline));
        return;
      }

      // A tap on a label opens it for editing; a tap on bare photo starts a new
      // one where the finger landed.
      const existing = gesture.textId
        ? stateRef.current.texts.find((label) => label.id === gesture.textId)
        : null;

      setComposer({
        position: existing?.position || gesture.origin,
        textId: existing?.id || null,
        value: existing?.value || ''
      });
    }
  }

  function handleConfirmText() {
    if (!composer) {
      return;
    }

    const value = composer.value.trim();
    const current = stateRef.current;

    setComposer(null);
    Keyboard.dismiss();

    if (composer.textId) {
      // Clearing an existing label is how it is deleted.
      commit({
        ...current,
        texts: value
          ? current.texts.map((label) =>
            label.id === composer.textId ? { ...label, color, size: textSize, value } : label
          )
          : current.texts.filter((label) => label.id !== composer.textId)
      });
      return;
    }

    if (!value) {
      return;
    }

    const label: PhotoEditorText = {
      color,
      id: createId('text'),
      position: composer.position,
      size: textSize,
      value
    };

    commit({ ...current, texts: [...current.texts, label] });
  }

  async function handleRotate() {
    if (isBusy) {
      return;
    }

    const current = stateRef.current;
    const nextRotation = rotateClockwise(current.rotation);
    const cached = rotatedUriRef.current.get(nextRotation);

    // The rotated photo becomes the working image, so what gets captured on
    // export is exactly what the user is looking at.
    if (cached) {
      setWorkingUri(cached);
      commit({ ...current, rotation: nextRotation });
      return;
    }

    try {
      const rotated = await ImageManipulator.manipulateAsync(
        sourceUri,
        [{ rotate: nextRotation }],
        { compress: 1, format: ImageManipulator.SaveFormat.JPEG }
      );

      rotatedUriRef.current.set(nextRotation, rotated.uri);
      setWorkingUri(rotated.uri);
      commit({ ...current, rotation: nextRotation });
    } catch {
      // Leave the photo as it is. A rotation that cannot be produced should not
      // take the editor down with it.
    }
  }

  function restoreWorkingUri(next: PhotoEditorHistory) {
    setWorkingUri(rotatedUriRef.current.get(next.present.rotation) || sourceUri);

    return next;
  }

  function handleUndo() {
    setHistory((current) => restoreWorkingUri(undoHistory(current)));
  }

  function handleRedo() {
    setHistory((current) => restoreWorkingUri(redoHistory(current)));
  }

  function handleReset() {
    setWorkingUri(sourceUri);
    setCropAspect(null);
    commit(createPhotoEditorState());
  }

  async function handleDone() {
    if (isBusy) {
      return;
    }

    const current = stateRef.current;
    const trimmedCaption = caption.trim();

    // An untouched photo is handed back as it is rather than re-encoded — no
    // point spending quality on a round trip that changes nothing.
    if (!isPhotoEditorStateEdited(current)) {
      onDone({
        caption: trimmedCaption,
        height: naturalHeight,
        uri: sourceUri,
        width: naturalWidth
      });
      return;
    }

    setComposer(null);
    Keyboard.dismiss();
    setIsExporting(true);

    try {
      // The annotations are drawn against the surface, so the surface is what
      // gets captured. Cropping first would leave every mark measured against a
      // frame that no longer exists.
      await nextFrame();

      const capturedUri = await captureRef(surfaceRef, {
        format: 'jpg',
        quality: 0.92,
        result: 'tmpfile'
      });
      const captured = await ImageManipulator.manipulateAsync(capturedUri, [], {
        compress: 1,
        format: ImageManipulator.SaveFormat.JPEG
      });
      const result = isFullCrop(current.crop)
        ? captured
        : await ImageManipulator.manipulateAsync(
          captured.uri,
          [{ crop: toPixelCrop(current.crop, captured.width, captured.height) }],
          { compress: 0.92, format: ImageManipulator.SaveFormat.JPEG }
        );

      onDone({
        caption: trimmedCaption,
        height: result.height,
        uri: result.uri,
        width: result.width
      });
    } catch {
      setIsExporting(false);
    }
  }

  const isCropping = tool === 'crop';
  const isTextTool = tool === 'text';
  const strokes = draftStroke ? [...state.strokes, draftStroke] : state.strokes;
  const shapes = draftShape ? [...state.shapes, draftShape] : state.shapes;
  const frame = {
    bottom: (state.crop.y + state.crop.height) * surface.height,
    height: state.crop.height * surface.height,
    left: state.crop.x * surface.width,
    right: (state.crop.x + state.crop.width) * surface.width,
    top: state.crop.y * surface.height,
    width: state.crop.width * surface.width
  };

  return (
    <Modal animationType="slide" onRequestClose={onCancel} presentationStyle="fullScreen" visible>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.screen}
      >
        <View style={styles.topBar}>
          <Pressable
            accessibilityLabel="Discard edits"
            accessibilityRole="button"
            disabled={isBusy}
            onPress={onCancel}
            style={({ pressed }) => [styles.topButton, pressed && styles.pressed]}
          >
            <Feather color={theme.colors.ink} name="x" size={21} />
          </Pressable>

          <View style={styles.titleWrap}>
            <Text numberOfLines={1} style={styles.title}>{fileName || 'Edit photo'}</Text>
            <Text style={styles.subtitle}>
              {isCropping ? 'Drag the corners or edges' : TOOL_HINTS[tool]}
            </Text>
          </View>

          <Pressable
            accessibilityLabel="Undo"
            accessibilityRole="button"
            disabled={!canUndo(history) || isBusy}
            onPress={handleUndo}
            style={({ pressed }) => [
              styles.topButton,
              !canUndo(history) && styles.disabled,
              pressed && styles.pressed
            ]}
          >
            <Ionicons color={theme.colors.ink} name="arrow-undo" size={19} />
          </Pressable>

          <Pressable
            accessibilityLabel="Redo"
            accessibilityRole="button"
            disabled={!canRedo(history) || isBusy}
            onPress={handleRedo}
            style={({ pressed }) => [
              styles.topButton,
              !canRedo(history) && styles.disabled,
              pressed && styles.pressed
            ]}
          >
            <Ionicons color={theme.colors.ink} name="arrow-redo" size={19} />
          </Pressable>

          <Pressable
            accessibilityLabel="Undo all edits"
            accessibilityRole="button"
            disabled={!isPhotoEditorStateEdited(state) || isBusy}
            onPress={handleReset}
            style={({ pressed }) => [
              styles.topButton,
              !isPhotoEditorStateEdited(state) && styles.disabled,
              pressed && styles.pressed
            ]}
          >
            <Feather color={theme.colors.ink} name="rotate-ccw" size={18} />
          </Pressable>
        </View>

        <View onLayout={handleAreaLayout} style={styles.stage}>
          {surface.width ? (
            <View
              style={[styles.surfaceShadow, { height: surface.height, width: surface.width }]}
              {...responder.panHandlers}
            >
              <View
                collapsable={false}
                ref={surfaceRef}
                style={[styles.surface, { height: surface.height, width: surface.width }]}
              >
                <Image
                  resizeMode="cover"
                  source={{ uri: workingUri }}
                  style={{ height: surface.height, width: surface.width }}
                />

                <Svg
                  height={surface.height}
                  pointerEvents="none"
                  style={StyleSheet.absoluteFill}
                  width={surface.width}
                >
                  {strokes.map((stroke) => (
                    <Path
                      d={buildStrokePath(stroke.points, surface.width, surface.height)}
                      fill="none"
                      key={stroke.id}
                      stroke={stroke.color}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={stroke.width}
                    />
                  ))}

                  {shapes.map((shape) => shape.kind === 'arrow'
                    ? (
                      <G key={shape.id}>
                        <Path
                          d={buildArrowPath(shape, surface.width, surface.height).line}
                          fill="none"
                          stroke={shape.color}
                          strokeLinecap="round"
                          strokeWidth={shape.width}
                        />
                        <Path
                          d={buildArrowPath(shape, surface.width, surface.height).head}
                          fill={shape.color}
                          stroke={shape.color}
                          strokeLinejoin="round"
                          strokeWidth={shape.width * 0.4}
                        />
                      </G>
                    )
                    : (
                      <Path
                        d={buildLinePath(shape, surface.width, surface.height)}
                        fill="none"
                        key={shape.id}
                        stroke={shape.color}
                        strokeLinecap="round"
                        strokeWidth={shape.width}
                      />
                    ))}

                  {state.texts.map((label) => (
                    <SvgText
                      fill={label.color}
                      fontSize={label.size}
                      fontWeight="700"
                      key={label.id}
                      textAnchor="middle"
                      x={label.position.x * surface.width}
                      y={label.position.y * surface.height}
                    >
                      {label.value}
                    </SvgText>
                  ))}
                </Svg>
              </View>

              {isCropping ? (
                <Svg
                  height={surface.height}
                  pointerEvents="none"
                  style={StyleSheet.absoluteFill}
                  width={surface.width}
                >
                  {/* Everything the crop discards is dimmed, so the frame reads
                      as the photo the user is about to keep. */}
                  <Rect fill={SCRIM} height={frame.top} width={surface.width} x={0} y={0} />
                  <Rect
                    fill={SCRIM}
                    height={surface.height - frame.bottom}
                    width={surface.width}
                    x={0}
                    y={frame.bottom}
                  />
                  <Rect fill={SCRIM} height={frame.height} width={frame.left} x={0} y={frame.top} />
                  <Rect
                    fill={SCRIM}
                    height={frame.height}
                    width={surface.width - frame.right}
                    x={frame.right}
                    y={frame.top}
                  />

                  <Rect
                    fill="none"
                    height={frame.height}
                    stroke="rgba(255,255,255,0.9)"
                    strokeWidth={1}
                    width={frame.width}
                    x={frame.left}
                    y={frame.top}
                  />

                  {/* Rule-of-thirds guides, the same cue every camera app gives. */}
                  {[1, 2].map((step) => (
                    <G key={`guide-${step}`}>
                      <Line
                        stroke="rgba(255,255,255,0.32)"
                        strokeWidth={1}
                        x1={frame.left + (frame.width * step) / 3}
                        x2={frame.left + (frame.width * step) / 3}
                        y1={frame.top}
                        y2={frame.bottom}
                      />
                      <Line
                        stroke="rgba(255,255,255,0.32)"
                        strokeWidth={1}
                        x1={frame.left}
                        x2={frame.right}
                        y1={frame.top + (frame.height * step) / 3}
                        y2={frame.top + (frame.height * step) / 3}
                      />
                    </G>
                  ))}

                  {/* L-shaped corners and side bars, drawn rather than placed as
                      views — they overhang the frame, and a view cannot be
                      touched outside its parent's bounds. */}
                  {buildCropCornerPaths(frame).map((path, index) => (
                    <Path
                      d={path}
                      fill="none"
                      key={`corner-${index}`}
                      stroke="#FFFFFF"
                      strokeLinecap="round"
                      strokeWidth={CORNER_THICKNESS}
                    />
                  ))}
                  {buildCropEdgePaths(frame).map((path, index) => (
                    <Path
                      d={path}
                      fill="none"
                      key={`edge-${index}`}
                      stroke="#FFFFFF"
                      strokeLinecap="round"
                      strokeWidth={CORNER_THICKNESS}
                    />
                  ))}
                </Svg>
              ) : null}
            </View>
          ) : (
            <ActivityIndicator color={theme.colors.primary} size="large" />
          )}
        </View>

        {composer ? (
          <View style={styles.composer}>
            <TextInput
              autoFocus
              onChangeText={(value) => setComposer((current) => current ? { ...current, value } : current)}
              onSubmitEditing={handleConfirmText}
              placeholder="Type a label"
              placeholderTextColor={theme.colors.muted}
              returnKeyType="done"
              style={[styles.input, { color }]}
              value={composer.value}
            />
            <Pressable
              accessibilityRole="button"
              onPress={handleConfirmText}
              style={({ pressed }) => [styles.pillButton, pressed && styles.pressed]}
            >
              <Text style={styles.pillButtonLabel}>{composer.textId ? 'Save' : 'Add'}</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.controls}>
          {isCropping ? (
            <ScrollView
              contentContainerStyle={styles.optionRow}
              horizontal
              keyboardShouldPersistTaps="handled"
              showsHorizontalScrollIndicator={false}
            >
              {CROP_PRESETS.map((preset) => {
                const isSelected = cropAspect === preset.value;

                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    key={preset.label}
                    onPress={() => {
                      setCropAspect(preset.value);
                      commit({
                        ...state,
                        crop: preset.value === null
                          ? state.crop
                          : applyCropAspect(preset.value, surfaceAspect)
                      });
                    }}
                    style={({ pressed }) => [
                      styles.chip,
                      isSelected && styles.chipSelected,
                      pressed && styles.pressed
                    ]}
                  >
                    <Text style={[styles.chipLabel, isSelected && styles.chipLabelSelected]}>
                      {preset.label}
                    </Text>
                  </Pressable>
                );
              })}
              <View style={styles.optionDivider} />
              <Pressable
                accessibilityLabel="Rotate photo"
                accessibilityRole="button"
                onPress={() => void handleRotate()}
                style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
              >
                <Feather color={theme.colors.ink} name="rotate-cw" size={15} />
                <Text style={styles.chipLabel}>Rotate</Text>
              </Pressable>
            </ScrollView>
          ) : (
            <ScrollView
              contentContainerStyle={styles.optionRow}
              horizontal
              keyboardShouldPersistTaps="handled"
              showsHorizontalScrollIndicator={false}
            >
              {INK_COLORS.map((swatch) => (
                <Pressable
                  accessibilityLabel={`Colour ${swatch}`}
                  accessibilityRole="button"
                  key={swatch}
                  onPress={() => setColor(swatch)}
                  style={({ pressed }) => [
                    styles.swatchRing,
                    color === swatch && styles.swatchRingSelected,
                    pressed && styles.pressed
                  ]}
                >
                  <View style={[styles.swatch, { backgroundColor: swatch }]} />
                </Pressable>
              ))}
              <View style={styles.optionDivider} />
              {(isTextTool ? TEXT_SIZES : INK_WIDTHS).map((size) => {
                const isSelected = isTextTool ? textSize === size : inkWidth === size;

                return (
                  <Pressable
                    accessibilityLabel={isTextTool ? `Text size ${size}` : `Pen size ${size}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    key={size}
                    onPress={() => isTextTool ? setTextSize(size) : setInkWidth(size)}
                    style={({ pressed }) => [
                      styles.sizeChip,
                      isSelected && styles.sizeChipSelected,
                      pressed && styles.pressed
                    ]}
                  >
                    {isTextTool ? (
                      <Text style={[styles.sizeLetter, { fontSize: size / 2 + 6 }]}>A</Text>
                    ) : (
                      <View
                        style={[
                          styles.sizeDot,
                          { borderRadius: size, height: size / 2, width: size / 2 }
                        ]}
                      />
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          )}

          <View style={styles.toolBar}>
            {TOOLS.map((item) => (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: tool === item.value }}
                key={item.value}
                onPress={() => setTool(item.value)}
                style={({ pressed }) => [
                  styles.toolButton,
                  tool === item.value && styles.toolButtonActive,
                  pressed && styles.pressed
                ]}
              >
                <Feather
                  color={tool === item.value ? theme.colors.primary : theme.colors.mutedStrong}
                  name={item.icon}
                  size={19}
                />
                <Text style={[styles.toolLabel, tool === item.value && styles.toolLabelActive]}>
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.sendRow}>
            {showCaption ? (
              <TextInput
                onChangeText={setCaption}
                placeholder={captionPlaceholder || 'Add a caption'}
                placeholderTextColor={theme.colors.muted}
                style={styles.input}
                value={caption}
              />
            ) : (
              <View style={styles.sendSpacer} />
            )}

            <Pressable
              accessibilityLabel={showCaption ? 'Send photo' : 'Save photo'}
              accessibilityRole="button"
              disabled={isBusy}
              onPress={() => void handleDone()}
              style={({ pressed }) => [styles.doneButton, pressed && styles.pressed]}
            >
              {isBusy ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Feather color="#FFFFFF" name={showCaption ? 'send' : 'check'} size={20} />
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const SCRIM = 'rgba(0,0,0,0.55)';
const CORNER_THICKNESS = 4;
const CORNER_LENGTH = 26;
const EDGE_LENGTH = 28;

const TOOL_HINTS: Record<PhotoEditorTool, string> = {
  arrow: 'Drag to point at something',
  crop: 'Drag the corners or edges',
  draw: 'Draw anywhere on the photo',
  line: 'Drag to draw a straight line',
  text: 'Tap to add, drag to move'
};

interface CropFrame {
  bottom: number;
  height: number;
  left: number;
  right: number;
  top: number;
  width: number;
}

/** The four L-shaped corner marks, straddling the frame edge. */
function buildCropCornerPaths(frame: CropFrame): string[] {
  const inset = CORNER_THICKNESS / 2;
  const length = Math.min(CORNER_LENGTH, frame.width / 2, frame.height / 2);
  const left = frame.left + inset;
  const right = frame.right - inset;
  const top = frame.top + inset;
  const bottom = frame.bottom - inset;

  return [
    `M ${left} ${top + length} L ${left} ${top} L ${left + length} ${top}`,
    `M ${right - length} ${top} L ${right} ${top} L ${right} ${top + length}`,
    `M ${left} ${bottom - length} L ${left} ${bottom} L ${left + length} ${bottom}`,
    `M ${right - length} ${bottom} L ${right} ${bottom} L ${right} ${bottom - length}`
  ];
}

/** Short bars at the middle of each edge, marking the side handles. */
function buildCropEdgePaths(frame: CropFrame): string[] {
  const inset = CORNER_THICKNESS / 2;
  const horizontal = Math.min(EDGE_LENGTH, frame.width / 3);
  const vertical = Math.min(EDGE_LENGTH, frame.height / 3);
  const centreX = frame.left + frame.width / 2;
  const centreY = frame.top + frame.height / 2;

  return [
    `M ${centreX - horizontal / 2} ${frame.top + inset} L ${centreX + horizontal / 2} ${frame.top + inset}`,
    `M ${centreX - horizontal / 2} ${frame.bottom - inset} L ${centreX + horizontal / 2} ${frame.bottom - inset}`,
    `M ${frame.left + inset} ${centreY - vertical / 2} L ${frame.left + inset} ${centreY + vertical / 2}`,
    `M ${frame.right - inset} ${centreY - vertical / 2} L ${frame.right - inset} ${centreY + vertical / 2}`
  ];
}

function createId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

/**
 * Lets the surface settle before it is captured.
 *
 * The last mark and any keyboard dismissal are still committing when the export
 * begins; capturing in the same frame can miss them.
 */
function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    chip: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 999,
      borderWidth: StyleSheet.hairlineWidth,
      flexDirection: 'row',
      gap: 6,
      paddingHorizontal: 15,
      paddingVertical: 9
    },
    chipLabel: { color: colors.ink, fontSize: 13, fontWeight: '600' },
    chipLabelSelected: { color: '#FFFFFF' },
    chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
    composer: {
      alignItems: 'center',
      backgroundColor: colors.surfaceElevated,
      borderTopColor: colors.divider,
      borderTopWidth: StyleSheet.hairlineWidth,
      flexDirection: 'row',
      gap: 10,
      paddingHorizontal: 16,
      paddingVertical: 10
    },
    controls: {
      backgroundColor: colors.surfaceElevated,
      borderTopColor: colors.divider,
      borderTopWidth: StyleSheet.hairlineWidth,
      gap: 14,
      paddingBottom: 28,
      paddingTop: 14
    },
    disabled: { opacity: 0.3 },
    doneButton: {
      alignItems: 'center',
      backgroundColor: colors.primary,
      borderRadius: 999,
      height: 50,
      justifyContent: 'center',
      width: 50
    },
    input: {
      backgroundColor: colors.input,
      borderColor: colors.border,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      color: colors.ink,
      flex: 1,
      fontSize: 15,
      paddingHorizontal: 14,
      paddingVertical: 12
    },
    optionDivider: {
      backgroundColor: colors.divider,
      height: 26,
      marginHorizontal: 4,
      width: StyleSheet.hairlineWidth
    },
    optionRow: { alignItems: 'center', gap: 10, paddingHorizontal: 16 },
    pillButton: {
      backgroundColor: colors.primary,
      borderRadius: 999,
      paddingHorizontal: 20,
      paddingVertical: 11
    },
    pillButtonLabel: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
    pressed: { opacity: 0.65 },
    screen: { backgroundColor: colors.background, flex: 1 },
    sendRow: { alignItems: 'center', flexDirection: 'row', gap: 12, paddingHorizontal: 16 },
    sendSpacer: { flex: 1 },
    sizeChip: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 999,
      borderWidth: StyleSheet.hairlineWidth,
      height: 40,
      justifyContent: 'center',
      width: 40
    },
    sizeChipSelected: { borderColor: colors.primary, borderWidth: 2 },
    sizeDot: { backgroundColor: colors.ink },
    sizeLetter: { color: colors.ink, fontWeight: '800' },
    stage: { alignItems: 'center', flex: 1, justifyContent: 'center', padding: 14 },
    subtitle: { color: colors.mutedStrong, fontSize: 11.5, marginTop: 1 },
    surface: { overflow: 'hidden' },
    surfaceShadow: {
      backgroundColor: colors.surface,
      borderRadius: 2,
      elevation: 6,
      shadowColor: '#000000',
      shadowOffset: { height: 6, width: 0 },
      shadowOpacity: 0.22,
      shadowRadius: 18
    },
    swatch: { borderRadius: 999, height: 26, width: 26 },
    swatchRing: {
      alignItems: 'center',
      borderColor: 'transparent',
      borderRadius: 999,
      borderWidth: 2,
      height: 36,
      justifyContent: 'center',
      width: 36
    },
    swatchRingSelected: { borderColor: colors.primary },
    title: { color: colors.ink, fontSize: 15, fontWeight: '600' },
    titleWrap: { flex: 1, paddingHorizontal: 4 },
    toolBar: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 16,
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginHorizontal: 16,
      padding: 5
    },
    toolButton: { alignItems: 'center', borderRadius: 12, flex: 1, gap: 3, paddingVertical: 9 },
    toolButtonActive: { backgroundColor: colors.primarySoft },
    toolLabel: { color: colors.mutedStrong, fontSize: 11, fontWeight: '600' },
    toolLabelActive: { color: colors.primary },
    topBar: {
      alignItems: 'center',
      borderBottomColor: colors.divider,
      borderBottomWidth: StyleSheet.hairlineWidth,
      flexDirection: 'row',
      gap: 8,
      paddingBottom: 12,
      paddingHorizontal: 12,
      paddingTop: 56
    },
    topButton: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 999,
      borderWidth: StyleSheet.hairlineWidth,
      height: 40,
      justifyContent: 'center',
      width: 40
    }
  });
}
