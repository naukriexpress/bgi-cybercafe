(function () {
  const storageKey = "bgi-theme";
  let saved;
  try { saved = localStorage.getItem(storageKey); } catch (_) {}
  if (saved === "dark" || (!saved && matchMedia("(prefers-color-scheme: dark)").matches)) {
    document.documentElement.dataset.theme = "dark";
  }
  function addButton() {
    const nav = document.querySelector(".site-header .nav-row");
    if (!nav) return;
    const menu = nav.querySelector(".nav-links");
    if (menu) {
      menu.id = "mobileNav";
      const menuButton = document.createElement("button");
      menuButton.type = "button";
      menuButton.className = "mobile-menu-toggle";
      menuButton.textContent = "☰ Menu";
      menuButton.setAttribute("aria-controls", "mobileNav");
      menuButton.setAttribute("aria-expanded", "false");
      menuButton.addEventListener("click", () => {
        const isOpen = menu.classList.toggle("open");
        menuButton.setAttribute("aria-expanded", String(isOpen));
        menuButton.textContent = isOpen ? "✕ Close" : "☰ Menu";
      });
      menu.addEventListener("click", event => {
        if (event.target.closest("a")) {
          menu.classList.remove("open");
          menuButton.setAttribute("aria-expanded", "false");
          menuButton.textContent = "☰ Menu";
        }
      });
      nav.append(menuButton);
    }
    const button = document.createElement("button");
    button.type = "button";
    button.className = "theme-toggle";
    button.setAttribute("aria-label", "Switch color theme");
    function update() {
      const dark = document.documentElement.dataset.theme === "dark";
      button.textContent = dark ? "☀️ Day mode" : "🌙 Night mode";
      button.setAttribute("aria-pressed", String(dark));
    }
    button.addEventListener("click", () => {
      const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      try { localStorage.setItem(storageKey, next); } catch (_) {}
      update();
    });
    nav.append(button);
    update();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", addButton);
  else addButton();
})();
