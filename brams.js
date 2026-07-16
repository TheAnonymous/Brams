(function () {
  "use strict";

  const VERSION = "1.0.0";
  const initialized = new WeakMap();
  const openLayers = [];
  const modalIsolationState = new Map();
  let globalListenersReady = false;

  const selector = {
    focusable: [
      "a[href]",
      "button:not([disabled])",
      "input:not([disabled])",
      "select:not([disabled])",
      "textarea:not([disabled])",
      "[tabindex]:not([tabindex='-1'])",
    ].join(","),
    modalLayer: ".brams-overlay, .brams-drawer-overlay",
    floatingLayer: ".brams-popover, .brams-menu",
  };

  function elements(root, query) {
    const result = root.querySelectorAll ? [...root.querySelectorAll(query)] : [];
    if (root instanceof Element && root.matches(query)) result.unshift(root);
    return result;
  }

  function setup(element, key, callback) {
    const keys = initialized.get(element) || new Set();
    if (keys.has(key)) return;
    keys.add(key);
    initialized.set(element, keys);
    callback();
  }

  function resolveTarget(target) {
    if (target instanceof Element) return normalizeLayer(target);
    if (typeof target !== "string" || !target.trim()) return null;
    try {
      return normalizeLayer(document.querySelector(target));
    } catch (_) {
      return null;
    }
  }

  function normalizeLayer(element) {
    if (!element) return null;
    if (element.matches(".brams-dialog, .brams-drawer")) {
      return element.closest(selector.modalLayer) || element;
    }
    return element;
  }

  function emit(element, name) {
    element.dispatchEvent(new CustomEvent(name, { bubbles: true, detail: { target: element } }));
  }

  function isModal(element) {
    return element.matches(selector.modalLayer);
  }

  function syncModalIsolation() {
    const activeModal = [...openLayers].reverse().find((item) => isModal(item) && item.isConnected && !item.hidden);
    const isolationTargets = new Set();
    let activeBranch = activeModal;

    while (activeBranch && activeBranch !== document.body) {
      [...activeBranch.parentElement.children].forEach((sibling) => {
        if (sibling !== activeBranch && !sibling.hasAttribute("aria-live")) isolationTargets.add(sibling);
      });
      activeBranch = activeBranch.parentElement;
    }

    new Set([...modalIsolationState.keys(), ...isolationTargets]).forEach((element) => {
      if (isolationTargets.has(element) && !modalIsolationState.has(element)) {
        modalIsolationState.set(element, element.inert);
        element.inert = true;
      } else if (!isolationTargets.has(element) && modalIsolationState.has(element)) {
        element.inert = modalIsolationState.get(element);
        modalIsolationState.delete(element);
      }
    });
  }

  function visibleFocusable(container) {
    return [...container.querySelectorAll(selector.focusable)].filter((item) => {
      return !item.hidden && item.getAttribute("aria-hidden") !== "true" && item.getClientRects().length > 0;
    });
  }

  function positionFloating(layer, trigger, kind) {
    if (!trigger || !trigger.isConnected || layer.hidden) return;
    const gap = kind === "tooltip" ? 8 : 6;
    const triggerRect = trigger.getBoundingClientRect();
    const layerRect = layer.getBoundingClientRect();
    const margin = 8;
    let left = kind === "tooltip"
      ? triggerRect.left + (triggerRect.width - layerRect.width) / 2
      : triggerRect.left;
    let top = triggerRect.bottom + gap;

    if (top + layerRect.height > window.innerHeight - margin) {
      top = triggerRect.top - layerRect.height - gap;
    }
    left = Math.max(margin, Math.min(left, window.innerWidth - layerRect.width - margin));
    top = Math.max(margin, top);
    layer.style.left = `${Math.round(left)}px`;
    layer.style.top = `${Math.round(top)}px`;
  }

  function rememberLayer(layer, trigger) {
    const existing = openLayers.indexOf(layer);
    if (existing >= 0) openLayers.splice(existing, 1);
    layer.__bramsTrigger = trigger || layer.__bramsTrigger || document.activeElement;
    openLayers.push(layer);
  }

  function open(target, trigger) {
    const layer = resolveTarget(target);
    if (!layer) return null;
    const opener = trigger instanceof Element ? trigger : document.activeElement;
    if (!layer.hidden && layer.dataset.state === "open") return layer;

    layer.__bramsRestoreFocus = opener instanceof HTMLElement ? opener : null;
    layer.hidden = false;
    layer.dataset.state = "open";
    layer.setAttribute("aria-hidden", "false");
    rememberLayer(layer, opener);

    if (opener && opener.hasAttribute("aria-expanded")) opener.setAttribute("aria-expanded", "true");

    if (isModal(layer)) {
      document.body.classList.add("brams-scroll-locked");
      syncModalIsolation();
      requestAnimationFrame(() => {
        const preferred = layer.querySelector("[autofocus]");
        const focusable = visibleFocusable(layer);
        (preferred || focusable[0] || layer).focus({ preventScroll: true });
      });
    } else {
      requestAnimationFrame(() => positionFloating(layer, opener, layer.matches(".brams-tooltip") ? "tooltip" : "floating"));
    }

    emit(layer, "brams:open");
    return layer;
  }

  function close(target, options) {
    const layer = resolveTarget(target);
    if (!layer || layer.hidden) return layer;
    const settings = Object.assign({ restoreFocus: true }, options);
    const focusBeforeClose = document.activeElement;
    const index = openLayers.lastIndexOf(layer);
    if (index >= 0) openLayers.splice(index, 1);

    layer.hidden = true;
    layer.dataset.state = "closed";
    layer.setAttribute("aria-hidden", "true");
    layer.style.removeProperty("left");
    layer.style.removeProperty("top");
    if (layer.__bramsTrigger && layer.__bramsTrigger.hasAttribute("aria-expanded")) {
      layer.__bramsTrigger.setAttribute("aria-expanded", "false");
    }
    if (!openLayers.some((item) => isModal(item) && !item.hidden)) {
      document.body.classList.remove("brams-scroll-locked");
    }
    syncModalIsolation();
    const restoreTarget = layer.__bramsRestoreFocus;
    const shouldRestoreFocus = settings.restoreFocus
      && restoreTarget
      && restoreTarget.isConnected
      && (focusBeforeClose === document.body || layer.contains(focusBeforeClose));
    if (shouldRestoreFocus) {
      requestAnimationFrame(() => {
        const currentFocus = document.activeElement;
        if (restoreTarget.isConnected && (currentFocus === document.body || currentFocus === focusBeforeClose || !currentFocus?.isConnected)) {
          restoreTarget.focus({ preventScroll: true });
        }
      });
    }
    emit(layer, "brams:close");
    return layer;
  }

  function topLayer() {
    return [...openLayers].reverse().find((item) => item.isConnected && !item.hidden);
  }

  function trapFocus(event, layer) {
    if (!isModal(layer)) return;
    const focusable = visibleFocusable(layer);
    if (!focusable.length) {
      event.preventDefault();
      layer.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && (document.activeElement === first || !layer.contains(document.activeElement))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function closeOtherFloating(except, eventTarget) {
    [...openLayers].reverse().forEach((layer) => {
      if (layer === except || isModal(layer) || layer.hidden) return;
      if (layer.contains(eventTarget) || (layer.__bramsTrigger && layer.__bramsTrigger.contains(eventTarget))) return;
      close(layer, { restoreFocus: false });
    });
  }

  function initGlobalListeners() {
    if (globalListenersReady) return;
    globalListenersReady = true;

    document.addEventListener("keydown", (event) => {
      const layer = topLayer();
      if (!layer) return;
      if (event.key === "Escape") {
        event.preventDefault();
        close(layer);
      } else if (event.key === "Tab") {
        const topModal = [...openLayers].reverse().find((item) => isModal(item) && !item.hidden);
        if (topModal) trapFocus(event, topModal);
      }
    });

    document.addEventListener("pointerdown", (event) => closeOtherFloating(null, event.target));
    window.addEventListener("resize", () => {
      openLayers.forEach((layer) => {
        if (!isModal(layer)) positionFloating(layer, layer.__bramsTrigger, "floating");
      });
    });
    window.addEventListener("scroll", () => {
      openLayers.forEach((layer) => {
        if (!isModal(layer)) positionFloating(layer, layer.__bramsTrigger, "floating");
      });
    }, true);
  }

  function initOpenClose(root) {
    elements(root, "[data-brams-open]").forEach((trigger) => setup(trigger, "open", () => {
      trigger.addEventListener("click", () => open(trigger.dataset.bramsOpen, trigger));
    }));

    elements(root, "[data-brams-close]").forEach((trigger) => setup(trigger, "close", () => {
      trigger.addEventListener("click", () => {
        const explicit = trigger.dataset.bramsClose;
        close(explicit || trigger.closest(`${selector.modalLayer}, ${selector.floatingLayer}`));
      });
    }));

    elements(root, selector.modalLayer).forEach((layer) => setup(layer, "backdrop", () => {
      layer.addEventListener("pointerdown", (event) => {
        if (event.target === layer) close(layer);
      });
    }));
  }

  function activateTab(tab, tabs, focus) {
    tabs.forEach((item) => {
      const selected = item === tab;
      item.setAttribute("aria-selected", String(selected));
      item.tabIndex = selected ? 0 : -1;
      const panel = document.getElementById(item.getAttribute("aria-controls"));
      if (panel) panel.hidden = !selected;
    });
    if (focus) tab.focus();
  }

  function initTabs(root) {
    elements(root, "[data-brams-tabs]").forEach((tabsRoot) => setup(tabsRoot, "tabs", () => {
      const tabs = [...tabsRoot.querySelectorAll("[role='tab']")];
      tabs.forEach((tab) => {
        tab.addEventListener("click", () => activateTab(tab, tabs, false));
        tab.addEventListener("keydown", (event) => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
          event.preventDefault();
          const index = tabs.indexOf(tab);
          let next = index;
          if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
          if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
          if (event.key === "Home") next = 0;
          if (event.key === "End") next = tabs.length - 1;
          activateTab(tabs[next], tabs, true);
        });
      });
    }));
  }

  function initSegmented(root) {
    elements(root, "[data-brams-segmented]").forEach((group) => setup(group, "segmented", () => {
      const buttons = [...group.querySelectorAll("button:not([disabled])")];
      const select = (button, focus) => {
        buttons.forEach((item) => {
          const selected = item === button;
          item.setAttribute("aria-pressed", String(selected));
          item.tabIndex = selected ? 0 : -1;
        });
        if (focus) button.focus();
        group.dispatchEvent(new CustomEvent("change", { bubbles: true, detail: { value: button.value || button.textContent.trim() } }));
      };
      buttons.forEach((button) => {
        button.addEventListener("click", () => select(button, false));
        button.addEventListener("keydown", (event) => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
          event.preventDefault();
          const index = buttons.indexOf(button);
          let next = index;
          if (event.key === "ArrowRight") next = (index + 1) % buttons.length;
          if (event.key === "ArrowLeft") next = (index - 1 + buttons.length) % buttons.length;
          if (event.key === "Home") next = 0;
          if (event.key === "End") next = buttons.length - 1;
          select(buttons[next], true);
        });
      });
    }));
  }

  function initSwitches(root) {
    elements(root, ".brams-switch[role='switch']").forEach((control) => setup(control, "switch", () => {
      control.addEventListener("click", () => {
        if (control.disabled) return;
        const checked = control.getAttribute("aria-checked") === "true";
        control.setAttribute("aria-checked", String(!checked));
        control.dispatchEvent(new Event("change", { bubbles: true }));
      });
    }));
  }

  function initAccordion(root) {
    elements(root, "[data-brams-accordion]").forEach((accordion) => setup(accordion, "accordion", () => {
      const triggers = [...accordion.querySelectorAll("[data-brams-accordion-trigger]")];
      triggers.forEach((trigger) => trigger.addEventListener("click", () => {
        const expanded = trigger.getAttribute("aria-expanded") === "true";
        const panel = document.getElementById(trigger.getAttribute("aria-controls"));
        trigger.setAttribute("aria-expanded", String(!expanded));
        if (panel) panel.hidden = expanded;
      }));
    }));
  }

  function initRanges(root) {
    elements(root, "[data-brams-range]").forEach((range) => setup(range, "range", () => {
      const input = range.querySelector("input[type='range']");
      const output = range.querySelector("output");
      if (!input || !output) return;
      const update = () => {
        const suffix = range.dataset.bramsSuffix || "";
        output.value = `${input.value}${suffix}`;
        output.textContent = output.value;
      };
      input.addEventListener("input", update);
      update();
    }));
  }

  function initNumbers(root) {
    elements(root, "[data-brams-number]").forEach((stepper) => setup(stepper, "number", () => {
      const input = stepper.querySelector("input[type='number']");
      if (!input) return;
      stepper.querySelectorAll("[data-brams-number-action]").forEach((button) => {
        button.addEventListener("click", () => {
          if (input.disabled || input.readOnly) return;
          button.dataset.bramsNumberAction === "increment" ? input.stepUp() : input.stepDown();
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.dispatchEvent(new Event("change", { bubbles: true }));
        });
      });
    }));
  }

  function initPasswords(root) {
    elements(root, "[data-brams-password-toggle]").forEach((button) => setup(button, "password", () => {
      button.addEventListener("click", () => {
        const wrapper = button.closest(".brams-password");
        const input = wrapper && wrapper.querySelector("input");
        if (!input) return;
        const show = input.type === "password";
        input.type = show ? "text" : "password";
        button.setAttribute("aria-pressed", String(show));
        button.setAttribute("aria-label", show ? "Passwort ausblenden" : "Passwort anzeigen");
        const use = button.querySelector("use");
        if (use) use.setAttribute("href", `icons.svg#${show ? "eye-off" : "eye"}`);
      });
    }));
  }

  function initSearch(root) {
    elements(root, "[data-brams-search-clear]").forEach((button) => setup(button, "search", () => {
      const wrapper = button.closest(".brams-search");
      const input = wrapper && wrapper.querySelector("input");
      if (!input) return;
      const sync = () => { button.hidden = !input.value; };
      button.addEventListener("click", () => {
        input.value = "";
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.focus();
        sync();
      });
      input.addEventListener("input", sync);
      sync();
    }));
  }

  function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function initFiles(root) {
    elements(root, "[data-brams-file]").forEach((fileRoot) => setup(fileRoot, "file", () => {
      const input = fileRoot.querySelector("input[type='file']");
      const dropzone = fileRoot.querySelector(".brams-file__dropzone");
      const list = fileRoot.querySelector(".brams-file__list");
      if (!input || !dropzone || !list) return;

      const render = (files) => {
        list.replaceChildren();
        [...files].forEach((file) => {
          const item = document.createElement("li");
          item.className = "brams-file__item";
          const name = document.createElement("span");
          name.textContent = file.name;
          const size = document.createElement("span");
          size.className = "brams-muted brams-mono";
          size.textContent = formatBytes(file.size);
          item.append(name, size);
          list.append(item);
        });
        fileRoot.dataset.state = files.length ? "selected" : "empty";
      };

      input.addEventListener("change", () => render(input.files));
      ["dragenter", "dragover"].forEach((name) => dropzone.addEventListener(name, (event) => {
        event.preventDefault();
        dropzone.dataset.state = "dragover";
      }));
      ["dragleave", "drop"].forEach((name) => dropzone.addEventListener(name, (event) => {
        event.preventDefault();
        dropzone.dataset.state = "idle";
      }));
      dropzone.addEventListener("drop", (event) => {
        const files = event.dataTransfer.files;
        try { input.files = files; } catch (_) { /* Some browsers keep FileList read-only. */ }
        render(files);
        input.dispatchEvent(new Event("change", { bubbles: true }));
      });
    }));
  }

  function initPopovers(root) {
    elements(root, "[data-brams-popover]").forEach((trigger) => setup(trigger, "popover", () => {
      const target = trigger.dataset.bramsPopover;
      trigger.addEventListener("click", (event) => {
        event.stopPropagation();
        const layer = resolveTarget(target);
        if (!layer) return;
        if (layer.hidden) {
          closeOtherFloating(layer, trigger);
          open(layer, trigger);
        } else close(layer);
      });
    }));
  }

  function initTooltips(root) {
    elements(root, "[data-brams-tooltip]").forEach((trigger) => setup(trigger, "tooltip", () => {
      const tooltip = document.querySelector(trigger.dataset.bramsTooltip);
      if (!tooltip) return;
      const show = () => {
        tooltip.hidden = false;
        tooltip.setAttribute("aria-hidden", "false");
        tooltip.__bramsTrigger = trigger;
        positionFloating(tooltip, trigger, "tooltip");
      };
      const hide = () => {
        if (trigger.matches(":hover") || document.activeElement === trigger) return;
        tooltip.hidden = true;
        tooltip.setAttribute("aria-hidden", "true");
      };
      const forceHide = () => {
        tooltip.hidden = true;
        tooltip.setAttribute("aria-hidden", "true");
      };
      trigger.addEventListener("mouseenter", show);
      trigger.addEventListener("mouseleave", hide);
      trigger.addEventListener("focus", show);
      trigger.addEventListener("blur", hide);
      trigger.addEventListener("keydown", (event) => { if (event.key === "Escape") forceHide(); });
    }));
  }

  function menuItems(menu) {
    return [...menu.querySelectorAll("[role='menuitem']:not([disabled])")];
  }

  function initMenus(root) {
    elements(root, "[data-brams-menu]").forEach((trigger) => setup(trigger, "menu", () => {
      const menu = document.querySelector(trigger.dataset.bramsMenu);
      if (!menu) return;
      const show = (focusIndex) => {
        closeOtherFloating(menu, trigger);
        open(menu, trigger);
        const items = menuItems(menu);
        if (items.length && focusIndex != null) items[focusIndex].focus({ preventScroll: true });
      };
      trigger.addEventListener("click", (event) => {
        event.stopPropagation();
        menu.hidden ? show(null) : close(menu);
      });
      trigger.addEventListener("keydown", (event) => {
        if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        const items = menuItems(menu);
        show(event.key === "ArrowUp" || event.key === "End" ? items.length - 1 : 0);
      });
      menu.addEventListener("keydown", (event) => {
        const items = menuItems(menu);
        const index = items.indexOf(document.activeElement);
        if (event.key === "Escape") {
          event.preventDefault();
          close(menu);
          return;
        }
        if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        let next = index;
        if (event.key === "ArrowDown") next = (index + 1) % items.length;
        if (event.key === "ArrowUp") next = (index - 1 + items.length) % items.length;
        if (event.key === "Home") next = 0;
        if (event.key === "End") next = items.length - 1;
        items[next].focus();
      });
      menu.addEventListener("click", (event) => {
        if (event.target.closest("[role='menuitem']")) close(menu);
      });
    }));
  }

  function initAlerts(root) {
    elements(root, "[data-brams-alert-dismiss]").forEach((button) => setup(button, "alert", () => {
      button.addEventListener("click", () => {
        const alert = button.closest(".brams-alert");
        if (alert) alert.remove();
      });
    }));
  }

  function initToastTriggers(root) {
    elements(root, "[data-brams-toast-trigger]").forEach((button) => setup(button, "toast-trigger", () => {
      button.addEventListener("click", () => toast({
        title: button.dataset.bramsToastTitle || "Hinweis",
        message: button.dataset.bramsToastMessage || "",
        tone: button.dataset.bramsToastTone || "neutral",
        duration: button.dataset.bramsToastDuration == null ? 5000 : Number(button.dataset.bramsToastDuration),
      }));
    }));
  }

  function initNativeStates(root) {
    elements(root, "input[type='checkbox'][data-brams-indeterminate]").forEach((input) => setup(input, "indeterminate", () => {
      input.indeterminate = true;
    }));
  }

  function initPagination(root) {
    elements(root, "[data-brams-pagination]").forEach((pagination) => setup(pagination, "pagination", () => {
      const buttons = [...pagination.querySelectorAll("[data-page]")];
      const statusSelector = pagination.dataset.bramsStatus;
      const status = statusSelector && document.querySelector(statusSelector);
      const update = (page) => {
        buttons.forEach((button) => {
          const current = Number(button.dataset.page) === page;
          if (current) button.setAttribute("aria-current", "page");
          else button.removeAttribute("aria-current");
        });
        const prev = pagination.querySelector("[data-brams-page='previous']");
        const next = pagination.querySelector("[data-brams-page='next']");
        if (prev) prev.disabled = page <= 1;
        if (next) next.disabled = page >= buttons.length;
        if (status) status.textContent = `Datensätze ${(page - 1) * 10 + 1}–${page * 10} von ${buttons.length * 10}`;
        pagination.dataset.page = String(page);
      };
      buttons.forEach((button) => button.addEventListener("click", () => update(Number(button.dataset.page))));
      pagination.querySelectorAll("[data-brams-page]").forEach((button) => button.addEventListener("click", () => {
        const current = Number(pagination.dataset.page || 1);
        update(button.dataset.bramsPage === "previous" ? current - 1 : current + 1);
      }));
      update(Number(pagination.dataset.page || 1));
    }));
  }

  function initSteppers(root) {
    elements(root, "[data-brams-process]").forEach((process) => setup(process, "process", () => {
      const steps = [...process.querySelectorAll(".brams-stepper__item")];
      const controls = process.parentElement.querySelectorAll("[data-brams-step-action]");
      const update = (index) => {
        const bounded = Math.max(0, Math.min(index, steps.length - 1));
        steps.forEach((step, stepIndex) => {
          step.dataset.state = stepIndex < bounded ? "complete" : stepIndex === bounded ? "current" : "upcoming";
          step.setAttribute("aria-current", stepIndex === bounded ? "step" : "false");
        });
        process.dataset.step = String(bounded);
      };
      controls.forEach((button) => button.addEventListener("click", () => {
        const current = Number(process.dataset.step || 0);
        update(current + (button.dataset.bramsStepAction === "next" ? 1 : -1));
      }));
      update(Number(process.dataset.step || 0));
    }));
  }

  function sortValue(row, index, type) {
    const cell = row.cells[index];
    const raw = cell ? (cell.dataset.value || cell.textContent.trim()) : "";
    return type === "number" ? Number(raw.replace(/[^0-9,.-]/g, "").replace(",", ".")) : raw.toLocaleLowerCase("de");
  }

  function initTables(root) {
    elements(root, "[data-brams-sortable]").forEach((table) => setup(table, "table", () => {
      table.querySelectorAll("[data-brams-sort]").forEach((button) => button.addEventListener("click", () => {
        const header = button.closest("th");
        const index = [...header.parentElement.children].indexOf(header);
        const direction = header.getAttribute("aria-sort") === "ascending" ? "descending" : "ascending";
        table.querySelectorAll("th[aria-sort]").forEach((item) => item.setAttribute("aria-sort", "none"));
        header.setAttribute("aria-sort", direction);
        const rows = [...table.tBodies[0].rows];
        const type = button.dataset.bramsSort || "string";
        rows.sort((a, b) => {
          const av = sortValue(a, index, type);
          const bv = sortValue(b, index, type);
          const result = typeof av === "number" ? av - bv : av.localeCompare(bv, "de");
          return direction === "ascending" ? result : -result;
        });
        rows.forEach((row) => table.tBodies[0].append(row));
      }));
    }));
  }

  function removeToast(toast) {
    if (!toast || !toast.isConnected) return;
    toast.dataset.state = "closing";
    const delay = matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 180;
    window.setTimeout(() => toast.remove(), delay);
  }

  function toast(options) {
    const settings = Object.assign({ title: "Hinweis", message: "", tone: "neutral", duration: 5000 }, options);
    const tones = ["neutral", "success", "warning", "danger"];
    if (!tones.includes(settings.tone)) settings.tone = "neutral";
    let region = document.querySelector(".brams-toast-region");
    if (!region) {
      region = document.createElement("div");
      region.className = "brams-toast-region";
      region.setAttribute("role", "region");
      region.setAttribute("aria-label", "Benachrichtigungen");
      region.setAttribute("aria-live", "polite");
      document.body.append(region);
    }

    const item = document.createElement("div");
    item.className = `brams-toast${settings.tone === "neutral" ? "" : ` brams-toast--${settings.tone}`}`;
    item.setAttribute("role", settings.tone === "danger" ? "alert" : "status");
    item.setAttribute("aria-atomic", "true");
    item.dataset.state = "open";
    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    icon.setAttribute("class", "brams-icon");
    icon.setAttribute("aria-hidden", "true");
    const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
    use.setAttribute("href", `icons.svg#${settings.tone === "success" ? "check" : settings.tone === "warning" ? "warning" : settings.tone === "danger" ? "error" : "info"}`);
    icon.append(use);
    const content = document.createElement("div");
    const title = document.createElement("h3");
    title.className = "brams-toast__title";
    title.textContent = settings.title;
    content.append(title);
    if (settings.message) {
      const message = document.createElement("p");
      message.className = "brams-toast__message";
      message.textContent = settings.message;
      content.append(message);
    }
    const dismiss = document.createElement("button");
    dismiss.className = "brams-icon-button brams-icon-button--quiet brams-icon-button--sm";
    dismiss.type = "button";
    dismiss.setAttribute("aria-label", "Benachrichtigung schließen");
    dismiss.innerHTML = '<svg class="brams-icon" aria-hidden="true"><use href="icons.svg#close"></use></svg>';
    dismiss.addEventListener("click", () => removeToast(item));
    item.append(icon, content, dismiss);
    region.append(item);
    if (Number(settings.duration) > 0) window.setTimeout(() => removeToast(item), Number(settings.duration));
    return item;
  }

  function init(root) {
    const scope = root && (root.querySelectorAll || root instanceof Element) ? root : document;
    initGlobalListeners();
    initOpenClose(scope);
    initTabs(scope);
    initSegmented(scope);
    initSwitches(scope);
    initAccordion(scope);
    initRanges(scope);
    initNumbers(scope);
    initPasswords(scope);
    initSearch(scope);
    initFiles(scope);
    initPopovers(scope);
    initTooltips(scope);
    initMenus(scope);
    initAlerts(scope);
    initToastTriggers(scope);
    initNativeStates(scope);
    initPagination(scope);
    initSteppers(scope);
    initTables(scope);
    return scope;
  }

  window.Brams = Object.freeze({ VERSION, init, open, close, toast });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => init(document), { once: true });
  } else {
    init(document);
  }
}());
