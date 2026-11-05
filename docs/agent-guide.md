# Chair agent guide

Chair films a web app into a movie that a human watches afterwards. You drive the browser; the human reviews. Registered with `claude mcp add chair -s user -- chair mcp`, it gives you 11 tools: `open`, `run`, `snapshot`, `screenshot`, `movie_start`, `step`, `cut`, `resume`, `retake`, `finish`, `close`.

## Setup

Install Chair as described in the [README](../README.md#install), then register the MCP server once:

```sh
claude mcp add chair -s user -- chair mcp
```

## Workflow

1. **Plan.** Decide what the movie shows, split it into parts and steps, and write the plan in chat.
2. **Approval.** Wait for the human to approve the plan in chat. Do not film before that.
3. **Rehearse with the camera off.** Call `open`, then use `run`, `snapshot` and `screenshot` to walk the whole flow fast. Mistakes cost nothing here: no `movie_start` yet, nothing is filmed. Find selectors, create test data, learn where things are slow.
4. **Take.** Call `movie_start({ dir, title, scope, parts })`, then film live, call by call: `step` (new caption) followed by one or more `run` calls that do the thing. Go slow and use the effects. Drive the take live, never write one long pre-scripted playback and replay it; you need to look at the page between calls and react.
5. **Finish.** Call `finish` once every step is filmed. It assembles the movie and opens the viewer. Options: `open` (default true; false skips opening the viewer) and `keepRaw` (keeps the `raw/` frames instead of removing them).
6. **Hand over.** Tell the human the parts and codes, and how to refer to a moment: "say `2f` to refer to a moment". Call `close` when all work is done.

`movie_start` also takes an `id`, but leave it out: it defaults to the folder name, which is the name the viewer and the copied bookmarks use.

`close` refuses while a movie is still recording, so an unfinished take is never lost by accident. Call `finish` first, or `close({ discard: true })` to throw the unfinished movie and its frames away on purpose.

The camera films only while a tool call is running. Your thinking time between calls is not filmed.

## Numbering

- Parts are `1`, `2`, ... `N`, declared in `movie_start` as `parts: [{ code, title }]`.
- Steps are the part number plus a letter: `2a`, `2b`, `2c`.
- An optional intro step is a bare part number (`1`), before the lettered steps.
- Codes must be unique and each step's part must be declared.

## Captions

`step({ code, title, text })`. The text is a Markdown subset (bold, italics, inline code, line breaks, paragraphs); no HTML.

- 1 to 3 short sentences. Say why, not just what.
- Label findings and UX nits as such ("Finding: ...", "UX nit: ...").
- Label test-data workarounds as such ("Test data: ...") so nobody mistakes them for the real flow.
- When an error toast is intentional, say so before it appears.

`step` ends the previous step and starts the next one. It films nothing: the step's footage starts with its first `run`. The viewer stops at the start of each step and waits until the human plays on, so never wait for the human to read.

## Shooting rules

The movie is a real-time recording of the actions, slowed down so a human can follow them.

1. **The action starts straight away.** Call `run` right after `step`. Do not open a step with `h.wait`.
2. **One `run` per step where you can.** Every call boundary is a cut, and whatever the app did while you were thinking (data arriving, toasts closing) shows up as a jump.
3. **Let the helpers set the pace.** `h.click`, `h.type` and `h.hover` already glide the cursor, outline the target and pause after the action. Don't add `h.wait` for pacing.
4. **Wait for the app, not the clock.** Use `h.waitForResponse` or a Playwright wait for the element, rather than a fixed `h.wait`. Keep any `h.wait` to about 1 s.
5. **Point at results briefly.** One `h.mark` on the result is enough (up to about 2 s). A row of long marks plays as a slideshow of stills.

## Pacing and helpers

In a take, use the `h` helpers inside `run`: `h.mark`, `h.click`, `h.type`, `h.press`, `h.hover`, `h.goto`, `h.wait`, `h.waitForResponse`, `h.log`. They show the cursor, an outline on the target, a click ripple and slow typing. Raw `page.click` works but shows no effects; avoid it in a take (fine in rehearsal).

Default pacing: the outline shows 1.2 s before a click, the cursor glides for 1 s, typing is 140 ms per character, and each action is followed by a 1 s pause.

`run` takes a function expression:

```js
async (page, h) => {
    await h.click(page.getByRole('button', { name: 'Save' }))
}
```

Default pacing can be changed in `open` via `pacing` (`markMs`, `cursorMs`, `typeDelayMs`, `afterMs`).

## open options

`open({ url, channel?, userDataDir?, storageState?, viewport?, headless?, helpers?, pacing? })`

- `channel`: `chromium` (default), `msedge` or `chrome`.
- `userDataDir` (persistent profile) or `storageState` (saved login): one of them, not both.
- `viewport`: default 1600x900. `headless`: default true.
- `helpers`: path to a helper pack, a module whose default export is `(page, h) => object`. Its helpers are added to `h`; names of built-ins cannot be reused.
- Close any other browser holding the same profile before `open`, or the launch fails.

## Mistakes: cut, repair, retake

1. `cut` only stops filming. What the step already filmed stays; nothing further is filmed until `resume` or `retake`.
2. Repair the page with `snapshot` and `run` (the camera is off).
3. `retake` discards everything filmed for the step and films nothing by itself. The step is current again, so redo its actions with `run`.
4. `retake({ code })` of an earlier step makes that step current again and clears its footage. A code that was already filmed cannot be started again with `step`, so after retaking an earlier step, continue with a NEW code; later steps keep their footage.

`resume` instead continues the current step when the repair needs no redo.

## One-time movies

A finished movie is never reopened, patched or re-filmed. `movie_start` refuses a finished or non-empty folder. If the human wants an updated version, film a new folder, and only when they ask.

## Clean up

Delete test data you created for the movie (records, users, files) when you are done, and `close` the browser.

## Bookmarks

The human bookmarks moments in the viewer; they are saved in `<movie>/bookmarks.json`. They paste you the viewer's copy text:

```
Bookmarks — <title> (<folder id>)
2f — the toast disappears too fast
```

Each line is `<code> — <note>`; a bookmark without a note is just `<code>`. Use the codes to find the steps they mean.

## Worked example

Plan (approved in chat): part 1 "Sign in", part 2 "Create an item".

```
open        { url: "http://localhost:3000", userDataDir: "C:\\Users\\me\\.chair\\profile" }
snapshot    {}      # rehearsal: look around, try the flow with run, reset state
movie_start { dir: "C:\\movies\\items-1", title: "Items", scope: "Create an item",
              parts: [{ code: "1", title: "Sign in" }, { code: "2", title: "Create an item" }] }
step        { code: "1a", title: "Open the app", text: "We start on the login page, **signed out**." }
run         { code: "async (page, h) => { await h.mark(page.getByRole('heading', { name: 'Sign in' })) }" }
step        { code: "2a", title: "Fill the name", text: "The name is required, so we type it first." }
run         { code: "async (page, h) => { await h.type(page.getByLabel('Name'), 'Chair') }" }
step        { code: "2b", title: "Save", text: "Saving shows a confirmation toast." }
run         { code: "async (page, h) => { await h.click(page.getByRole('button', { name: 'Save' })) }" }
            # the toast is wrong: cut, repair, retake, redo
cut         {}
run         { code: "async (page) => { await page.reload() }" }
retake      {}
run         { code: "async (page, h) => { await h.type(page.getByLabel('Name'), 'Chair'); await h.click(page.getByRole('button', { name: 'Save' })) }" }
finish      {}
close       {}
```

Then tell the human: "Parts 1 and 2 are filmed; say `2b` to refer to the save moment."
