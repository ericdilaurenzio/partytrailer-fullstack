(() => {
  try {
    const g = globalThis || global;
    if (g && g.FormData && !g.formdata) { g.formdata = g.FormData; }
  } catch {}
})();
