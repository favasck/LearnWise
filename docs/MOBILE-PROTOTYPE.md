# Mobile UX prototype

This prototype explores three complete journeys before changing production navigation. It is separate from authentication and the live data service. All names, lessons, tasks and confirmations are fictional. The prototype stores its demonstration drafts in session storage and makes no live writes, sends, meetings or analytics calls.

## Open the prototype

Run `npm run build`, then open `dist/learnwise-mobile-prototype.html` in a browser. This file includes its JavaScript and CSS and can be copied to another device. No build server, account, network connection or external font is required to open it. The normal hosted-build entry is `/mobile-prototype.html`.

The role switch at the top changes the preview. On a wide screen, the interface appears beside a review guide. On a phone, the guide and failure simulation control follow the interface. The prototype is not deployed to LearnWise production by creating these files.

## Journeys

| Journey | Click path | Behavior to assess |
|---|---|---|
| Student joins a lesson | Student → View lesson & join → Join lesson → Return | Preparation is readable, confirmed/pending states differ, handoff is explicit, Back returns correctly |
| Parent follows a child’s learning | Parent → choose Adam → Learning → task or feedback | Child remains selected across screens and refresh; sibling information does not mix |
| Tutor closes a lesson | Tutor → Record attendance & feedback → Review → Save & share | Required fields explain errors; audience is visible; learner-specific drafts survive refresh; confirmation describes the outcome |
| Tutor recovers from failure | Enable Simulate save failure in the review guide, then save | Inputs remain available; retry works after disabling the simulation |

Saved demo tutor feedback appears when viewing that learner’s parent/student feedback. Drafts and saved-demo states are separated per learner. Reset prototype clears all demonstration drafts and returns to student home.

## Design decisions being tested

- Compact headings keep next actions near the top of a phone screen.
- Student navigation: Home, Lessons, Homework, Progress, More.
- Parent navigation: Home, Lessons, Learning, More. This tests whether “Learning” clearly groups homework and feedback.
- Tutor navigation: Today, Lessons, Students, More.
- Lesson details use a full screen with a refreshable URL state and browser Back support.
- Clearly labeled bottom navigation uses touch-sized targets and safe-area padding.
- Forms use full-width fields, visible labels, 16px text inputs and inline guidance. The tutor submit button remains in document flow so it does not cover the keyboard.
- No external icon or font service is necessary; icons are bundled and typography uses system/Georgia fonts.

This is a prototype, not evidence that bottom navigation or these labels are correct for all users. Admin, billing detail, resource browsing, homework file submission and real rescheduling are outside these three journeys. Destinations outside the scope explain that limitation instead of pretending to save or transact.

## Review protocol

Test at 360px, 390px and 430px wide, enlarged text, landscape and with the software keyboard open. Include an iPhone/Safari and Android/Chrome. Ask representative students, parents and tutors to complete the relevant task without coaching. Record completion, time, wrong turns, requests for help and whether they correctly understand request/confirmation and save/share outcomes. Do not infer a usability improvement percentage from this prototype alone.

For the parent task, first ask where they expect homework and feedback to live. If “Learning” is unclear, compare an alternative with direct Homework/Progress destinations before committing the live navigation.

## Verification

- `node --test tests/mobile-prototype.test.js`: role routes, lesson handoff, browser Back, refresh, sibling context, form validation, audience review, failed-save recovery, saved feedback visibility and draft/reset isolation.
- `npm run build`: builds the production app, then builds the prototype independently and exports the standalone HTML. Independent builds preserve the app’s existing chunk structure and remote render-check behavior.
- `node scripts/check-mobile-prototype.mjs`: executes the exported standalone module in an isolated DOM, renders all three roles and verifies zero network requests.
- `npm run test:render`: existing production public-page/sign-in render verification.
- `npm test`: repository-wide regression suite.

Browser discovery still reported “The browser access host is unavailable” in this session. DOM checks do not establish pixel layout, real keyboard behavior, touch reachability or device accessibility. Those visual and participant checks remain necessary before implementing this navigation in the live product.

### Result of this implementation session

Full repository suite: 190 passed, 0 failed. After the final mobile viewport-reset adjustment, all 6 prototype tests passed again. Production build, standalone export, standalone three-role render with zero network requests, and existing seven-public-page/sign-in render checks passed. `git diff --check` passed. Native visual/device and participant testing remain outstanding; no production deployment was performed.
