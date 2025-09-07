import { create } from "zustand";
import { PRESETS } from "./constants/items";

let uid = 1;
const newId = () => `it-${uid++}`;

const byId = (id) => PRESETS.find(p => p.id === id);

export const useStore = create((set, get) => ({
  items: [],
  selectedId: null,
  zoom: 1,

  setZoom: (z) => set({ zoom: z }),

  addItem: (preset) => {
    const count = get().items.length;
    const base = 5 + (count % 6) * 3; // drop items offset a bit
    const item = {
      id: newId(),
      label: preset.label,
      w: preset.w,
      h: preset.h,
      x: base,
      y: base,
      rotated: false,
      kind: preset.kind,
    };
    set(state => ({ items: [...state.items, item], selectedId: item.id }));
  },

  clearAll: () => set({ items: [], selectedId: null }),

  selectItem: (id) => set({ selectedId: id }),

  moveItem: (id, nx, ny) =>
    set(state => ({
      items: state.items.map(it => it.id === id ? { ...it, x: nx, y: ny } : it),
    })),

  rotateItem: (id) =>
    set(state => ({
      items: state.items.map(it => it.id === id ? { ...it, rotated: !it.rotated } : it),
    })),

  deleteItem: (id) =>
    set(state => ({
      items: state.items.filter(it => it.id !== id),
      selectedId: state.selectedId === id ? null : state.selectedId
    })),

  computeFootprint: () => {
    const items = get().items;
    if (!items.length) return { width: 0, height: 0 };
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    items.forEach(it => {
      const w = it.rotated ? it.h : it.w;
      const h = it.rotated ? it.w : it.h;
      minX = Math.min(minX, it.x);
      minY = Math.min(minY, it.y);
      maxX = Math.max(maxX, it.x + w);
      maxY = Math.max(maxY, it.y + h);
    });
    return { width: (maxX - minX) + 10, height: (maxY - minY) + 10 }; // add 5’ buffer each side
  },

  /** Macro: Two 20×40 tents in parallel with a 20’ gap between them,
   * an 18×18 dance floor at one end (inside the gap, flush to tent edge),
   * and a 10×20 DJ pop-up centered on the dance floor, outside the tents’ edge.
   */
  placeTwoTentsGapDanceDJ: () => {
    const margin = 5;     // 5’ from canvas top/left
    const gap = 20;       // requested gap between tents
    const tentW = 20;
    const tentH = 40;

    const tentPreset = byId("tent-20x40");
    const dancePreset = byId("df-18x18");
    const djPreset = byId("dj-10x20");

    if (!tentPreset || !dancePreset || !djPreset) return;

    // Tent 1 (left)
    const t1 = {
      id: newId(),
      label: tentPreset.label,
      w: tentW, h: tentH,
      x: margin, y: margin,
      rotated: false, kind: tentPreset.kind,
    };

    // Tent 2 (right) — 20’ tent width + 20’ gap from Tent 1’s inside edge
    const t2X = margin + tentW + gap; // = 5 + 20 + 20 = 45
    const t2 = {
      id: newId(),
      label: tentPreset.label,
      w: tentW, h: tentH,
      x: t2X, y: margin,
      rotated: false, kind: tentPreset.kind,
    };

    // Dance floor inside the 20’ gap, flush to the left tent’s inner edge
    // Gap X range = [margin + tentW, margin + tentW + gap] = [25, 45]
    // 18’ floor → leave ~1’ margin on each side inside the 20’ gap.
    const dfX = margin + tentW + 1; // 26
    const dfY = margin;             // at the top end between the tents
    const df = {
      id: newId(),
      label: dancePreset.label,
      w: 18, h: 18,
      x: dfX, y: dfY,
      rotated: false, kind: dancePreset.kind,
    };

    // DJ 10×20 at the "outside end" of the dance floor.
    // Place it centered with the dance floor and just outside (above) the tents’ top edge.
    const tentsTopY = margin;
    const djY = Math.max(0, tentsTopY - 20); // outside = above; clamp at 0
    const djX = dfX + (18 - 10) / 2; // center beneath/above the floor
    const dj = {
      id: newId(),
      label: djPreset.label,
      w: 10, h: 20,
      x: djX, y: djY,
      rotated: false, kind: djPreset.kind,
    };

    set({
      items: [t1, t2, df, dj],
      selectedId: null,
    });
  },
}));
