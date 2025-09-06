export const PRESETS = [
  // Tents (High peak)
  { id: "tent-20x20", label: "Tent 20×20 (HP)", w: 20, h: 20, kind: "tent" },
  { id: "tent-20x40", label: "Tent 20×40 (HP)", w: 20, h: 40, kind: "tent" },

  // Dance floor
  { id: "df-18x18", label: "Dance Floor 18×18", w: 18, h: 18, kind: "dancefloor" },

  // DJ & Caterer pop-ups
  { id: "dj-10x20", label: "DJ Pop-up 10×20", w: 10, h: 20, kind: "popup" },
  { id: "cat-10x20", label: "Caterer 10×20", w: 10, h: 20, kind: "popup" },

  // Tables & chairs
  { id: "tbl-8ft", label: "8’ Banquet", w: 8, h: 2.5, kind: "table" }, // 30 in = 2.5 ft
  { id: "tbl-cocktail", label: "Cocktail (hi-top)", w: 3, h: 3, kind: "table" }, // ~36" circle proxy
  { id: "chairs-6", label: "Row of 6 chairs", w: 9, h: 2, kind: "chairs" }, // density block

  // Sweetheart table
  { id: "sweetheart", label: "Sweetheart", w: 6, h: 2.5, kind: "table" },

  // Outside items
  { id: "bar", label: "Mobile Bar", w: 8, h: 4, kind: "bar" },
  { id: "bathroom", label: "Bathroom Trailer", w: 20, h: 8, kind: "facility" },

  // Spacers / blank zone (for gap between tents)
  { id: "gap-blank", label: "Blank Space", w: 10, h: 20, kind: "gap" },
];
