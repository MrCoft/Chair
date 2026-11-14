---
name: chair
description: Use when asked to make, film, record, or redo Chair movies or narrated Chair walkthroughs in any project. Applies to "make Chair movies", "film this flow", and "show what you built with Chair"; merely opening an existing movie does not require filming.
---

# Chair movies

A Chair movie is a walkthrough a human can follow: visible cursor movement, target
highlights, click ripples, slow typing, and authored before/action/result captions.
An ordinary Playwright video with compatible `movie.json` is a test recording, not
a substitute for this request.

Read the canonical filming guide with `chair guide`, or read the MCP resource
`chair://guide`. Use the installed **Chair MCP tools** (`chair mcp`), not a custom
screen recorder or a movie-format converter. The viewing command `chair` only
opens movies; it does not record them. If the tools are unavailable, connect the
installed server using the host's MCP support or an MCP client; report a missing
connection rather than silently switching to ordinary test video.

1. Use the project's app/test-data instructions. Reuse existing authorization and
   approved scenario lists; do not ask again just to film work the user requested.
2. Rehearse with the camera off. Verify selectors and starting state. Reset the
   app or use fresh test data for the take.
3. `movie_start` in a new `.chair/<run>/<movie>` folder. Disclose mocks and live
   effects in `scope` and captions. Leave finished movies intact.
4. For each short chapter, call `step` with what comes next and why, then `run`.
   Use `h.click`, `h.type`, `h.hover`, `h.press`, and `h.goto`; use `h.mark` on an
   observed result. Keep Chair's default human pacing. Raw locator actions have no
   effects; for an operation without a helper, mark its target first.
5. Explain the outcome in a result chapter, point at the real UI, and verify it.
   Do not narrate success based only on a click or a desired state.
6. `finish`, then inspect representative exported frames: cursor, highlighted
   target, readable captions, result, and enough time to follow. Fix bad footage
   with cut/repair/retake before finishing. Give the user the movie folder/codes.

For repeatable automated demos, use the **same Chair recording tools and authored
chapters**. Keep fast E2E/failure videos separate. Converting test videos or slowing
them down afterwards does not add the missing cursor, focus or explanation.
