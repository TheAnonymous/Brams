(function () {
  "use strict";

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const componentSelector = ".brams-catalog-component";

  function normalize(value) {
    return value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("de")
      .trim();
  }

  function scrollBehavior() {
    return reducedMotion.matches ? "auto" : "smooth";
  }

  function componentData(article) {
    const section = article.closest(".brams-catalog-section");
    const data = {
      element: article,
      id: article.id,
      number: article.querySelector(".brams-catalog-component__number")?.textContent.trim() || "",
      title: article.querySelector(".brams-card__title")?.textContent.trim() || "",
      description: article.querySelector(".brams-card__description")?.textContent.trim() || "",
      api: article.querySelector(".brams-catalog-code")?.textContent.trim() || "",
      category: section?.querySelector(".brams-catalog-section__title")?.textContent.trim() || "Komponenten",
    };
    data.search = normalize([data.number, data.title, data.description, data.id, data.api].join(" "));
    return data;
  }

  function initFinder() {
    const finder = document.querySelector("[data-brams-demo-finder]");
    if (!finder) return;

    const input = finder.querySelector("[data-brams-demo-search]");
    const panel = finder.querySelector("[data-brams-demo-results]");
    const status = finder.querySelector("[data-brams-demo-search-status]");
    const components = [...document.querySelectorAll(componentSelector)].map(componentData);
    let options = [];
    let activeIndex = -1;

    function closeResults() {
      panel.hidden = true;
      input.setAttribute("aria-expanded", "false");
      input.removeAttribute("aria-activedescendant");
      activeIndex = -1;
    }

    function announce(matches, query) {
      if (!matches.length) {
        status.textContent = `Keine Komponenten für „${query}“ gefunden.`;
      } else if (query) {
        status.textContent = `${matches.length} ${matches.length === 1 ? "Komponente" : "Komponenten"} gefunden.`;
      } else {
        status.textContent = `Alle ${matches.length} Komponenten verfügbar.`;
      }
    }

    function setActive(index) {
      if (!options.length) return;
      activeIndex = (index + options.length) % options.length;
      options.forEach((option, optionIndex) => option.setAttribute("aria-selected", String(optionIndex === activeIndex)));
      const current = options[activeIndex];
      input.setAttribute("aria-activedescendant", current.id);
      current.scrollIntoView({ block: "nearest" });
    }

    function jumpTo(id) {
      const target = document.getElementById(id);
      if (!target) return;
      history.pushState(null, "", `#${id}`);
      target.tabIndex = -1;
      target.focus({ preventScroll: true });
      target.scrollIntoView({ behavior: scrollBehavior(), block: "start" });
      closeResults();
      updateCatalogNavigation(target.closest(".brams-catalog-section")?.id || id);
    }

    function render() {
      const query = normalize(input.value);
      const matches = components.filter((component) => !query || component.search.includes(query));
      const groups = new Map();
      matches.forEach((component) => {
        const group = groups.get(component.category) || [];
        group.push(component);
        groups.set(component.category, group);
      });

      panel.replaceChildren();
      groups.forEach((items, category) => {
        const group = document.createElement("section");
        group.className = "brams-catalog-finder__group";
        group.setAttribute("role", "group");
        const heading = document.createElement("h3");
        heading.className = "brams-catalog-finder__group-title";
        heading.id = `finder-group-${items[0].element.closest(".brams-catalog-section").id}`;
        heading.textContent = category;
        group.setAttribute("aria-labelledby", heading.id);
        const list = document.createElement("div");
        list.className = "brams-catalog-finder__list";
        items.forEach((component) => {
          const option = document.createElement("button");
          option.className = "brams-catalog-finder__result";
          option.type = "button";
          option.id = `finder-result-${component.id}`;
          option.dataset.bramsDemoTarget = component.id;
          option.setAttribute("role", "option");
          option.setAttribute("aria-selected", "false");
          const index = document.createElement("span");
          index.className = "brams-catalog-finder__number";
          index.textContent = component.number;
          const copy = document.createElement("span");
          const title = document.createElement("strong");
          title.textContent = component.title;
          const api = document.createElement("code");
          api.textContent = component.api;
          copy.append(title, api);
          option.append(index, copy);
          option.addEventListener("pointermove", () => setActive(options.indexOf(option)));
          option.addEventListener("click", () => jumpTo(component.id));
          list.append(option);
        });
        group.append(heading, list);
        panel.append(group);
      });

      if (!matches.length) {
        const empty = document.createElement("p");
        empty.className = "brams-catalog-finder__empty";
        empty.textContent = "Keine passende Komponente. Suche nach Name, Nummer, ID oder API-Bezeichnung.";
        panel.append(empty);
      }

      options = [...panel.querySelectorAll("[role='option']")];
      activeIndex = -1;
      input.removeAttribute("aria-activedescendant");
      panel.hidden = false;
      input.setAttribute("aria-expanded", "true");
      announce(matches, input.value.trim());
    }

    input.addEventListener("focus", render);
    input.addEventListener("input", render);
    input.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        if (panel.hidden) render();
        const next = activeIndex < 0
          ? (event.key === "ArrowDown" ? 0 : options.length - 1)
          : activeIndex + (event.key === "ArrowDown" ? 1 : -1);
        setActive(next);
      } else if (event.key === "Enter" && options.length) {
        event.preventDefault();
        const option = options[activeIndex < 0 ? 0 : activeIndex];
        jumpTo(option.dataset.bramsDemoTarget);
      } else if (event.key === "Escape") {
        event.preventDefault();
        if (input.value) {
          input.value = "";
          status.textContent = "Suche geleert.";
        }
        closeResults();
      }
    });

    document.addEventListener("keydown", (event) => {
      const target = event.target;
      const isEditing = target instanceof HTMLInputElement
        || target instanceof HTMLTextAreaElement
        || target instanceof HTMLSelectElement
        || target?.isContentEditable;
      if (event.key === "/" && !event.metaKey && !event.ctrlKey && !event.altKey && !isEditing) {
        event.preventDefault();
        input.focus();
        input.select();
      }
    });
    document.addEventListener("pointerdown", (event) => {
      if (!finder.contains(event.target)) closeResults();
    });
  }

  function snippetText(template) {
    return template.innerHTML.trim().replace(/^\n+|\n+$/g, "");
  }

  function copyFallback(block, value) {
    const textarea = block.querySelector("[data-brams-demo-manual-copy]");
    const status = block.querySelector("[data-brams-demo-copy-status]");
    textarea.hidden = false;
    textarea.value = value;
    textarea.focus();
    textarea.select();
    status.textContent = "Manuell kopieren: Der vollständige Code ist markiert.";
  }

  function initCodeExamples() {
    const templates = [...document.querySelectorAll("template[data-brams-demo-snippet]")];
    const byComponent = new Map();
    templates.forEach((template) => {
      const snippets = byComponent.get(template.dataset.bramsDemoSnippet) || [];
      snippets.push(template);
      byComponent.set(template.dataset.bramsDemoSnippet, snippets);
    });

    document.querySelectorAll(componentSelector).forEach((article) => {
      const snippets = byComponent.get(article.id) || [];
      if (!snippets.length) return;
      const title = article.querySelector(".brams-card__title")?.textContent.trim() || article.id;
      const header = article.querySelector(".brams-catalog-component__header");
      const api = header.querySelector(".brams-catalog-code");
      const tools = document.createElement("div");
      tools.className = "brams-catalog-component__tools";
      const toggle = document.createElement("button");
      const panelId = `code-${article.id}`;
      toggle.className = "brams-button brams-button--quiet brams-button--sm brams-catalog-code-toggle";
      toggle.type = "button";
      toggle.id = `code-toggle-${article.id}`;
      toggle.dataset.bramsDemoCodeToggle = article.id;
      toggle.setAttribute("aria-controls", panelId);
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-label", `Code anzeigen: ${title}`);
      toggle.textContent = "Code anzeigen";
      tools.append(api, toggle);
      header.append(tools);

      const panel = document.createElement("section");
      panel.className = "brams-catalog-code-panel";
      panel.id = panelId;
      panel.hidden = true;
      panel.setAttribute("role", "region");
      panel.setAttribute("aria-labelledby", toggle.id);
      snippets.forEach((template) => {
        const value = snippetText(template);
        const language = template.dataset.language || "html";
        const block = document.createElement("div");
        block.className = "brams-catalog-code-block";
        const blockHeader = document.createElement("div");
        blockHeader.className = "brams-catalog-code-block__header";
        const label = document.createElement("span");
        label.textContent = language === "javascript" ? "JavaScript" : "HTML";
        const copy = document.createElement("button");
        copy.className = "brams-button brams-button--quiet brams-button--sm";
        copy.type = "button";
        copy.dataset.bramsDemoCopy = language;
        copy.textContent = "Kopieren";
        const pre = document.createElement("pre");
        const code = document.createElement("code");
        code.textContent = value;
        pre.append(code);
        const manual = document.createElement("textarea");
        manual.className = "brams-catalog-manual-copy";
        manual.dataset.bramsDemoManualCopy = "";
        manual.readOnly = true;
        manual.hidden = true;
        manual.setAttribute("aria-label", `${label.textContent}-Code manuell kopieren`);
        const copyStatus = document.createElement("p");
        copyStatus.className = "brams-catalog-copy-status";
        copyStatus.dataset.bramsDemoCopyStatus = "";
        copyStatus.setAttribute("aria-live", "polite");
        copy.addEventListener("click", async () => {
          try {
            if (!navigator.clipboard?.writeText) throw new Error("Clipboard API nicht verfügbar");
            await navigator.clipboard.writeText(value);
            copyStatus.textContent = "Code kopiert.";
            window.Brams?.toast({ title: "Code kopiert", message: `${title} · ${label.textContent}`, tone: "success", duration: 2400 });
          } catch (_) {
            copyFallback(block, value);
          }
        });
        blockHeader.append(label, copy);
        block.append(blockHeader, pre, manual, copyStatus);
        panel.append(block);
      });
      article.append(panel);
      article.dataset.bramsDemoDocumented = "true";

      toggle.addEventListener("click", () => {
        const expanded = toggle.getAttribute("aria-expanded") === "true";
        toggle.setAttribute("aria-expanded", String(!expanded));
        toggle.setAttribute("aria-label", `${expanded ? "Code anzeigen" : "Code verbergen"}: ${title}`);
        toggle.textContent = expanded ? "Code anzeigen" : "Code verbergen";
        panel.hidden = expanded;
      });
    });
  }

  let navFrame = 0;

  function ensureNavLinkVisible(nav, link) {
    if (!window.matchMedia("(max-width: 62rem)").matches) return;
    const left = link.offsetLeft - ((nav.clientWidth - link.offsetWidth) / 2);
    nav.scrollTo({ left: Math.max(0, left), behavior: scrollBehavior() });
  }

  function updateCatalogNavigation(id) {
    const nav = document.querySelector("[data-brams-demo-catalog-nav]");
    if (!nav || !id) return;
    const target = document.getElementById(id);
    const sectionId = target?.matches(".brams-catalog-section") ? target.id : target?.closest(".brams-catalog-section")?.id;
    const active = [...nav.querySelectorAll("a[href^='#']")].find((link) => link.hash === `#${sectionId}`);
    if (!active) return;
    nav.querySelectorAll("a[href^='#']").forEach((link) => link.setAttribute("aria-current", String(link === active)));
    ensureNavLinkVisible(nav, active);
  }

  function initCatalogNavigation() {
    const nav = document.querySelector("[data-brams-demo-catalog-nav]");
    if (!nav) return;
    const links = [...nav.querySelectorAll("a[href^='#']")];
    const sections = links.map((link) => document.querySelector(link.hash)).filter(Boolean);
    const updateFromScroll = () => {
      navFrame = 0;
      const offset = window.innerWidth <= 992 ? 132 : 96;
      const passed = sections.filter((section) => section.getBoundingClientRect().top <= offset);
      const current = passed.at(-1) || sections[0];
      if (current) updateCatalogNavigation(current.id);
    };
    links.forEach((link) => link.addEventListener("click", () => updateCatalogNavigation(link.hash.slice(1))));
    window.addEventListener("scroll", () => {
      if (!navFrame) navFrame = requestAnimationFrame(updateFromScroll);
    }, { passive: true });
    window.addEventListener("resize", updateFromScroll);
    window.addEventListener("hashchange", () => updateCatalogNavigation(location.hash.slice(1)));
    updateCatalogNavigation(location.hash.slice(1));
    updateFromScroll();
  }

  function init() {
    initCodeExamples();
    initFinder();
    initCatalogNavigation();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
}());
