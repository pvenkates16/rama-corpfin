#!/usr/bin/env python3
"""Scan /content and generate _site/ (data.json, search.json, files/, template).

Run locally:  python scripts/build.py   then   python -m http.server -d _site
"""
import json, re, shutil, subprocess, sys, tempfile, datetime
from pathlib import Path
import yaml, markdown

ROOT = Path(__file__).resolve().parent.parent
CONTENT, TEMPLATE, OUT = ROOT / "content", ROOT / "site-template", ROOT / "_site"
FILES = OUT / "files"
CONVERTIBLE = {".pptx", ".ppt", ".docx", ".doc", ".odp", ".odt"}
SOLUTION_RE = re.compile(r"[-_ .](solutions?|answers?|key|sol)$", re.I)
NUM_RE = re.compile(r"^(\d+)[-_. ]+")
SEARCH_CHARS = 8000
# Extra categories: each is a folder under content/ listed like Resources.
# Override or add more with `extra_sections:` in config.yml.
DEFAULT_EXTRA = [{"folder": "readings", "label": "Readings"},
                 {"folder": "quizzes", "label": "Quizzes"},
                 {"folder": "exercise-classes", "label": "Exercise classes"}]
TMP = Path(tempfile.mkdtemp())
warned_soffice = False


def warn(msg): print(f"warning: {msg}", file=sys.stderr)


def slug(s): return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def titleize(stem):
    t = NUM_RE.sub("", stem).replace("_", " ").replace("-", " ").strip()
    return t[:1].upper() + t[1:] if t.islower() else t


def number(stem):
    m = NUM_RE.match(stem)
    return int(m.group(1)) if m else 10**6


def sort_key(p):
    # numeric prefix first, then natural order (so "Lecture 2" sorts before "Lecture 10")
    return (number(p.stem), [int(t) if t.isdigit() else t.lower() for t in re.split(r"(\d+)", p.name)])


def front_matter(text):
    if text.startswith("---"):
        parts = text.split("---", 2)
        if len(parts) == 3:
            try: return yaml.safe_load(parts[1]) or {}, parts[2].lstrip("\n")
            except yaml.YAMLError as e: warn(f"bad front matter: {e}")
    return {}, text


def md_html(text):
    # Put $$...$$ display math on its own lines so it renders as a block, not inline
    text = re.sub(r"\$\$(.+?)\$\$", lambda m: "\n\n$$\n" + m.group(1).strip() + "\n$$\n\n", text or "", flags=re.S)
    return markdown.markdown(
        text,
        extensions=["extra", "sane_lists", "pymdownx.arithmatex"],
        extension_configs={"pymdownx.arithmatex": {"generic": True}},
    )


def list_files(folder):
    d = CONTENT / folder
    if not d.is_dir(): return []
    return sorted((p for p in d.iterdir() if p.is_file() and not p.name.startswith((".", "~$"))), key=sort_key)


def publish(src, section):
    """Copy the original into _site/files and return its web path."""
    dest = FILES / section
    dest.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dest / src.name)
    return f"files/{section}/{src.name}"


def to_pdf(src, section):
    """Return web path of a PDF version (the file itself, or a LibreOffice conversion)."""
    global warned_soffice
    if src.suffix.lower() == ".pdf": return f"files/{section}/{src.name}"
    if src.suffix.lower() not in CONVERTIBLE: return None
    exe = shutil.which("soffice") or shutil.which("libreoffice")
    if not exe:
        if not warned_soffice:
            warn("LibreOffice not found; PDF previews skipped (downloads still work)")
            warned_soffice = True
        return None
    try:
        subprocess.run([exe, "--headless", "--convert-to", "pdf", "--outdir", str(TMP), str(src)],
                       check=True, capture_output=True, timeout=300)
        pdf = TMP / (src.stem + ".pdf")
        dest = FILES / section
        dest.mkdir(parents=True, exist_ok=True)
        shutil.copy2(pdf, dest / pdf.name)
        return f"files/{section}/{pdf.name}"
    except Exception as e:
        warn(f"could not convert {src.name}: {e}")
        return None


