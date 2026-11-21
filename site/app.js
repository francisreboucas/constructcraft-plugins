// The plugin list of marketplace.constructcraft.net, read from index.json
// (built from plugins/*.toml when the site is deployed).
"use strict";

const STRINGS = {
  en: {
    marketplace: "Marketplace",
    nav_install: "Installing",
    nav_submit: "Submit a plugin",
    title: "Plugins for ConstructCraft",
    lead: "Commands made by the community. They run like the built-in ones: in the app, with <code>ccad run</code>, from scripts and for AI agents over MCP.",
    search: "Search plugins",
    all: "All",
    download: "Download",
    copy_sha: "Copy SHA-256",
    copied: "Copied",
    source: "Source",
    homepage: "Homepage",
    all_versions: "All versions",
    col_version: "Version",
    col_api: "API",
    col_perms: "Permissions",
    col_notes: "Notes",
    authors: "Authors",
    license: "License",
    id: "Id",
    api: "Plugin API",
    min_app: "Needs ConstructCraft",
    none: "none",
    perm_files: "files: reads or writes any file",
    perm_tools: "tools: runs external programs you approve",
    count: (n, total) => n === total ? `${total} plugin${total === 1 ? "" : "s"}` : `${n} of ${total} plugins`,
    empty: "No plugin matches.",
    loading: "Loading…",
    failed: "Could not load the index.",
    install_title: "Installing a plugin",
    install_text: "Until ConstructCraft's plugin manager reads this index, download a plugin's archive, check its SHA-256 checksum, unpack it into a folder and load it:",
    install_cmd1: "ccad --plugins /path/to/plugins plugins",
    install_cmd2: "ccad --plugins /path/to/plugins run <plugin>__<command> key=value",
    sandbox: "Plugins run sandboxed: they reach the project only through ConstructCraft's commands, cannot touch files or the network, and have instruction and memory limits, unless they ask for a permission. Review a plugin before you install it anyway: the index checks entries, not what plugins do.",
    footer: "Index under the MIT License; each plugin keeps its own license.",
  },
  pt: {
    marketplace: "Marketplace",
    nav_install: "Instalação",
    nav_submit: "Enviar um plugin",
    title: "Plugins do ConstructCraft",
    lead: "Comandos feitos pela comunidade. Funcionam como os nativos: no aplicativo, com <code>ccad run</code>, em scripts e para agentes de IA via MCP.",
    search: "Buscar plugins",
    all: "Todos",
    download: "Baixar",
    copy_sha: "Copiar SHA-256",
    copied: "Copiado",
    source: "Código-fonte",
    homepage: "Página",
    all_versions: "Todas as versões",
    col_version: "Versão",
    col_api: "API",
    col_perms: "Permissões",
    col_notes: "Notas",
    authors: "Autores",
    license: "Licença",
    id: "Id",
    api: "API de plugins",
    min_app: "Requer ConstructCraft",
    none: "nenhuma",
    perm_files: "files: lê ou grava qualquer arquivo",
    perm_tools: "tools: roda programas externos que você aprovar",
    count: (n, total) => n === total ? `${total} plugin${total === 1 ? "" : "s"}` : `${n} de ${total} plugins`,
    empty: "Nenhum plugin encontrado.",
    loading: "Carregando…",
    failed: "Não foi possível carregar o índice.",
    install_title: "Instalando um plugin",
    install_text: "Enquanto o gerenciador de plugins do ConstructCraft não lê este índice, baixe o arquivo do plugin, confira o checksum SHA-256, descompacte numa pasta e carregue-o:",
    install_cmd1: "ccad --plugins /caminho/para/plugins plugins",
    install_cmd2: "ccad --plugins /caminho/para/plugins run <plugin>__<comando> chave=valor",
    sandbox: "Os plugins rodam em sandbox: só chegam ao projeto pelos comandos do ConstructCraft, não acessam arquivos nem a rede e têm limites de instruções e de memória, a não ser que peçam uma permissão. Mesmo assim, examine um plugin antes de instalá-lo: o índice verifica as entradas, não o que os plugins fazem.",
    footer: "Índice sob a Licença MIT; cada plugin mantém a sua própria licença.",
  },
};

// Strings that hold markup of our own (never plugin data).
const HTML_KEYS = new Set(["lead"]);

const state = { lang: pickLang(), plugins: [], tag: null, query: "", error: false };

function pickLang() {
  try {
    const saved = localStorage.getItem("lang");
    if (saved in STRINGS) return saved;
  } catch (_) { /* storage blocked */ }
  return (navigator.language || "").toLowerCase().startsWith("pt") ? "pt" : "en";
}

function t(key) {
  return STRINGS[state.lang][key];
}

function safeUrl(u) {
  return typeof u === "string" && u.startsWith("https://") ? u : null;
}

function applyStrings(root = document) {
  root.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.dataset.i18n;
    if (HTML_KEYS.has(key)) el.innerHTML = t(key);
    else el.textContent = t(key);
  });
  root.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
}

function setLang(lang) {
  state.lang = lang;
  try { localStorage.setItem("lang", lang); } catch (_) { /* storage blocked */ }
  document.documentElement.lang = lang === "pt" ? "pt-BR" : "en";
  document.getElementById("lang").textContent = lang === "pt" ? "EN" : "PT";
  applyStrings();
  render();
}

