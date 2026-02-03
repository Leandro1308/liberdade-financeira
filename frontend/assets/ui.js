export function toast(message, type="ok") {
  const el = document.getElementById("toast");
  if (!el) return alert(message);

  el.classList.remove("show", "error");
  el.querySelector(".msg").textContent = message;

  if (type === "error") el.classList.add("error");
  el.classList.add("show");

  setTimeout(() => el.classList.remove("show"), 3200);
}
