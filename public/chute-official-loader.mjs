const VERSION = "4.0.1";
const PARTS = Array.from({ length: 6 }, (_, index) =>
  `/chute-official-part-${String(index).padStart(2, "0")}.txt?v=${VERSION}`
);

try {
  const responses = await Promise.all(
    PARTS.map((url) => fetch(url, { cache: "no-store" }))
  );

  const failed = responses.find((response) => !response.ok);
  if (failed) {
    throw new Error(`No se pudo cargar una parte del sistema (${failed.status}).`);
  }

  const source = (await Promise.all(responses.map((response) => response.text()))).join("");
  const moduleUrl = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));

  try {
    await import(moduleUrl);
  } finally {
    URL.revokeObjectURL(moduleUrl);
  }
} catch (error) {
  console.error("No se pudo iniciar Chute Mundo oficial.", error);
  const status = document.getElementById("syncStatus");
  if (status) status.textContent = "Error de carga";
  const notice = document.getElementById("sourceNotice");
  if (notice) {
    notice.className = "notice warning";
    notice.textContent = "No se pudo iniciar el sistema. Recarga la página o revisa la conexión.";
  }
}
