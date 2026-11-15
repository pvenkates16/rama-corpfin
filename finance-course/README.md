# Corporate finance course site

Drop course files into `content/`, commit, and GitHub rebuilds the site in a minute or two.

## One-time setup

1. Create a GitHub repository and push this folder to it (branch `main`).
2. In the repository, open **Settings > Pages** and set **Source** to **GitHub Actions**.
3. Push any change. The **Build and deploy course site** workflow publishes the site.

## Where files go

| Folder | What to put there | How it's used |
|---|---|---|
| `content/config.yml` | Course title, code, instructor, dates | Home page header and key dates |
| `content/course/` | Description, syllabus, schedule (`.md`, `.docx`, `.pdf`) | Syllabus page |
| `content/lectures/` | `01-intro.pptx`, `02-time-value.pptx`, ... | One page per lecture with PDF preview, topic list and download. Order comes from the number prefix. |
| `content/practice/` | One `.md` file per topic (format below) | Questions with show/hide answers, filterable by topic |
| `content/exams/` | `2024-midterm.pdf`, `2024-midterm-solutions.pdf` | Exams paired with their solutions by filename |
| `content/resources/` | Formula sheet (`.md`), readings, anything else | Resources page |
| `content/private/` | Anything you don't want published | Never committed or built |

PPTX, DOCX, ODP and similar files are converted to PDF on GitHub for inline viewing; the original is offered as a download. All text is extracted into the search index.

## Practice question format

```
---
topic: Capital budgeting
---
Q: A project costs $1,000 and pays $600 a year for two years. NPV at 10%?
A: $$NPV = -1000 + \frac{600}{1.1} + \frac{600}{1.1^2} \approx 41.32$$
Extra lines belong to the answer above them.

Q: Next question...
A: Next answer...
```

Questions and answers accept Markdown and LaTeX (`$$...$$` for display, `\( ... \)` for inline). Free-form `.docx` or `.pdf` files in `content/practice/` are shown as documents instead.

## Exam naming

A file ending in `-solutions`, `-solution`, `-answers` or `-key` is paired with the file that has the same name without that ending.

## Titles

Titles come from filenames (`02-time-value.pptx` becomes "Time value"). To override one, add it under `titles:` in `config.yml`.

## Preview locally

```
pip install -r requirements.txt
python scripts/build.py
python -m http.server -d _site
```
Then open http://localhost:8000. LibreOffice must be installed for PDF previews; without it the site still builds and the downloads work.

## Privacy

A free GitHub repository and its Pages site are public. Anything committed to `content/` can be read by anyone. Keep exams, answer keys or copyrighted slides out of the repo, or use a private repository on a plan that supports private Pages.
