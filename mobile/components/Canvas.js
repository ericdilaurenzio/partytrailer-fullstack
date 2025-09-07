import React, { useRef } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import Svg, { Rect, G, Text as SvgText } from "react-native-svg";
import { useStore } from "../store";

// scale: 1 foot = 4 pixels (adjust anytime)
const FT = 4;

export const Canvas = () => {
  const { items, selectedId, selectItem, moveItem, rotateItem, deleteItem, zoom, setZoom } = useStore();
  const viewRef = useRef(null);

  const onBackgroundPress = () => selectItem(null);

  return (
    <View style={styles.wrap}>
      <View style={styles.topBar}>
        <Pressable style={styles.iconBtn} onPress={() => setZoom(Math.max(0.5, zoom - 0.1))}>
          <Text style={styles.iconTxt}>–</Text>
        </Pressable>
        <Text style={styles.zoomTxt}>{Math.round(zoom * 100)}%</Text>
        <Pressable style={styles.iconBtn} onPress={() => setZoom(Math.min(3, zoom + 0.1))}>
          <Text style={styles.iconTxt}>+</Text>
        </Pressable>
        <View style={{ flex: 1 }} />
        {selectedId && (
          <>
            <Pressable style={styles.actionBtn} onPress={() => rotateItem(selectedId)}>
              <Text style={styles.actionTxt}>Rotate 90°</Text>
            </Pressable>
            <Pressable style={[styles.actionBtn, styles.del]} onPress={() => deleteItem(selectedId)}>
              <Text style={styles.actionTxt}>Delete</Text>
            </Pressable>
          </>
        )}
      </View>

      <View style={styles.canvas} ref={viewRef}>
        <Svg width="100%" height="100%" onPress={onBackgroundPress}>
          {/* grid every 10ft */}
          {Array.from({ length: 100 }).map((_, i) => (
            <Rect key={`grid-h-${i}`} x={0} y={i * 10 * FT * zoom} width="10000" height={1} fill="#1a2236" opacity={0.5} />
          ))}
          {Array.from({ length: 100 }).map((_, i) => (
            <Rect key={`grid-v-${i}`} x={i * 10 * FT * zoom} y={0} width={1} height="10000" fill="#1a2236" opacity={0.5} />
          ))}

          {/* items */}
          {items.map(it => {
            const w = it.rotated ? it.h : it.w;
            const h = it.rotated ? it.w : it.h;
            const pxW = w * FT * zoom;
            const pxH = h * FT * zoom;
            const pxX = it.x * FT * zoom;
            const pxY = it.y * FT * zoom;
            const isSelected = it.id === selectedId;

            return (
              <G key={it.id}>
                <Rect
                  x={pxX}
                  y={pxY}
                  width={pxW}
                  height={pxH}
                  fill={isSelected ? "#2a3f72" : "#203054"}
                  stroke={isSelected ? "#8cb4ff" : "#4a5f8a"}
                  strokeWidth={isSelected ? 3 : 1}
                  rx={6}
                  onPress={(e) => {
                    e.stopPropagation();
                    selectItem(it.id);
                  }}
                />
                {/* drag overlay */}
                <Rect
                  x={pxX}
                  y={pxY}
                  width={pxW}
                  height={pxH}
                  fill="transparent"
                  onPress={(e) => {
                    e.stopPropagation();
                    selectItem(it.id);
                  }}
                  onStartShouldSetResponder={() => true}
                  onResponderMove={(evt) => {
                    const { locationX, locationY } = evt.nativeEvent;
                    const nx = Math.max(0, Math.round((locationX / (FT * zoom)) - w / 2));
                    const ny = Math.max(0, Math.round((locationY / (FT * zoom)) - h / 2));
                    moveItem(it.id, nx, ny);
                  }}
                />
                {/* label */}
                <SvgText
                  x={pxX + 6}
                  y={pxY + 16}
                  fill="#cfe0ff"
                  fontSize={12}
                >
                  {it.label} ({w}’×{h}’)
                </SvgText>
              </G>
            );
          })}
        </Svg>
      </View>

      <View style={styles.legend}>
        <Text style={styles.legendTxt}>
          Grid: 10 ft • Drag to move • Tap to select • Rotate/Delete on top-right
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#0f1628",
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "#263045",
  },
  iconBtn: {
    backgroundColor: "#1f2b45",
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  iconTxt: { color: "white", fontSize: 18, fontWeight: "800" },
  zoomTxt: { color: "#c9d7f2", width: 56, textAlign: "center" },
  actionBtn: { backgroundColor: "#1f2b45", paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10 },
  actionTxt: { color: "white", fontSize: 12, fontWeight: "600" },
  del: { backgroundColor: "#6e2a2a" },
  canvas: { flex: 1, backgroundColor: "#0a1020" },
  legend: {
    padding: 8,
    backgroundColor: "#0f1628",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: "#263045",
  },
  legendTxt: { color: "#9fb2d3", fontSize: 12 },
});
