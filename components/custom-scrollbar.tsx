import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  PanResponder,
  StyleSheet,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type ScrollableRef = {
  scrollTo?: (options: { y: number; animated?: boolean }) => void;
  scrollToOffset?: (options: { offset: number; animated?: boolean }) => void;
};

type ScrollbarHookResult = {
  scrollRef: React.RefObject<ScrollableRef | null>;
  onLayout: (event: LayoutChangeEvent) => void;
  onContentSizeChange: (width: number, height: number) => void;
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  thumbHeight: number;
  thumbTranslateY: Animated.Value;
  opacity: Animated.Value;
  panHandlers: ReturnType<typeof PanResponder.create>["panHandlers"];
  visible: boolean;
  onDragStart?: (pointerY?: number) => void;
  onDragToPointerY?: (pointerY: number) => void;
  onDragEnd?: () => void;
};

const MIN_THUMB_HEIGHT = 52;
const TRACK_TOP_MARGIN = 12;
const TRACK_RIGHT_MARGIN = 12;
const TRACK_BOTTOM_MARGIN = 12;
const TRACK_BOTTOM_SAFE_MIN = 8;
const SHOW_DELAY_MS = 900;

const clamp = (value: number, min: number, max: number): number => {
  if (max <= min) return min;
  return Math.min(max, Math.max(min, value));
};

const useAnimatedFade = () => {
  const value = useRef(new Animated.Value(0)).current;

  const fadeTo = (nextValue: number, duration: number) => {
    Animated.timing(value, {
      toValue: nextValue,
      duration,
      useNativeDriver: true,
    }).start();
  };

  return { value, fadeTo };
};

