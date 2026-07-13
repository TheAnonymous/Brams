/**
 * Brams interactions. Kept intentionally small so CSS stays the primary API.
 */
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".brams-switch").forEach((switchButton) => {
    switchButton.addEventListener("click", () => {
      const isChecked = switchButton.getAttribute("aria-checked") === "true";
      switchButton.setAttribute("aria-checked", String(!isChecked));
    });
  });

  document.querySelectorAll(".brams-segmented").forEach((group) => {
    group.querySelectorAll("button").forEach((button) => {
      button.addEventListener("click", () => {
        group.querySelectorAll("button").forEach((item) => item.setAttribute("aria-pressed", "false"));
        button.setAttribute("aria-pressed", "true");
      });
    });
  });

  document.querySelectorAll("[role='tablist']").forEach((tabList) => {
    const tabs = [...tabList.querySelectorAll("[role='tab']")];
    tabs.forEach((tab, index) => {
      tab.addEventListener("click", () => activateTab(tab, tabs));
      tab.addEventListener("keydown", (event) => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        let next = index;
        if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
        if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
        if (event.key === "Home") next = 0;
        if (event.key === "End") next = tabs.length - 1;
        tabs[next].focus();
        activateTab(tabs[next], tabs);
      });
    });
  });

  document.querySelectorAll(".brams-range input").forEach((input) => {
    const output = input.closest(".brams-range").querySelector("output");
    const updateOutput = () => { output.textContent = `${input.value}%`; };
    input.addEventListener("input", updateOutput);
    updateOutput();
  });
});

function activateTab(tab, tabs) {
  tabs.forEach((item) => {
    const selected = item === tab;
    item.setAttribute("aria-selected", String(selected));
    item.tabIndex = selected ? 0 : -1;
    document.getElementById(item.getAttribute("aria-controls")).hidden = !selected;
  });
}

