## tl;dr
This PR adds Find in Page support to VS Code's integrated browser by connecting a find widget to Electron webContents search APIs.

## Stakeholders
- kycutler: PR author; implemented the feature, responded to reviewer concerns, and explained tradeoffs around page refresh behavior and Chromium search lag.
- jruales: Reviewer; focused on UI polish, dismissal behavior, popped-out window shortcut behavior, padding, and perceived search-highlight lag.
- Copilot: AI reviewer; summarized the changed files and identified the overall implementation shape.
- vs-code-engineering: Bot; handled milestone/assignment automation.

## Changes
- `src/vs/workbench/contrib/browserView/electron-browser/browserFindWidget.ts`: Adds a browser-specific find widget built around the existing `SimpleFindWidget`, so the integrated browser gets familiar find controls instead of inventing a separate UI.
- `src/vs/workbench/contrib/browserView/electron-browser/browserEditor.ts`: Integrates the find widget into the browser editor lifecycle, including lazy creation and layout positioning.
- `src/vs/workbench/contrib/browserView/electron-browser/browser.css`: Adds styling so the find widget fits visually inside the browser editor.
- `src/vs/workbench/contrib/browserView/browserViewActions.ts`: Adds actions for showing, hiding, and navigating find results, with expected keyboard behavior such as Ctrl/Cmd+F and find-next/find-previous shortcuts.
- `src/vs/workbench/contrib/browserView/common/browserView.ts`: Expands the browser view model/service contract so renderer-side code can request find operations without directly touching Electron internals.
- `src/vs/workbench/contrib/browserView/electron-main/browserViewMainService.ts`: Routes find calls to the correct browser view instance in the Electron main process.
- `src/vs/platform/browserView/electron-main/browserView.ts`: Uses Electron `webContents.findInPage` and related stop/find result behavior to perform the actual web page search.
- Related type/interface files: Add find option/result structures so the API has typed data instead of loose parameters.

## Risks
- Medium: Popped-out browser windows may not receive shortcuts consistently when focus is inside web content. The author points to a separate PR for this, so this PR may depend on outside behavior.
- Low: Search highlight lag can appear when Chromium delays updating results. The author argues this is Chromium behavior, but users may still blame VS Code.
- Medium: Keeping the find dialog open during page navigation helps live-preview workflows, but it may surprise users who expect the search UI to close on navigation.
- Low: UI polish details such as padding, resize bar width, and rounded drag-edge behavior can make the feature feel slightly inconsistent with native VS Code find controls.
- Medium: The feature assumes Electron `webContents.findInPage` behavior is stable enough for the integrated browser; edge cases may appear with unusual pages, focus states, or embedded content.

## Learning
1. Why is it cleaner to route find requests through the browser view service/model instead of calling Electron APIs directly from the editor UI code?
2. What tradeoff is the author making by keeping the find widget open after page navigation, especially for live-preview or hot-reload pages?
3. How would you test whether a search delay is caused by VS Code code versus Chromium's built-in `findInPage` behavior?