export function useDraggableScrollbar(): ScrollbarHookResult {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollableRef | null>(null);
  const containerHeight = useRef(0);
  const contentHeight = useRef(0);
  const scrollOffset = useRef(0);
  const thumbTop = useRef(0);
  const dragging = useRef(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragStartThumbTop = useRef(0);
  const dragStartPointerY = useRef(0);
  const thumbTranslateY = useRef(new Animated.Value(0)).current;
  const { value: opacity, fadeTo } = useAnimatedFade();
  const [thumbHeight, setThumbHeight] = useState(MIN_THUMB_HEIGHT);
  const [visible, setVisible] = useState(false);

  const clearHideTimer = () => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  };

  const getTrackHeight = () => {
    const topInset = Math.max(insets.top, TRACK_TOP_MARGIN);
    const bottomInset =
      Math.max(insets.bottom, TRACK_BOTTOM_SAFE_MIN) + TRACK_BOTTOM_MARGIN;
    return Math.max(0, containerHeight.current - topInset - bottomInset);
  };

  const syncThumb = (nextOffset = scrollOffset.current) => {
    const viewportHeight = containerHeight.current;
    const totalHeight = contentHeight.current;
    const trackHeight = getTrackHeight();
    const maxScroll = Math.max(0, totalHeight - viewportHeight);

    if (
      viewportHeight <= 0 ||
      totalHeight <= 0 ||
      maxScroll === 0 ||
      trackHeight <= 0
    ) {
      thumbTop.current = 0;
      thumbTranslateY.setValue(0);
      setThumbHeight(MIN_THUMB_HEIGHT);
      setVisible(false);
      fadeTo(0, 120);
      return;
    }

    const nextThumbHeight = clamp(
      (viewportHeight / totalHeight) * trackHeight,
      MIN_THUMB_HEIGHT,
      trackHeight,
    );
    const maxThumbTravel = Math.max(0, trackHeight - nextThumbHeight);
    const nextThumbTop =
      maxThumbTravel > 0 ? (nextOffset / maxScroll) * maxThumbTravel : 0;

    thumbTop.current = nextThumbTop;
    thumbTranslateY.setValue(nextThumbTop);
    setThumbHeight(nextThumbHeight);
    setVisible(true);
    showScrollbar();
    scheduleHide();
  };

  const scheduleHide = () => {
    if (dragging.current) {
      return;
    }

    clearHideTimer();
    hideTimer.current = setTimeout(() => {
      if (!dragging.current) {
        fadeTo(0, 180);
      }
    }, SHOW_DELAY_MS);
  };

  const showScrollbar = () => {
    if (!visible) {
      setVisible(true);
    }
    clearHideTimer();
    fadeTo(1, 120);
  };

  const applyDragByDy = (dy: number) => {
    const viewportHeight = containerHeight.current;
    const totalHeight = contentHeight.current;
    const trackHeight = getTrackHeight();
    const maxScroll = Math.max(0, totalHeight - viewportHeight);
    const maxThumbTravel = Math.max(0, trackHeight - thumbHeight);

    if (maxScroll === 0 || maxThumbTravel === 0) {
      return;
    }

    const nextThumbTop = clamp(
      dragStartThumbTop.current + dy,
      0,
      maxThumbTravel,
    );
    const nextOffset = (nextThumbTop / maxThumbTravel) * maxScroll;

    thumbTop.current = nextThumbTop;
    scrollOffset.current = nextOffset;
    thumbTranslateY.setValue(nextThumbTop);

    const ref = scrollRef.current;
    if (ref?.scrollTo) {
      ref.scrollTo({ y: nextOffset, animated: false });
    } else if (ref?.scrollToOffset) {
      ref.scrollToOffset({ offset: nextOffset, animated: false });
    }
  };

  const onDragStart = (pointerY?: number) => {
    dragStartThumbTop.current = thumbTop.current;
    dragStartPointerY.current = pointerY ?? 0;
    dragging.current = true;
    showScrollbar();
    clearHideTimer();
  };

  const onDragToPointerY = (pointerY: number) => {
    const dy = pointerY - dragStartPointerY.current;
    applyDragByDy(dy);
  };

  const onDragEnd = () => {
    dragging.current = false;
    scheduleHide();
  };

  const onLayout = (event: LayoutChangeEvent) => {
    containerHeight.current = event.nativeEvent.layout.height;
    syncThumb();
  };

  const onContentSizeChange = (_width: number, height: number) => {
    contentHeight.current = height;
    syncThumb();
  };

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollOffset.current = event.nativeEvent.contentOffset.y;
    syncThumb(scrollOffset.current);
    showScrollbar();
    scheduleHide();
  };

  useEffect(() => {
    return () => {
      clearHideTimer();
    };
  }, []);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponderCapture: () => visible,
        onMoveShouldSetPanResponderCapture: () => visible,
        onStartShouldSetPanResponder: () => visible,
        onMoveShouldSetPanResponder: () => visible,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          onDragStart();
        },
        onPanResponderMove: (_event, gestureState) => {
          applyDragByDy(gestureState.dy);
        },
        onPanResponderRelease: onDragEnd,
        onPanResponderTerminate: onDragEnd,
      }),
    [thumbHeight, visible],
  );

  return {
    scrollRef,
    onLayout,
    onContentSizeChange,
    onScroll,
    thumbHeight,
    thumbTranslateY,
    opacity,
    panHandlers: panResponder.panHandlers,
    visible,
    onDragStart,
    onDragToPointerY,
    onDragEnd,
  };
}

type DraggableScrollbarOverlayProps = Pick<
  ScrollbarHookResult,
  | "thumbHeight"
  | "thumbTranslateY"
  | "opacity"
  | "panHandlers"
  | "visible"
  | "onDragStart"
  | "onDragToPointerY"
  | "onDragEnd"
>;

export function DraggableScrollbarOverlay({}: DraggableScrollbarOverlayProps) {
  return null;
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 30,
    elevation: 30,
    alignItems: "flex-end",
  },
  track: {
    position: "absolute",
    width: 32,
    alignItems: "center",
    justifyContent: "flex-start",
  },
  thumbHitTarget: {
    width: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  thumb: {
    width: 8,
    flex: 1,
    borderRadius: 999,
    backgroundColor: "rgba(31, 37, 48, 0.42)",
  },
});
