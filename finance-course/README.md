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
| `content/readings/` | Assigned readings (PDF, Word) | Readings page |
| `content/quizzes/` | Quizzes (PDF, Word) | Quizzes page |
| `content/exercise-classes/` | Exercise class sheets and solutions | Exercise classes page |
| `content/private/` | Anything you don't want published | Never committed or built |

PPTX, DOCX, ODP and similar files are converted to PDF on GitHub for inline viewing; the original is offered as a download. All text is extracted into the search index.

## Uploading from the website

The site has a **Manage content** page (link in the footer, or `/admin.html`). Pick a section, drop files in, and click **Publish**. All files go into a single commit and the site rebuilds in a few minutes.

It needs a GitHub access token, because only GitHub can accept changes to the repo:

1. On GitHub, open your profile picture > **Settings > Developer settings > Personal access tokens > Fine-grained tokens > Generate new token**.
2. Name it, set an expiry (90 days is reasonable), and under **Repository access** choose **Only select repositories** and pick this repo.
3. Under **Repository permissions**, set **Contents** to **Read and write**. Leave everything else alone.
4. Generate the token, copy it, and paste it into the admin page.

Treat the token like a password: anyone who has it can change the repo. The admin page itself is public but does nothing without a valid token. Files must be under 50 MB each. To delete files, use **Load current files** in the Remove files section, tick the ones to delete, and publish.

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
