const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const details = {
  sensor: "Sensors publish deliberately selected ROS topics. Physical aliases stay uncommitted until observed on BEAST-01.",
  recorder: "Black-box sessions roll every 15 minutes; missions split at 4 GiB or 15 minutes. Both write under /data/beast.",
  retention: "Maintenance skips live locks and .keep. Below the emergency floor it prunes eligible black-box data only; missions and other categories are never automatic-delete targets.",
  replay: "Replay validates the recording before operators enable continuous capture. Offload selected missions separately."
};
document.querySelectorAll(".node").forEach((node) => node.addEventListener("click", () => {
  document.querySelectorAll(".node").forEach((item) => item.setAttribute("aria-pressed", "false"));
  node.setAttribute("aria-pressed", "true");
  document.querySelector("#node-detail").textContent = details[node.dataset.node];
}));
document.querySelectorAll("[data-copy]").forEach((button) => button.addEventListener("click", async () => {
  const value = document.querySelector(button.dataset.copy).textContent;
  try { await navigator.clipboard.writeText(value); button.textContent = "Copied"; }
  catch { button.textContent = "Copy unavailable"; }
  window.setTimeout(() => { button.textContent = "Copy"; }, 1200);
}));
document.querySelectorAll(".story-control").forEach((button) => button.addEventListener("click", () => {
  document.querySelector("#story-track").scrollBy({ left: button.dataset.direction === "next" ? 420 : -420, behavior: reducedMotion ? "auto" : "smooth" });
}));
document.addEventListener("keydown", (event) => {
  if (!event.target.closest("#story-track")) return;
  if (event.key === "ArrowRight" || event.key === "ArrowLeft") event.target.closest("#story-track").scrollBy({ left: event.key === "ArrowRight" ? 420 : -420, behavior: reducedMotion ? "auto" : "smooth" });
});
