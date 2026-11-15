const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const enc = (p) => encodeURI(p);
const SECTIONS = [["course", "Syllabus"], ["lectures", "Lectures"], ["practice", "Practice"], ["exams", "Past exams"], ["resources", "Resources"]];
let D, S;

const links = (o) => `<div class="actions">${o.pdf ? `<a class="btn primary" href="${enc(o.pdf)}" target="_blank" rel="noopener">Open PDF</a>` : ""}${o.file ? `<a class="btn" href="${enc(o.file)}" download>Download original</a>` : ""}</div>`;
const viewer = (o, title) => (o.pdf ? `<iframe class="viewer" loading="lazy" src="${enc(o.pdf)}" title="${esc(title)}"></iframe>` : "");
const empty = (what) => `<p class="empty">No ${what} yet. Add files to the matching folder in <code>content/</code> and push.</p>`;

function home() {
  const c = D.config;
  const terms = [["Institution", c.institution], ["Term", c.term], ["Meets", c.meets], ["Instructor", c.instructor],
    ["Contact", c.email && `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>`, true], ["Office hours", c.office_hours]]
    .filter((t) => t[1]).map(([k, v, raw]) => `<div><dt>${k}</dt><dd>${raw ? v : esc(v)}</dd></div>`).join("");
  const dates = (c.dates || []).map((d) => `<tr><td>${esc(d.date)}</td><td>${esc(d.event)}</td></tr>`).join("");
  const idx = SECTIONS.filter(([k]) => D[k].length).map(([k, label]) => {
    const n = k === "practice" ? D.practice.reduce((a, t) => a + t.questions.length, 0) || D.practice.length : D[k].length;
    return `<li><a href="#/${k}"><span>${label}</span><span class="count">${n}</span></a></li>`;
  }).join("");
  return `<section class="hero">${c.code ? `<p class="code">${esc(c.code)}</p>` : ""}<h1>${esc(c.title)}</h1></section>
    ${terms ? `<dl class="terms">${terms}</dl>` : ""}${c.intro_html || ""}
    ${dates ? `<h2>Key dates</h2><table class="dates">${dates}</table>` : ""}
    <h2>In this course</h2><ul class="index">${idx || "<li class='empty'>Nothing here yet.</li>"}</ul>`;
}

function course() {
  if (!D.course.length) return `<h1>Syllabus</h1>${empty("syllabus content")}`;
  return `<h1>Syllabus</h1>` + D.course.map((d) => `<article class="doc"><h2>${esc(d.title)}</h2>${d.html}${d.file ? links(d) + viewer(d, d.title) : ""}</article>`).join("");
}