def extract(src):
    """Return (list of slide titles, full text)."""
    ext, titles, chunks = src.suffix.lower(), [], []
    try:
        if ext == ".pptx":
            from pptx import Presentation
            for i, slide in enumerate(Presentation(src).slides, 1):
                t = slide.shapes.title
                title = t.text_frame.text.strip() if t is not None and t.has_text_frame else ""
                titles.append(title or f"Slide {i}")
                for sh in slide.shapes:
                    if sh.has_text_frame: chunks.append(sh.text_frame.text)
                    if getattr(sh, "has_table", False) and sh.has_table:
                        for row in sh.table.rows: chunks.append(" ".join(c.text for c in row.cells))
                if slide.has_notes_slide: chunks.append(slide.notes_slide.notes_text_frame.text)
        elif ext == ".docx":
            from docx import Document
            chunks = [p.text for p in Document(src).paragraphs]
        elif ext == ".pdf":
            from pypdf import PdfReader
            chunks = [(pg.extract_text() or "") for pg in PdfReader(src).pages]
        elif ext in (".md", ".txt"):
            chunks = [src.read_text(encoding="utf-8", errors="ignore")]
    except Exception as e:
        warn(f"could not read text from {src.name}: {e}")
    return titles, re.sub(r"\s+", " ", " ".join(chunks)).strip()


def parse_qa(text):
    """Q: ... / A: ... blocks. Continuation lines belong to the last Q or A."""
    items, cur, mode = [], None, None
    for line in text.splitlines():
        q, a = re.match(r"^\s*Q\d*\s*:\s*(.*)$", line), re.match(r"^\s*A\s*:\s*(.*)$", line)
        if q:
            cur = {"q": q.group(1), "a": ""}; items.append(cur); mode = "q"
        elif a and cur:
            cur["a"] = a.group(1); mode = "a"
        elif cur:
            cur[mode] += "\n" + line
    return [{"q": md_html(i["q"].strip()), "a": md_html(i["a"].strip()),
             "text": re.sub(r"\s+", " ", i["q"] + " " + i["a"]).strip()} for i in items if i["q"].strip()]


def content_repo_path():
    """Path of content/ relative to the git repo root (the admin page needs it)."""
    try:
        top = subprocess.run(["git", "-C", str(ROOT), "rev-parse", "--show-toplevel"],
                             capture_output=True, text=True, check=True).stdout.strip()
        return CONTENT.relative_to(Path(top).resolve()).as_posix()
    except Exception:
        return "content"


