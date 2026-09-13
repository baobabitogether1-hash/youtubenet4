# User Prompts & Task Tracking (PROMPTS.md)

## Current User Prompt (2026-09-12)

```text
0. update AGENTS.md - add first section: 0. always update PROMPTS.md with user's latest todo based on the user's prompt and for each completed task - update the task's review.
1. by default always show the most important buttons and keep the translated subs on top (if its not possible so show it above or under the video (allow change).
2. by default rm the subtitle option to download the subs using gemini.
3. mv any hardcoded text from the app to config/tests-fixtures/etc
4. the app is dedicated to be used on android device. anyway - keep a web version which might help driving app tests and as demo of the app. update AGENETS.md to scope web-app usage to only that (app is android machine focus)
5. ensure correct README links to the relevant gh-pages and ensure tests are passing but more important - the android emulator device test - for detecting the default subtitles.
6. by default - user defined target translation languages - so use those languages to first try to subtitle fetch using tlang param change - try once after the default subtitles are fetched correctly and present only 1 notification regarding fetch pass/failed. - allow to turn that off on the settings.
```

---

## Task Breakdown & Progress

- [ ] **Task 0**: Update `AGENTS.md` with rule 0 ("0. always update PROMPTS.md with user's latest todo based on the user's prompt and for each completed task - update the task's review.") and maintain `PROMPTS.md`.
  - **Status**: In Progress
  - **Review**: Pending

- [ ] **Task 1**: By default always show the most important buttons (Play/Pause, Caption CC, Target Lang, Settings, Back) and keep translated subtitles on top of original subtitles. Support configurable subtitle positioning ('top' [default], 'above', 'under', 'bottom') with UI switch.
  - **Status**: Pending
  - **Review**: Pending

- [ ] **Task 2**: By default remove any subtitle option to download/transcribe subtitles using Gemini across UI, settings, and backend.
  - **Status**: Pending
  - **Review**: Pending

- [ ] **Task 3**: Move hardcoded text, sample data, and mock fixtures to centralized `src/config/` and test fixtures.
  - **Status**: Pending
  - **Review**: Pending

- [ ] **Task 4**: Scope web-app usage in `AGENTS.md` strictly as a companion to drive app tests and serve as an interactive demo, keeping primary focus on Android native device execution.
  - **Status**: Pending
  - **Review**: Pending

- [ ] **Task 5**: Verify and update `README.md` links to relevant GitHub Pages and ensure Android emulator device test for detecting default subtitles is fully verified and passing.
  - **Status**: Pending
  - **Review**: Pending

- [ ] **Task 6**: Enable automatic single-attempt fetch of user-defined target translation languages using `tlang` parameter change after default subtitles load, displaying exactly 1 consolidated pass/fail notification, with settings toggle.
  - **Status**: Pending
  - **Review**: Pending
