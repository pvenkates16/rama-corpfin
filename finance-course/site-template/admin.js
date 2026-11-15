const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const MAX = 50 * 1024 * 1024;
let queue = []; // { file, section, name }
let existing = []; // { path, size }
const removals = new Set();

const size = (n) => (n > 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB");
const cleanPath = (p) => p.replace(/^\/+|\/+$/g, "");
const targetPath = (q) => `${cleanPath($("#cpath").value)}/${q.section}/${q.name}`;
function log(msg, err) { const d = document.createElement("div"); if (err) d.className = "err"; d.innerHTML = msg; $("#log").appendChild(d); }

function render() {
  $("#queue").innerHTML = queue.map((q, i) => `<tr><td>${esc(targetPath(q))}</td><td class="sz">${size(q.file.size)}</td><td><button type="button" data-i="${i}" aria-label="Remove ${esc(q.name)}">Remove</button></td></tr>`).join("");
  const n = queue.length + removals.size;
  $("#go").disabled = !n;
  $("#go").textContent = n ? `Publish ${n} change${n === 1 ? "" : "s"}` : "Publish changes";
  $("#existing").innerHTML = existing.map((f, i) => `<tr><td>${esc(f.path)}</td><td class="sz">${size(f.size || 0)}</td><td><label><input type="checkbox" data-p="${i}" ${removals.has(f.path) ? "checked" : ""}> Delete</label></td></tr>`).join("");
}

function add(files) {
  for (const f of files) {
    const name = f.name.replace(/[\\/]/g, "-");
    if (name.startsWith(".")) { log(`Skipped ${esc(name)}: hidden files aren't allowed.`, true); continue; }
    if (f.size > MAX) { log(`Skipped ${esc(name)} (${size(f.size)}): files over 50 MB can't be uploaded here. Add them through GitHub directly.`, true); continue; }
    const section = $("#section").value;
    queue = queue.filter((q) => !(q.section === section && q.name === name));
    queue.push({ file: f, section, name });
    removals.delete(targetPath({ section, name }));
  }
  render();
}

const toBase64 = (file) => new Promise((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(String(r.result).split(",")[1]);
  r.onerror = () => rej(new Error("Couldn't read " + file.name));
  r.readAsDataURL(file);
});

async function gh(path, opts = {}) {
  const base = `https://api.github.com/repos/${encodeURIComponent($("#owner").value.trim())}/${encodeURIComponent($("#repo").value.trim())}`;
  const r = await fetch(base + path, { ...opts, headers: {
    Authorization: `Bearer ${$("#token").value.trim()}`, Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28", "Content-Type": "application/json" } });
  if (!r.ok) {
    let m = ""; try { m = (await r.json()).message; } catch (_) {}
    const hint = r.status === 401 ? " The token is invalid or has expired."
      : r.status === 403 || r.status === 404 ? " Check the repository name, and that the token has Contents read and write access to this repository." : "";
    throw new Error(`GitHub said ${r.status}${m ? ": " + m : ""}.${hint}`);
  }
  return r.json();
}

function ready() {
  if (!$("#token").value.trim()) throw new Error("Paste your GitHub access token first.");
  if (!$("#owner").value.trim() || !$("#repo").value.trim()) throw new Error("Open Repository settings and fill in the owner and repository.");
}

async function loadExisting() {
  $("#log").innerHTML = "";
  try {
    ready();
    log("Loading files…");
    const t = await gh(`/git/trees/${encodeURIComponent($("#branch").value.trim() || "main")}?recursive=1`);
    const prefix = cleanPath($("#cpath").value) + "/";
    existing = t.tree.filter((x) => x.type === "blob" && x.path.startsWith(prefix) && !x.path.endsWith("/.gitkeep"))
      .map((x) => ({ path: x.path, size: x.size }));
    $("#log").innerHTML = "";
    if (t.truncated) log("The repository is very large, so this list may be incomplete.", true);
    log(existing.length ? `${existing.length} files found.` : `No files found under ${esc(prefix)}. Check the content folder in Repository settings.`);
    render();
  } catch (e) { log(esc(e.message), true); }
}

async function publish() {
  const btn = $("#go"); btn.disabled = true; $("#log").innerHTML = "";
  try {
    ready();
    if (removals.size && !confirm(`Delete ${removals.size} file${removals.size === 1 ? "" : "s"} from the site? They can be restored from the repository history, but not from this page.`)) { btn.disabled = false; return; }
    if ($("#remember").checked) sessionStorage.setItem("gh_token", $("#token").value.trim()); else sessionStorage.removeItem("gh_token");
    const branch = $("#branch").value.trim() || "main";
    log("Connecting to GitHub…");
    const parent = (await gh(`/git/ref/heads/${encodeURIComponent(branch)}`)).object.sha;
    const baseTree = (await gh(`/git/commits/${parent}`)).tree.sha;
    const entries = [];
    for (const [i, q] of queue.entries()) {
      log(`Uploading ${esc(q.name)} (${i + 1} of ${queue.length})…`);
      const blob = await gh("/git/blobs", { method: "POST", body: JSON.stringify({ content: await toBase64(q.file), encoding: "base64" }) });
      entries.push({ path: targetPath(q), mode: "100644", type: "blob", sha: blob.sha });
    }
    for (const path of removals) entries.push({ path, mode: "100644", type: "blob", sha: null });
    log("Saving changes…");
    const tree = await gh("/git/trees", { method: "POST", body: JSON.stringify({ base_tree: baseTree, tree: entries }) });
    const commit = await gh("/git/commits", { method: "POST", body: JSON.stringify({ message: $("#msg").value.trim() || "Update course content", tree: tree.sha, parents: [parent] }) });
    await gh(`/git/refs/heads/${encodeURIComponent(branch)}`, { method: "PATCH", body: JSON.stringify({ sha: commit.sha }) });
    const actions = `https://github.com/${encodeURIComponent($("#owner").value.trim())}/${encodeURIComponent($("#repo").value.trim())}/actions`;
    log(`Published ${entries.length} change${entries.length === 1 ? "" : "s"}. The site is rebuilding and should update in a few minutes. <a href="${actions}" target="_blank" rel="noopener">Watch the build</a>.`);
    queue = []; existing = existing.filter((f) => !removals.has(f.path)); removals.clear(); render();
  } catch (e) {
    log(esc(e.message), true);
    render();
  }
}

async function init() {
  const t = localStorage.getItem("theme"); if (t) document.documentElement.dataset.theme = t;
  const m = location.hostname.match(/^(.+)\.github\.io$/);
  if (m) { $("#owner").value = m[1]; $("#repo").value = location.pathname.split("/")[1] || ""; }
  try { const d = await (await fetch("data.json")).json(); if (d.repo && d.repo.content_path) $("#cpath").value = d.repo.content_path; } catch (_) {}
  const saved = sessionStorage.getItem("gh_token"); if (saved) { $("#token").value = saved; $("#remember").checked = true; }
  $("#picker").onchange = (e) => { add(e.target.files); e.target.value = ""; };
  const drop = $("#drop");
  ["dragenter", "dragover"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("over"); }));
  ["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("over"); }));
  drop.addEventListener("drop", (e) => add(e.dataTransfer.files));
  $("#queue").onclick = (e) => { const i = e.target.dataset && e.target.dataset.i; if (i != null) { queue.splice(+i, 1); render(); } };
  $("#cpath").oninput = render;
  $("#go").onclick = publish;
  $("#load").onclick = loadExisting;
  $("#existing").onchange = (e) => {
    const i = e.target.dataset && e.target.dataset.p;
    if (i != null) { const path = existing[+i].path; e.target.checked ? removals.add(path) : removals.delete(path); render(); }
  };
  render();
}
init();