function lectures(id) {
  if (id) {
    const i = D.lectures.findIndex((l) => l.id === id), l = D.lectures[i];
    if (!l) return notFound();
    const prev = D.lectures[i - 1], next = D.lectures[i + 1];
    return `<p class="crumb"><a href="#/lectures">Lectures</a></p>
      <h1>${l.number != null ? `${l.number}. ` : ""}${esc(l.title)}</h1>
      ${l.slides.length ? `<p class="sub">${l.slides.length} slides</p>` : ""}${links(l)}
      ${l.slides.length ? `<h2>Topics covered</h2><ol class="slides">${l.slides.map((s) => `<li>${esc(s)}</li>`).join("")}</ol>` : ""}
      ${l.pdf ? `<h2>Slides</h2>${viewer(l, l.title)}` : `<p class="empty">A PDF preview isn't available for this file. Use the download link above.</p>`}
      <nav class="pager"><span>${prev ? `<a href="#/lectures/${prev.id}">Previous: ${esc(prev.title)}</a>` : ""}</span><span>${next ? `<a href="#/lectures/${next.id}">Next: ${esc(next.title)}</a>` : ""}</span></nav>`;
  }
  return `<h1>Lectures</h1>` + (D.lectures.length ? `<ul class="rows">${D.lectures.map((l) =>
    `<li><span class="n">${l.number ?? ""}</span><a class="t" href="#/lectures/${l.id}">${esc(l.title)}</a><span class="meta">${l.slides.length ? l.slides.length + " slides" : ""}</span></li>`).join("")}</ul>` : empty("lectures"));
}

function practice(id) {
  const topics = D.practice;
  if (!topics.length) return `<h1>Practice questions</h1>${empty("practice questions")}`;
  const shown = id ? topics.filter((t) => t.id === id) : topics;
  const total = shown.reduce((a, t) => a + t.questions.length, 0);
  const chips = `<div class="chips"><a class="chip" href="#/practice" ${!id ? 'aria-current="true"' : ""}>All topics</a>${topics.map((t) =>
    `<a class="chip" href="#/practice/${t.id}" ${t.id === id ? 'aria-current="true"' : ""}>${esc(t.topic)}</a>`).join("")}</div>`;
  const body = shown.map((t) => `<div class="topic-head"><h2>${esc(t.topic)}</h2><span class="meta">${t.questions.length ? t.questions.length + " questions" : ""}</span></div>` +
    (t.questions.length ? t.questions.map((q, i) => `<div class="q"><div class="num">Question ${i + 1}</div>${q.q}<details><summary>Show answer</summary><div class="ans">${q.a || "<p>No answer provided.</p>"}</div></details></div>`).join("")
      : `${links(t)}${viewer(t, t.topic)}`)).join("");
  return `<h1>Practice questions</h1>${chips}${total ? `<button class="toggle" id="alldet" type="button">Show all answers</button>` : ""}${body}`;
}

function exams() {
  return `<h1>Past exams</h1>` + (D.exams.length ? D.exams.map((e) => {
    const part = (o, label) => o ? `<details><summary>Preview ${label}</summary>${viewer(o, e.title + " " + label)}</details>` : "";
    const btn = (o, label, primary) => o ? `<a class="btn ${primary ? "primary" : ""}" href="${enc(o.pdf || o.file)}" target="_blank" rel="noopener">${label}</a>` : "";
    return `<div class="exam"><h3>${esc(e.title)}</h3><div class="actions">${btn(e.exam, "Exam", true)}${btn(e.solution, "Solutions")}</div>${part(e.exam, "exam")}${part(e.solution, "solutions")}</div>`;
  }).join("") : empty("exams"));
}

function resources() {
  return `<h1>Resources</h1>` + (D.resources.length ? D.resources.map((r) => `<article class="doc"><h2>${esc(r.title)}</h2>${r.html}${r.file ? links(r) : ""}</article>`).join("") : empty("resources"));
}

function search(q) {
  q = decodeURIComponent(q || "").trim();
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  const hl = (s) => terms.reduce((h, t) => h.replace(new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), (m) => `<mark>${m}</mark>`), esc(s));
  const scored = terms.length ? S.map((d) => {
    const title = d.title.toLowerCase(), text = d.text.toLowerCase();
    if (!terms.every((t) => title.includes(t) || text.includes(t))) return null;
    const score = terms.reduce((a, t) => a + (title.includes(t) ? 10 : 0) + Math.min(text.split(t).length - 1, 5), 0);
    const at = Math.max(0, text.indexOf(terms[0]) - 60);
    return { d, score, snip: (at ? "…" : "") + d.text.slice(at, at + 180) + "…" };
  }).filter(Boolean).sort((a, b) => b.score - a.score).slice(0, 30) : [];
  return `<h1>Search</h1><p class="sub">${terms.length ? `${scored.length} result${scored.length === 1 ? "" : "s"} for “${esc(q)}”` : "Type something in the search box."}</p>` +
    scored.map(({ d, snip }) => `<div class="hit"><span class="kind">${d.type}</span><a href="${d.link}">${hl(d.title)}</a><p>${hl(snip)}</p></div>`).join("");
}

const notFound = () => `<h1>Page not found</h1><p><a href="#/">Back to the course home</a></p>`;

function route() {
  const [, sec = "", arg] = location.hash.replace(/^#/, "").split("/");
  const views = { "": home, course, lectures, practice, exams, resources, search };
  $("#main").innerHTML = (views[sec] || notFound)(arg);
  document.querySelectorAll("#nav a").forEach((a) => (a.dataset.k === sec ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current")));
  document.title = (sec && SECTIONS.find((s) => s[0] === sec) ? SECTIONS.find((s) => s[0] === sec)[1] + " · " : "") + D.config.title;
  const all = $("#alldet");
  if (all) all.onclick = () => {
    const ds = [...document.querySelectorAll(".q details")], open = ds.some((d) => !d.open);
    ds.forEach((d) => (d.open = open)); all.textContent = open ? "Hide all answers" : "Show all answers";
  };
  if (window.renderMathInElement) renderMathInElement($("#main"), { delimiters: [
    { left: "\\[", right: "\\]", display: true }, { left: "\\(", right: "\\)", display: false }, { left: "$$", right: "$$", display: true }], throwOnError: false });
  if (sec !== "practice" || !arg) window.scrollTo(0, 0);
}

async function init() {
  try {
    [D, S] = await Promise.all([fetch("data.json").then((r) => r.json()), fetch("search.json").then((r) => r.json())]);
  } catch (e) {
    $("#main").innerHTML = `<p class="empty">The course data couldn't be loaded. If you're opening this file directly, serve the folder with a local web server instead.</p>`;
    return;
  }
  $("#brand").textContent = D.config.code || D.config.title;
  $("#nav").innerHTML = SECTIONS.filter(([k]) => D[k].length).map(([k, l]) => `<a data-k="${k}" href="#/${k}">${l}</a>`).join("");
  $("#foot").innerHTML = `${esc(D.config.title)}${D.config.institution ? " · " + esc(D.config.institution) : ""} · Updated ${esc(D.built)} · <a href="admin.html">Manage content</a>`;
  $("#searchform").onsubmit = (e) => { e.preventDefault(); const v = $("#q").value.trim(); if (v) location.hash = "#/search/" + encodeURIComponent(v); };
  const t = localStorage.getItem("theme");
  if (t) document.documentElement.dataset.theme = t;
  $("#theme").onclick = () => {
    const dark = getComputedStyle(document.documentElement).colorScheme === "dark";
    const next = dark ? "light" : "dark";
    document.documentElement.dataset.theme = next; try { localStorage.setItem("theme", next); } catch (_) {}
  };
  window.addEventListener("hashchange", route);
  route();
}
document.addEventListener("DOMContentLoaded", init);