function el(tag, text, cls) {
  const e = document.createElement(tag);
  if (text != null) e.textContent = text;
  if (cls) e.className = cls;
  return e;
}

function permLabel(p) {
  return STRINGS[state.lang][`perm_${p}`] || p;
}

function matches(p) {
  if (state.tag && !(p.tags || []).includes(state.tag)) return false;
  const q = state.query.trim().toLowerCase();
  if (!q) return true;
  const hay = [p.id, p.name, p.description, ...(p.authors || []), ...(p.tags || [])].join(" ").toLowerCase();
  return q.split(/\s+/).every((w) => hay.includes(w));
}

function renderTags() {
  const box = document.getElementById("tags");
  box.replaceChildren();
  const counts = new Map();
  for (const p of state.plugins) for (const tg of p.tags || []) counts.set(tg, (counts.get(tg) || 0) + 1);
  if (counts.size === 0) return;
  const tags = [null, ...[...counts.keys()].sort()];
  for (const tg of tags) {
    const b = el("button", tg === null ? t("all") : tg, "tag");
    b.type = "button";
    b.setAttribute("aria-pressed", String(state.tag === tg));
    b.addEventListener("click", () => { state.tag = state.tag === tg ? null : tg; render(); });
    box.append(b);
  }
}

function card(p) {
  const node = document.getElementById("card").content.firstElementChild.cloneNode(true);
  applyStrings(node);
  const latest = (p.versions || [])[0] || {};
  node.id = p.id;

  const a = node.querySelector(".anchor");
  a.textContent = p.name;
  a.href = `#${p.id}`;
  node.querySelector(".ver").textContent = latest.version ? `v${latest.version}` : "";
  node.querySelector(".desc").textContent = p.description;

  const chips = node.querySelector(".chips");
  for (const perm of latest.permissions || []) chips.append(el("li", permLabel(perm), "perm"));
  for (const tg of p.tags || []) chips.append(el("li", tg));
  if (!chips.children.length) chips.remove();

  const meta = node.querySelector(".meta");
  const rows = [
    [t("id"), p.id],
    [t("authors"), (p.authors || []).join(", ")],
    [t("license"), p.license],
    [t("api"), latest.api != null ? String(latest.api) : null],
    [t("min_app"), latest.min_app ? `≥ ${latest.min_app}` : null],
  ];
  for (const [k, v] of rows) {
    if (!v) continue;
    meta.append(el("dt", k));
    const dd = el("dd");
    if (k === t("id")) dd.append(el("code", v)); else dd.textContent = v;
    meta.append(dd);
  }

  const dl = node.querySelector(".download");
  const url = safeUrl(latest.url);
  if (url) { dl.href = url; dl.textContent = `${t("download")} v${latest.version}`; } else dl.remove();

  const copy = node.querySelector(".copy");
  if (latest.sha256) {
    copy.title = latest.sha256;
    copy.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(latest.sha256);
        copy.textContent = t("copied");
        setTimeout(() => { copy.textContent = t("copy_sha"); }, 1500);
      } catch (_) {
        window.prompt("SHA-256", latest.sha256);
      }
    });
  } else copy.remove();

  for (const [sel, key] of [[".repo", "repository"], [".home", "homepage"]]) {
    const link = node.querySelector(sel);
    const u = safeUrl(p[key]);
    if (u && !(key === "homepage" && u === p.repository)) link.href = u; else link.remove();
  }

  const tbody = node.querySelector("tbody");
  for (const v of p.versions || []) {
    const tr = el("tr");
    const vtd = el("td");
    const vu = safeUrl(v.url);
    if (vu) { const va = el("a", v.version); va.href = vu; vtd.append(va); } else vtd.textContent = v.version;
    tr.append(
      vtd,
      el("td", String(v.api)),
      el("td", (v.permissions || []).length ? v.permissions.join(", ") : t("none")),
      el("td", v.notes || ""),
      el("td", v.sha256 || "", "sha"),
    );
    tbody.append(tr);
  }
  return node;
}

function render() {
  renderTags();
  const list = document.getElementById("list");
  const status = document.getElementById("status");
  if (state.error) { status.textContent = t("failed"); list.replaceChildren(); return; }
  if (!state.plugins.length) { status.textContent = t("loading"); return; }
  const shown = state.plugins.filter(matches);
  status.textContent = shown.length ? t("count")(shown.length, state.plugins.length) : t("empty");
  list.replaceChildren(...shown.map(card));
}

async function load() {
  render();
  try {
    const res = await fetch("index.json", { cache: "no-cache" });
    if (!res.ok) throw new Error(res.status);
    const data = await res.json();
    state.plugins = (data.plugins || []).slice().sort((a, b) => a.name.localeCompare(b.name));
  } catch (err) {
    console.error(err);
    state.error = true;
  }
  render();
  if (location.hash) document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView();
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("lang").addEventListener("click", () => setLang(state.lang === "pt" ? "en" : "pt"));
  document.getElementById("q").addEventListener("input", (e) => { state.query = e.target.value; render(); });
  setLang(state.lang);
  load();
});