def main():
    if OUT.exists(): shutil.rmtree(OUT)
    shutil.copytree(TEMPLATE, OUT)
    FILES.mkdir(parents=True, exist_ok=True)

    cfg_path = CONTENT / "config.yml"
    cfg = (yaml.safe_load(cfg_path.read_text(encoding="utf-8")) if cfg_path.exists() else None) or {}
    cfg.setdefault("title", "Corporate finance")
    cfg["intro_html"] = md_html(cfg.get("intro", ""))
    titles = cfg.get("titles") or {}  # optional overrides keyed by filename
    search = []

    def add_search(kind, ident, title, text, link):
        search.append({"type": kind, "id": ident, "title": title, "link": link, "text": text[:SEARCH_CHARS]})

    course = []
    for p in list_files("course"):
        if p.suffix.lower() in (".md", ".markdown"):
            meta, body = front_matter(p.read_text(encoding="utf-8"))
            title = meta.get("title") or titles.get(p.name) or titleize(p.stem)
            course.append({"title": title, "html": md_html(body), "file": None, "pdf": None})
            add_search("Syllabus", slug(p.stem), title, body, "#/course")
        else:
            title = titles.get(p.name) or titleize(p.stem)
            course.append({"title": title, "html": "", "file": publish(p, "course"), "pdf": to_pdf(p, "course")})
            add_search("Syllabus", slug(p.stem), title, extract(p)[1], "#/course")

    lectures = []
    for p in list_files("lectures"):
        if p.suffix.lower() not in CONVERTIBLE | {".pdf"}: continue
        slides, text = extract(p)
        title = titles.get(p.name) or titleize(p.stem)
        n = number(p.stem)
        lec = {"id": slug(p.stem), "number": n if n < 10**6 else None, "title": title,
               "file": publish(p, "lectures"), "pdf": to_pdf(p, "lectures"), "slides": slides}
        lectures.append(lec)
        add_search("Lecture", lec["id"], title, " ".join(slides) + " " + text, f"#/lectures/{lec['id']}")

    practice = []
    for p in list_files("practice"):
        if p.suffix.lower() in (".md", ".txt"):
            meta, body = front_matter(p.read_text(encoding="utf-8"))
            qs = parse_qa(body)
            if not qs:
                warn(f"{p.name}: no 'Q:' blocks found, skipped"); continue
            topic = meta.get("topic") or titles.get(p.name) or titleize(p.stem)
            practice.append({"id": slug(p.stem), "topic": topic, "questions": [{"q": q["q"], "a": q["a"]} for q in qs]})
            add_search("Practice", slug(p.stem), topic, " ".join(q["text"] for q in qs), f"#/practice/{slug(p.stem)}")
        else:  # free-form documents are shown as documents
            topic = titles.get(p.name) or titleize(p.stem)
            practice.append({"id": slug(p.stem), "topic": topic, "questions": [],
                             "file": publish(p, "practice"), "pdf": to_pdf(p, "practice")})
            add_search("Practice", slug(p.stem), topic, extract(p)[1], f"#/practice/{slug(p.stem)}")

    exams, groups = [], {}
    for p in list_files("exams"):
        sol = bool(SOLUTION_RE.search(p.stem))
        key = SOLUTION_RE.sub("", p.stem) if sol else p.stem
        groups.setdefault(key, {})["solution" if sol else "exam"] = p
    for key, g in groups.items():
        e = {"id": slug(key), "title": titles.get((g.get("exam") or g["solution"]).name) or titleize(key)}
        for kind in ("exam", "solution"):
            p = g.get(kind)
            e[kind] = {"file": publish(p, "exams"), "pdf": to_pdf(p, "exams")} if p else None
            if p:
                add_search("Exam", e["id"], e["title"] + (" solutions" if kind == "solution" else ""), extract(p)[1], "#/exams")
        exams.append(e)
    exams.sort(key=lambda e: e["title"], reverse=True)

    def doc_items(folder, kind, link):
        items = []
        for p in list_files(folder):
            if p.suffix.lower() in (".md", ".markdown"):
                meta, body = front_matter(p.read_text(encoding="utf-8"))
                title = meta.get("title") or titles.get(p.name) or titleize(p.stem)
                items.append({"id": slug(p.stem), "title": title, "html": md_html(body)})
                add_search(kind, slug(p.stem), title, body, link)
            else:
                title = titles.get(p.name) or titleize(p.stem)
                items.append({"id": slug(p.stem), "title": title, "html": "",
                              "file": publish(p, folder), "pdf": to_pdf(p, folder)})
                add_search(kind, slug(p.stem), title, extract(p)[1], link)
        return items

    resources = doc_items("resources", "Resource", "#/resources")
    extras = []
    for sec in (cfg.get("extra_sections") or DEFAULT_EXTRA):
        key = slug(sec["folder"])
        extras.append({"key": key, "folder": sec["folder"], "label": sec.get("label") or titleize(sec["folder"]),
                       "items": doc_items(sec["folder"], sec.get("label") or titleize(sec["folder"]), f"#/x/{key}")})

    data = {"config": cfg, "course": course, "lectures": lectures, "practice": practice,
            "exams": exams, "resources": resources, "extras": extras, "repo": {"content_path": content_repo_path()},
            "built": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d %H:%M UTC")}
    (OUT / "data.json").write_text(json.dumps(data, ensure_ascii=False, default=str), encoding="utf-8")
    (OUT / "search.json").write_text(json.dumps(search, ensure_ascii=False), encoding="utf-8")
    (OUT / ".nojekyll").touch()
    shutil.rmtree(TMP, ignore_errors=True)
    print(f"Built: {len(lectures)} lectures, {sum(len(x['questions']) for x in practice)} questions, "
          f"{len(exams)} exams, {len(resources)} resources, "
          + ", ".join(f"{len(e['items'])} {e['label'].lower()}" for e in extras))


if __name__ == "__main__":
    main()
