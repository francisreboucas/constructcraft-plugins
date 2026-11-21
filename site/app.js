// marketplace.constructcraft.net: the plugins of index.json (built from
// plugins/*.toml when the site is deployed). Plugin data is only ever put in
// the page as text, never as markup.
"use strict";

(function () {
  const REPO = "https://github.com/francisreboucas/constructcraft-plugins";
  const PALETTE = ["#ff8a1f", "#6d5cff", "#0ea5c6", "#db2777", "#16a34a", "#4157ee", "#d97706", "#0891b2"];

  const state = { lang: "en", plugins: [], tag: null, query: "", noPerms: false, loaded: false, failed: false };
  const $ = (id) => document.getElementById(id);

  const t = (en, pt) => (state.lang === "pt-BR" ? pt : en);

  /* ---------- helpers ---------- */
  function el(tag, attrs, ...children) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === "class") e.className = v;
      else if (k === "style") e.style.cssText = v;
      else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? "" : v);
    }
    for (const c of children.flat()) if (c != null && c !== false) e.append(c instanceof Node ? c : String(c));
    return e;
  }
  const svg = (path) => {
    const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    s.setAttribute("viewBox", "0 0 24 24");
    s.setAttribute("fill", "none");
    s.setAttribute("stroke", "currentColor");
    s.setAttribute("stroke-width", "2");
    s.setAttribute("stroke-linecap", "round");
    s.setAttribute("stroke-linejoin", "round");
    s.setAttribute("aria-hidden", "true");
    s.innerHTML = `<path d="${path}"/>`; // constant paths only
    return s;
  };
  const ICON = {
    download: "M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M5 20h14",
    code: "m8 8-4 4 4 4m8-8 4 4-4 4",
    home: "M7 17 17 7M8 7h9v9",
    copy: "M9 9h10v10H9zM5 15V5h10",
  };
  const safeUrl = (u) => (typeof u === "string" && /^https:\/\//.test(u) ? u : null);
  const fileName = (u) => { try { return decodeURIComponent(new URL(u).pathname.split("/").pop()) || "plugin.zip"; } catch (_) { return "plugin.zip"; } };
  const color = (id) => { let h = 0; for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return PALETTE[h % PALETTE.length]; };
  const initials = (name) => {
    const w = String(name).split(/[\s_-]+/).filter(Boolean);
    return ((w[0] || "?")[0] + (w[1] ? w[1][0] : (w[0] || "").slice(1, 2))).toUpperCase();
  };
  const norm = (s) => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const latest = (p) => (p.versions && p.versions[0]) || {};

  function permText(perm) {
    if (perm === "files") return t("reads and writes files", "lê e grava arquivos");
    if (perm === "tools") return t("runs external programs", "roda programas externos");
    return perm;
  }

  /* ---------- filtering ---------- */
  function matches(p) {
    if (state.tag && !(p.tags || []).includes(state.tag)) return false;
    if (state.noPerms && (latest(p).permissions || []).length) return false;
    const words = norm(state.query).split(/\s+/).filter(Boolean);
    return words.every((w) => p._search.includes(w));
  }

  /* ---------- rendering ---------- */
  function renderStats() {
    if (!state.loaded) return;
    const authors = new Set(state.plugins.flatMap((p) => p.authors || []));
    const versions = state.plugins.reduce((n, p) => n + (p.versions || []).length, 0);
    $("stat-plugins").textContent = state.plugins.length;
    $("stat-authors").textContent = authors.size;
    $("stat-versions").textContent = versions;
    const n = state.plugins.length;
    document.querySelectorAll(".hero-count").forEach((e) => {
      e.textContent = t(`${n} plugin${n === 1 ? "" : "s"} in the index`, `${n} plugin${n === 1 ? "" : "s"} no índice`);
    });
  }

  function renderTags() {
    const box = $("tags");
    const counts = new Map();
    for (const p of state.plugins) for (const tg of p.tags || []) counts.set(tg, (counts.get(tg) || 0) + 1);
    if (!counts.size) { box.replaceChildren(); return; }
    const chip = (tg, label, n) => el("button", {
      type: "button", class: "chip", "aria-pressed": String(state.tag === tg),
      onclick: () => { state.tag = state.tag === tg ? null : tg; renderList(); renderTags(); },
    }, label, n != null ? el("i", null, n) : null);
    box.replaceChildren(
      chip(null, t("All", "Todos"), state.plugins.length),
      ...[...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([tg, n]) => chip(tg, tg, n)),
    );
  }

  function badges(p, withTags) {
    const v = latest(p);
    const perms = v.permissions || [];
    const ul = el("ul", { class: "badges" });
    if (v.api != null) ul.append(el("li", { class: "api" }, `API ${v.api}`));
    if (!perms.length) ul.append(el("li", { class: "safe" }, t("No permissions", "Sem permissões")));
    for (const perm of perms) ul.append(el("li", { class: "perm", title: permText(perm) }, perm));
    if (withTags) for (const tg of p.tags || []) ul.append(el("li", null, `#${tg}`));
    return ul;
  }

  function downloadBtn(v, cls) {
    const url = safeUrl(v.url);
    if (!url) return null;
    return el("a", { class: `btn primary ${cls || ""}`, href: url, rel: "noopener" },
      svg(ICON.download), t("Download", "Baixar"));
  }

  function card(p) {
    const v = latest(p);
    const c = color(p.id);
    return el("article", { class: "plug", style: `--c:${c}` },
      el("div", { class: "plug-head" },
        el("div", { class: "mono", "aria-hidden": "true" }, initials(p.name)),
        el("div", { class: "plug-title" },
          el("h3", null, el("a", { href: `#plugin/${p.id}` }, p.name)),
          el("div", { class: "plug-by" }, (p.authors || []).join(", ")),
        ),
        v.version ? el("span", { class: "ver-pill" }, `v${v.version}`) : null,
      ),
      el("p", { class: "plug-desc" }, p.description),
      badges(p, true),
      el("div", { class: "plug-foot" },
        el("span", { class: "lic" }, p.license || ""),
        el("a", { class: "btn small", href: `#plugin/${p.id}` }, t("Details", "Detalhes")),
        downloadBtn(v, "small"),
      ),
    );
  }

  function inviteCard() {
    return el("div", { class: "plug invite" },
      el("div", { class: "mono", "aria-hidden": "true" }, "+"),
      el("h3", null, t("Your plugin here", "O seu plugin aqui")),
      el("p", null, t(
        "Wrote a command others could use? Publish it with one pull request.",
        "Escreveu um comando que outros podem usar? Publique com um pull request.")),
      el("a", { class: "btn small", href: "#publish" }, t("How to publish", "Como publicar"), " →"),
    );
  }

  function renderList() {
    const grid = $("grid");
    const status = $("status");
    if (state.failed) {
      status.textContent = "";
      grid.replaceChildren(el("div", { class: "empty" },
        t("Could not load the index. ", "Não foi possível carregar o índice. "),
        el("a", { href: `${REPO}/tree/main/plugins` }, t("See the entries on GitHub", "Veja as entradas no GitHub"))));
      return;
    }
    if (!state.loaded) {
      status.textContent = t("Loading…", "Carregando…");
      grid.replaceChildren(...[0, 1, 2].map(() => el("div", { class: "plug skeleton" }, el("span"), el("span"), el("span"), el("span"))));
      return;
    }
    const shown = state.plugins.filter(matches);
    const total = state.plugins.length;
    status.textContent = shown.length === total
      ? t(`${total} plugin${total === 1 ? "" : "s"}`, `${total} plugin${total === 1 ? "" : "s"}`)
      : t(`${shown.length} of ${total} plugins`, `${shown.length} de ${total} plugins`);
    const cards = shown.map(card);
    if (!shown.length) cards.push(el("div", { class: "empty" }, t("No plugin matches. ", "Nenhum plugin encontrado. "),
      el("a", { href: "#plugins", onclick: (e) => { e.preventDefault(); clearFilters(); } }, t("Clear the filters", "Limpar os filtros"))));
    cards.push(inviteCard());
    grid.replaceChildren(...cards);
  }

  function clearFilters() {
    state.tag = null; state.query = ""; state.noPerms = false;
    $("q").value = ""; $("no-perms").checked = false;
    renderTags(); renderList();
  }

  /* ---------- detail ---------- */
  function copyButton(text) {
    const b = el("button", { type: "button", class: "btn small", title: t("Copy", "Copiar") }, svg(ICON.copy), t("Copy", "Copiar"));
    b.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(text);
        b.lastChild.textContent = t("Copied", "Copiado");
        setTimeout(() => { b.lastChild.textContent = t("Copy", "Copiar"); }, 1600);
      } catch (_) { /* clipboard blocked: the text stays selectable */ }
    });
    return b;
  }

  function detail(p) {
    const v = latest(p);
    const perms = v.permissions || [];
    const zip = fileName(v.url);
    const repo = safeUrl(p.repository);
    const home = safeUrl(p.homepage);

    const facts = el("dl", { class: "d-facts" });
    const fact = (k, val) => { if (val) facts.append(el("dt", null, k), el("dd", null, val)); };
    fact("Id", el("code", null, p.id));
    fact(t("Authors", "Autores"), (p.authors || []).join(", "));
    fact(t("License", "Licença"), p.license);
    fact(t("Plugin API", "API de plugins"), v.api != null ? String(v.api) : null);
    fact(t("Needs ConstructCraft", "Requer ConstructCraft"), v.min_app ? `≥ ${v.min_app}` : null);
    fact(t("Commands", "Comandos"), el("code", null, `${p.id}__<command>`));
    fact("Tags", (p.tags || []).map((x) => `#${x}`).join("  "));

    const permNote = perms.length
      ? el("p", { class: "perm-note warn" }, el("b", null, t("Asks for: ", "Pede: ")),
          perms.map((x) => `${x} (${permText(x)})`).join("; "), ". ",
          t("Read its code before you grant it.", "Leia o código antes de conceder."))
      : el("p", { class: "perm-note ok" }, el("b", null, t("No permissions. ", "Sem permissões. ")),
          t("It reaches the project only through ConstructCraft's commands.", "Só chega ao projeto pelos comandos do ConstructCraft."));

    const rows = (p.versions || []).map((x, i) => {
      const u = safeUrl(x.url);
      return el("tr", null,
        el("td", null, u ? el("a", { href: u, rel: "noopener" }, x.version) : x.version, i === 0 ? el("span", { class: "latest" }, t("latest", "atual")) : null),
        el("td", null, String(x.api)),
        el("td", null, (x.permissions || []).length ? x.permissions.join(", ") : "—"),
        el("td", null, x.notes || ""),
      );
    });

    return el("div", { style: `--c:${color(p.id)}` },
      el("div", { class: "d-head" },
        el("div", { class: "mono", "aria-hidden": "true" }, initials(p.name)),
        el("div", null,
          el("h2", { id: "detail-title" }, p.name),
          el("div", { class: "plug-by" }, v.version ? `v${v.version} · ` : "", (p.authors || []).join(", ")),
        ),
      ),
      el("p", { class: "d-desc" }, p.description),
      badges(p, false),
      permNote,
      el("div", { class: "d-actions" },
        v.url ? el("a", { class: "btn primary", href: safeUrl(v.url), rel: "noopener" }, svg(ICON.download), `${t("Download", "Baixar")} v${v.version}`) : null,
        repo ? el("a", { class: "btn", href: repo, rel: "noopener" }, svg(ICON.code), t("Source code", "Código-fonte")) : null,
        home && home !== repo ? el("a", { class: "btn", href: home, rel: "noopener" }, svg(ICON.home), t("Homepage", "Página")) : null,
      ),
      el("h3", { class: "d-h" }, "SHA-256"),
      el("div", { class: "sha-row" }, el("code", null, v.sha256 || "—"), v.sha256 ? copyButton(v.sha256) : null),
      el("h3", { class: "d-h" }, t("Install", "Instalar")),
      el("pre", null, el("code", null,
        `ccad plugins install ${zip} ./plugins\nccad --plugins ./plugins plugins`)),
      el("h3", { class: "d-h" }, t("About", "Sobre")),
      facts,
      el("h3", { class: "d-h" }, t("Versions", "Versões")),
      el("div", { class: "table-scroll" }, el("table", { class: "vers" },
        el("thead", null, el("tr", null,
          el("th", null, t("Version", "Versão")), el("th", null, "API"),
          el("th", null, t("Permissions", "Permissões")), el("th", null, t("Notes", "Notas")))),
        el("tbody", null, rows))),
    );
  }

  function route() {
    const dlg = $("detail");
    const m = /^#plugin\/([a-z0-9_]+)$/.exec(location.hash);
    const p = m && state.plugins.find((x) => x.id === m[1]);
    if (p) {
      $("detail-body").replaceChildren(detail(p));
      document.title = `${p.name} — ConstructCraft Plugins`;
      if (!dlg.open) dlg.showModal();
      dlg.scrollTop = 0;
    } else {
      document.title = "ConstructCraft Plugins — Marketplace";
      if (dlg.open) dlg.close();
    }
  }

  function closeDetail() {
    if (/^#plugin\//.test(location.hash)) history.replaceState(null, "", "#plugins");
    route();
  }

  /* ---------- language ---------- */
  function setLang(l) {
    state.lang = l;
    document.documentElement.setAttribute("data-lang", l);
    document.documentElement.lang = l;
    document.querySelectorAll("[data-set-lang]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.setLang === l)));
    $("q").placeholder = t("Search by name, author or tag…", "Buscar por nome, autor ou tag…");
    try { localStorage.setItem("lang", l); } catch (_) { /* storage blocked */ }
    renderStats(); renderTags(); renderList();
    if ($("detail").open) route();
  }

  /* ---------- data ---------- */
  async function load() {
    renderList();
    try {
      const res = await fetch("index.json", { cache: "no-cache" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      state.plugins = (Array.isArray(data.plugins) ? data.plugins : [])
        .filter((p) => p && typeof p.id === "string" && typeof p.name === "string")
        .map((p) => ({ ...p, _search: norm([p.id, p.name, p.description, ...(p.authors || []), ...(p.tags || [])].join(" ")) }))
        .sort((a, b) => a.name.localeCompare(b.name));
      state.loaded = true;
    } catch (err) {
      console.error("index.json:", err);
      state.failed = true;
    }
    renderStats(); renderTags(); renderList(); route();
  }

  /* ---------- wiring ---------- */
  document.addEventListener("DOMContentLoaded", () => {
    let saved = null;
    try { saved = localStorage.getItem("lang"); } catch (_) { /* storage blocked */ }
    const nav = (navigator.language || "").toLowerCase();
    document.querySelectorAll("[data-set-lang]").forEach((b) => b.addEventListener("click", () => setLang(b.dataset.setLang)));

    $("q").addEventListener("input", (e) => { state.query = e.target.value; renderList(); });
    $("no-perms").addEventListener("change", (e) => { state.noPerms = e.target.checked; renderList(); });
    document.addEventListener("keydown", (e) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || "");
      if (e.key === "/" && !typing && !$("detail").open) { e.preventDefault(); $("q").focus(); }
    });

    const menuBtn = $("menu-btn");
    const menu = $("mobile-nav");
    menuBtn.addEventListener("click", () => {
      const open = menu.hidden;
      menu.hidden = !open;
      menuBtn.setAttribute("aria-expanded", String(open));
    });
    menu.addEventListener("click", (e) => { if (e.target.closest("a")) { menu.hidden = true; menuBtn.setAttribute("aria-expanded", "false"); } });

    const dlg = $("detail");
    $("detail-close").addEventListener("click", closeDetail);
    dlg.addEventListener("cancel", (e) => { e.preventDefault(); closeDetail(); });
    dlg.addEventListener("click", (e) => { if (e.target === dlg) closeDetail(); });
    window.addEventListener("hashchange", route);

    setLang(saved === "en" || saved === "pt-BR" ? saved : (nav.startsWith("pt") ? "pt-BR" : "en"));
    load();
  });
})();
