# Ghostty Tab Overflow Reveal Design Note

## Purpose

This note corrects the earlier interpretation of Ghostty tab overflow behavior.
The important visual detail is not generic horizontal scrolling. It is the native
macOS tab bar's clipped overflow reveal: when there are many tabs, Ghostty keeps
small visible slices of offscreen tabs at the left and right edges of the tab
strip. Those slices communicate that more tabs exist without adding explicit
scroll buttons, edge fades, or a web-style scrollbar.

The screenshot that triggered this note shows the behavior clearly:

- The selected tab is fully visible.
- Tabs to the left and right are partially cropped, not hidden cleanly at exact
  tab boundaries.
- The row reads as one continuous native tab strip.
- The new-tab button remains pinned at the far right.
- Overflow is implied through clipped tab geometry, not through extra chrome.

The Retab XLSX sheet tabs should reproduce this behavior deliberately.

## Key Correction

Ghostty does not implement a custom tab overflow algorithm in application code.
On macOS, Ghostty uses AppKit's native tab system. AppKit creates the real
`NSTabBar`, lays out the tabs, handles selection, clipping, overflow reveal,
keyboard integration, the new-tab button, and much of the native visual polish.

Ghostty's code then repositions that native tab bar into its custom titlebar
layout. The "reveal overflow" effect comes from the native `NSTabBar` being
hosted inside AppKit's titlebar accessory clip view, not from Ghostty manually
painting partial tabs or manually calculating scroll offsets.

For Retab, this means the right target is not "make a horizontal scroll row".
The target is "make a tab strip that behaves like a clipped native tab bar".

## Source Evidence

The Ghostty source inspected for this note is cloned at `/tmp/ghostty`, commit
`5659cef41f4f2f7a478d0800a11836fa17e64d66`.

### Native Tabbing Is Enabled At The Window Level

File:
`/tmp/ghostty/macos/Sources/Features/Terminal/Window Styles/TerminalWindow.swift`

Relevant behavior:

- During window setup, Ghostty enables native macOS window tabbing.
- It first sets `tabbingMode = .preferred`.
- On the next main-queue tick it changes to `tabbingMode = .automatic`.
- The comment says this is required so restored windows recreate as tabs
  instead of separate windows.

Implication:

Ghostty's tab model is not a custom tab component. Each tab is an `NSWindow`
inside an AppKit `NSWindowTabGroup`.

### Ghostty Detects AppKit's NSTabBar

File:
`/tmp/ghostty/macos/Sources/Features/Terminal/Window Styles/TerminalWindow.swift`

Relevant behavior:

- Ghostty overrides `addTitlebarAccessoryViewController`.
- AppKit adds the tab bar as an `NSTitlebarAccessoryViewController`.
- Ghostty checks whether that controller contains a private AppKit view whose
  class name is `NSTabBar`.
- It tags that accessory controller with `_ghosttyTabBar`.

Important detail:

Ghostty is detecting an AppKit-provided object. It is not constructing the tab
buttons itself.

### Ventura Path: Reposition The Native Tab Bar

File:
`/tmp/ghostty/macos/Sources/Features/Terminal/Window Styles/TitlebarTabsVenturaTerminalWindow.swift`

Relevant behavior:

- `titlebarTabs = true` generates a custom toolbar.
- When AppKit adds the tab bar accessory, Ghostty sets the accessory layout
  attribute to `.right`.
- `pushTabsToTitlebar` finds:
  - the AppKit tab-bar accessory view,
  - its superview, which functions as the clip view,
  - the titlebar view,
  - the toolbar view.
- Ghostty constrains the accessory clip view between the left window-button
  backdrop and the right edge of the toolbar.
- It then constrains the actual accessory view to the clip view.

The key layout relationship is:

```swift
accessoryClipView.leftAnchor.constraint(equalTo: windowButtonsBackdrop.rightAnchor).isActive = true
accessoryClipView.rightAnchor.constraint(equalTo: toolbarView.rightAnchor).isActive = true
accessoryClipView.topAnchor.constraint(equalTo: toolbarView.topAnchor).isActive = true
accessoryClipView.heightAnchor.constraint(equalTo: toolbarView.heightAnchor).isActive = true

accessoryView.leftAnchor.constraint(equalTo: accessoryClipView.leftAnchor).isActive = true
accessoryView.rightAnchor.constraint(equalTo: accessoryClipView.rightAnchor).isActive = true
accessoryView.topAnchor.constraint(equalTo: accessoryClipView.topAnchor).isActive = true
accessoryView.heightAnchor.constraint(equalTo: accessoryClipView.heightAnchor).isActive = true
```

Implication:

The native tab bar remains a native tab bar. Ghostty only changes where it lives
and what rectangle clips it.

### Tahoe Path: Same Concept, More Explicit Documentation

File:
`/tmp/ghostty/macos/Sources/Features/Terminal/Window Styles/TitlebarTabsTahoeTerminalWindow.swift`

The code comment is direct: Ghostty takes the `NSTabBar` that AppKit placed on
the window and converts it into titlebar tabs.

The Tahoe implementation:

- Finds `tabBarView`, the private `NSTabBar`.
- Finds its `NSTitlebarAccessoryClipView`.
- Finds the first accessory subview.
- Finds `NSToolbarView`.
- Finds `NSTabBarNewTabButton`.
- Sizes the tab bar height from the new-tab button geometry.
- Constrains the clip view to the toolbar view.
- Applies a left padding of `70` when traffic-light window buttons are visible.
- Re-runs setup when the `NSTabBar` frame changes, because AppKit can recreate
  or resize the tab bar.

The Tahoe code explicitly says:

- only the main window actually has an `NSTabBar`;
- AppKit creates or moves the `NSTabBar` as windows gain or lose main status;
- detecting the actual tab bar requires searching the view hierarchy;
- setup must be idempotent.

Implication:

Ghostty treats AppKit as the tab-layout engine and works around private AppKit
view hierarchy details only to place it correctly.

### New Tab Button Is Native

Files:

- `TitlebarTabsVenturaTerminalWindow.swift`
- `TitlebarTabsTahoeTerminalWindow.swift`

Relevant behavior:

- Ghostty finds `NSTabBarNewTabButton`.
- It adjusts opacity/tint in some themes.
- It does not replace the new-tab button with a separate custom button.
- `TerminalController.newWindowForTab` handles the native `+` button action by
  routing it back into Ghostty's core "new tab" action.

Implication:

The plus button is visually part of the native tab bar. Retab should treat any
future add-sheet button the same way: it belongs inside the tab strip's native
geometry, not as a detached toolbar button.

## Code-Level Walkthrough

This section follows the actual Ghostty control flow as closely as possible.

### Base Window Setup

File:
`/tmp/ghostty/macos/Sources/Features/Terminal/Window Styles/TerminalWindow.swift`

In `TerminalWindow`, Ghostty opts into AppKit tabbing during window setup:

```swift
tabbingMode = .preferred
DispatchQueue.main.async {
    self.tabbingMode = .automatic
}
```

The order matters:

- `.preferred` is applied synchronously.
- `.automatic` is applied one main-queue tick later.
- The source comment says this is required for window restoration; without it,
  restored tabs come back as separate windows.

This is an early signal that Ghostty is not treating tabs as ordinary child
views. AppKit owns the tab group, restoration, tab bar creation, and native tab
semantics.

Retab translation:

- Browser XLSX tabs do not have AppKit.
- We must explicitly implement the observable parts AppKit gives Ghostty:
  clipped overflow, active reveal, stable geometry, native-like wheel behavior,
  and edge clamping.

### Accessory Hook

File:
`/tmp/ghostty/macos/Sources/Features/Terminal/Window Styles/TerminalWindow.swift`

Ghostty's base tab detection hook is:

```swift
override func addTitlebarAccessoryViewController(_ childViewController: NSTitlebarAccessoryViewController) {
    super.addTitlebarAccessoryViewController(childViewController)

    if isTabBar(childViewController) {
        childViewController.identifier = Self.tabBarIdentifier
        tabBarDidAppear()
    }
}
```

Removal mirrors addition:

```swift
override func removeTitlebarAccessoryViewController(at index: Int) {
    if let childViewController = titlebarAccessoryViewControllers[safe: index], isTabBar(childViewController) {
        tabBarDidDisappear()
    }

    super.removeTitlebarAccessoryViewController(at: index)
}
```

This is not drawing code. It is lifecycle code around an AppKit object.

Important implementation details:

- The hook runs when AppKit adds a titlebar accessory.
- Ghostty calls `super` first in the base class.
- It detects whether the accessory is the native tab bar.
- It tags the controller with `_ghosttyTabBar`.
- It removes/re-adds unrelated titlebar accessories when the tab bar appears or
  disappears.

Retab translation:

- Our tab strip should have an explicit lifecycle boundary too: mount, measure,
  observe resize, observe scroll, and re-run reveal after sheet count/active
  index changes.
- Treat the tab strip as a measured component, not a static flex row.

### AppKit Tab Bar Detection

File:
`/tmp/ghostty/macos/Sources/Features/Terminal/Window Styles/TerminalWindow.swift`

Ghostty's `isTabBar` is intentionally defensive:

```swift
func isTabBar(_ childViewController: NSTitlebarAccessoryViewController) -> Bool {
    if childViewController.identifier == nil {
        if childViewController.view.contains(className: "NSTabBar") {
            return true
        }

        if childViewController.layoutAttribute == .bottom &&
            childViewController.view.className == "NSView" &&
            childViewController.view.subviews.isEmpty {
            return true
        }

        return false
    }

    return childViewController.identifier == Self.tabBarIdentifier
}
```

The cases are important:

- Good path: the accessory view hierarchy already contains `NSTabBar`.
- Transitional path: AppKit may first add an empty `NSView` at the bottom, then
  populate the real tab bar later.
- Tagged path: once Ghostty identifies it, it uses `_ghosttyTabBar` for future
  checks.

Retab translation:

- DOM should expose stable `data-slot` names for the same reason.
- Do not rely on fragile class composition to find the scroller, track, or tab
  buttons in tests and future code.
- Required slots:
  - `xlsx-viewer-tabs`
  - `xlsx-viewer-tabs-clip` or `xlsx-viewer-tabs-scroll`
  - `xlsx-viewer-tabs-track`
  - `xlsx-viewer-tabs-tab`

### Private View-Hierarchy Helpers

Ghostty uses view hierarchy searching to find private AppKit pieces.

Files:

- `/tmp/ghostty/macos/Sources/Helpers/Extensions/NSView+Extension.swift`
- `/tmp/ghostty/macos/Sources/Helpers/Extensions/NSWindow+Extension.swift`

Representative helpers:

```swift
func contains(className name: String) -> Bool
func firstSuperview(withClassName name: String) -> NSView?
func firstDescendant(withClassName name: String) -> NSView?
func descendants(withClassName name: String) -> [NSView]
func firstViewFromRoot(withClassName name: String) -> NSView?
```

For windows:

```swift
var titlebarView: NSView? {
    guard let themeFrameView = contentView?.rootView else { return nil }
    guard themeFrameView.responds(to: Selector(("titlebarView"))) else { return nil }
    return themeFrameView.value(forKey: "titlebarView") as? NSView
}

var tabBarView: NSView? {
    titlebarView?.firstDescendant(withClassName: "NSTabBar")
}
```

Ghostty is using private AppKit class names:

- `NSTabBar`
- `NSTabButton`
- `NSTabBarNewTabButton`
- `NSTitlebarAccessoryClipView`
- `NSToolbarView`
- `NSToolbarClippedItemsIndicatorViewer`
- `NSTitlebarView`

Retab translation:

- We do not need private class names, but we do need equally explicit internal
  structure.
- All geometry-dependent code should query refs, not broad selectors.
- Tests should validate the slot structure, because the structure is the
  behavior contract.

### Ventura Titlebar Tabs Control Flow

File:
`/tmp/ghostty/macos/Sources/Features/Terminal/Window Styles/TitlebarTabsVenturaTerminalWindow.swift`

Ventura path starts by enabling titlebar tabs in `awakeFromNib`:

```swift
override func awakeFromNib() {
    super.awakeFromNib()

    titlebarTabs = true
    backgroundColor = derivedConfig.backgroundColor
    titlebarColor = derivedConfig.backgroundColor.withAlphaComponent(derivedConfig.backgroundOpacity)
}
```

Setting `titlebarTabs = true` triggers:

```swift
var titlebarTabs = false {
    didSet {
        self.titleVisibility = titlebarTabs ? .hidden : .visible
        if titlebarTabs {
            generateToolbar()
        } else {
            toolbar = nil
        }
    }
}
```

Then the subclass intercepts AppKit's accessory insertion before/after `super`:

```swift
override func addTitlebarAccessoryViewController(_ childViewController: NSTitlebarAccessoryViewController) {
    let isTabBar = self.titlebarTabs && isTabBar(childViewController)

    if isTabBar {
        childViewController.layoutAttribute = .right
        titleVisibility = .hidden
        childViewController.identifier = Self.tabBarIdentifier
    }

    super.addTitlebarAccessoryViewController(childViewController)

    if isTabBar {
        pushTabsToTitlebar(childViewController)
    }
}
```

The sequencing is precise:

1. Detect AppKit's tab accessory.
2. Force its layout attribute to `.right`.
3. Hide the native title to prevent toolbar collision.
4. Tag the controller.
5. Call `super`.
6. After AppKit installs the accessory, push it into Ghostty's titlebar layout.

Retab translation:

- Set structural CSS before measuring.
- Measure after DOM layout has happened.
- Programmatic reveal should happen in a layout effect or post-layout effect,
  not during render.
- Avoid deriving scroll positions before the browser has real tab widths.

### Ventura `pushTabsToTitlebar`

File:
`/tmp/ghostty/macos/Sources/Features/Terminal/Window Styles/TitlebarTabsVenturaTerminalWindow.swift`

The core method is `pushTabsToTitlebar`.

It first ensures the titlebar has a toolbar and hides the toolbar title:

```swift
if toolbar == nil {
    generateToolbar()
}

if let toolbar = toolbar as? TerminalToolbar {
    toolbar.titleIsHidden = true
}
```

Then it waits one main-queue tick:

```swift
DispatchQueue.main.async { [weak self] in
    ...
}
```

The comment explains why: restored windows with tabs can have broken tab bars if
Ghostty acts before AppKit has completed setup.

Inside the deferred block, Ghostty walks from the accessory outward:

```swift
let accessoryView = tabBarController.view
guard let accessoryClipView = accessoryView.superview else { return }
guard let titlebarView = accessoryClipView.superview else { return }
guard titlebarView.className == "NSTitlebarView" else { return }
guard let toolbarView = titlebarView.subviews.first(where: {
    $0.className == "NSToolbarView"
}) else { return }
```

Then Ghostty creates adjacent titlebar support views:

```swift
self?.addWindowButtonsBackdrop(titlebarView: titlebarView, toolbarView: toolbarView)
guard let windowButtonsBackdrop = self?.windowButtonsBackdrop else { return }

self?.addWindowDragHandle(titlebarView: titlebarView, toolbarView: toolbarView)
```

Finally, it installs the constraints that matter for overflow:

```swift
accessoryClipView.translatesAutoresizingMaskIntoConstraints = false
accessoryClipView.leftAnchor.constraint(equalTo: windowButtonsBackdrop.rightAnchor).isActive = true
accessoryClipView.rightAnchor.constraint(equalTo: toolbarView.rightAnchor).isActive = true
accessoryClipView.topAnchor.constraint(equalTo: toolbarView.topAnchor).isActive = true
accessoryClipView.heightAnchor.constraint(equalTo: toolbarView.heightAnchor).isActive = true
accessoryClipView.needsLayout = true

accessoryView.translatesAutoresizingMaskIntoConstraints = false
accessoryView.leftAnchor.constraint(equalTo: accessoryClipView.leftAnchor).isActive = true
accessoryView.rightAnchor.constraint(equalTo: accessoryClipView.rightAnchor).isActive = true
accessoryView.topAnchor.constraint(equalTo: accessoryClipView.topAnchor).isActive = true
accessoryView.heightAnchor.constraint(equalTo: accessoryClipView.heightAnchor).isActive = true
accessoryView.needsLayout = true
```

The visual effect comes from this relationship:

- `accessoryClipView` defines the visible viewport.
- `accessoryView` contains the native tab bar.
- AppKit decides tab button geometry inside that accessory.
- The clip view cuts the tab strip at arbitrary x coordinates.

Retab translation:

```tsx
<div data-slot="xlsx-viewer-tabs">
  <div ref={clipRef} data-slot="xlsx-viewer-tabs-clip">
    <div ref={trackRef} data-slot="xlsx-viewer-tabs-track">
      {tabs}
    </div>
  </div>
</div>
```

The clip must be a first-class element. It is not just decoration. Its bounds
are the visible tab-bar viewport.

### Tahoe `setupTabBar`

File:
`/tmp/ghostty/macos/Sources/Features/Terminal/Window Styles/TitlebarTabsTahoeTerminalWindow.swift`

Tahoe makes the native relationship even more explicit:

```swift
func setupTabBar() {
    guard tabBarObserver == nil else { return }

    guard
        let titlebarView,
        let tabBarView = self.tabBarView
    else { return }
```

It finds the actual AppKit clip hierarchy:

```swift
guard let clipView = tabBarView.firstSuperview(withClassName: "NSTitlebarAccessoryClipView") else { return }
guard let accessoryView = clipView.subviews[safe: 0] else { return }
guard let toolbarView = titlebarView.firstDescendant(withClassName: "NSToolbarView") else { return }
```

It also finds the native plus button:

```swift
guard let newTabButton = titlebarView.firstDescendant(withClassName: "NSTabBarNewTabButton") else { return }
tabBarView.frame.size.height = newTabButton.frame.width
```

That line is subtle: the tab-bar height is aligned to native new-tab button
geometry. Ghostty is still reading native geometry and adapting around it.

It computes titlebar left padding:

```swift
let leftPadding: CGFloat = switch self.derivedConfig.macosWindowButtons {
case .hidden: 0
case .visible: 70
}
```

Then it constrains clip and accessory:

```swift
NSLayoutConstraint.activate([
    clipView.leftAnchor.constraint(equalTo: container.leftAnchor, constant: leftPadding),
    clipView.rightAnchor.constraint(equalTo: container.rightAnchor),
    clipView.topAnchor.constraint(equalTo: container.topAnchor, constant: 2),
    clipView.heightAnchor.constraint(equalTo: container.heightAnchor),
    accessoryView.leftAnchor.constraint(equalTo: clipView.leftAnchor),
    accessoryView.rightAnchor.constraint(equalTo: clipView.rightAnchor),
    accessoryView.topAnchor.constraint(equalTo: clipView.topAnchor),
    accessoryView.heightAnchor.constraint(equalTo: clipView.heightAnchor),
])
```

The Tahoe path also registers a frame observer:

```swift
tabBarView.postsFrameChangedNotifications = true
tabBarObserver = NotificationCenter.default.addObserver(
    forName: NSView.frameDidChangeNotification,
    object: tabBarView,
    queue: .main
) { [weak self] _ in
    guard let self else { return }
    self.tabBarObserver = nil
    DispatchQueue.main.async {
        self.setupTabBar()
    }
}
```

This matters for Retab:

- ResizeObserver is not optional.
- If the track width, viewport width, font, or tab count changes, cached reveal
  geometry must be invalidated.
- Re-apply reveal after resize only when necessary, and preserve user scroll
  position when the active tab remains validly visible with slivers.

### Ghostty Does Not Search For Scroll Offset Code

There is no Ghostty macOS source implementing:

- `scrollLeft`;
- tab-strip wheel math;
- a tab-strip scroll target;
- active tab `scrollIntoView`;
- custom overflow buttons;
- edge fades;
- hand-written tab clipping.

The closest tab-specific private API helper is:

```swift
func tabButtonsInVisualOrder() -> [NSView] {
    guard let tabBarView else { return [] }
    return tabBarView
        .descendants(withClassName: "NSTabButton")
        .sorted { $0.frame.minX < $1.frame.minX }
}
```

That helper is for hit-testing and tab title editing/reordering support, not for
overflow scrolling.

Retab translation:

- If Retab implements custom web tabs, Retab must own the overflow policy.
- The implementation cannot claim "Ghostty-like" unless it explicitly preserves
  clipped neighboring tabs.

### Titlebar Style Configuration

File:
`/tmp/ghostty/macos/Sources/Ghostty/Ghostty.Config.swift`

Ghostty exposes the titlebar style through config:

```swift
var macosTitlebarStyle: MacOSTitlebarStyle {
    let defaultValue = MacOSTitlebarStyle.transparent
    guard let config = self.config else { return defaultValue }
    var v: UnsafePointer<Int8>?
    let key = "macos-titlebar-style"
    guard ghostty_config_get(config, &v, key, UInt(key.lengthOfBytes(using: .utf8))) else { return defaultValue }
    guard let ptr = v else { return defaultValue }
    return MacOSTitlebarStyle(rawValue: String(cString: ptr)) ?? defaultValue
}
```

The screenshot corresponds to:

```txt
macos-titlebar-style = tabs
```

This is not the default Ghostty titlebar path. It is a specific mode with its
own `TitlebarTabsVenturaTerminalWindow` or `TitlebarTabsTahoeTerminalWindow`
implementation.

Retab translation:

- The XLSX tab strip should not be treated as a minor styling variant of a
  generic tab row.
- It needs its own explicit behavior mode: "native clipped overflow".

### Appearance Resync Around AppKit Recreating Tab Views

File:
`/tmp/ghostty/macos/Sources/Features/Terminal/Window Styles/TransparentTitlebarTerminalWindow.swift`

Ghostty has extra machinery because macOS can recreate tab/titlebar views during
tab operations. The transparent-titlebar base class stores KVO observations:

```swift
private var tabGroupWindowsObservation: NSKeyValueObservation?
private var tabBarVisibleObservation: NSKeyValueObservation?
```

On appearance sync, it re-establishes KVO:

```swift
setupKVO()
```

The `tabGroup.windows` observer exists because window changes can recreate the
tab bar and break Ghostty's custom appearance:

```swift
tabGroupWindowsObservation = tabGroup.observe(
    \.windows,
     options: [.new]
) { [weak self] _, _ in
    guard let self else { return }
    guard let lastSurfaceConfig else { return }
    self.syncAppearance(lastSurfaceConfig)
}
```

The tab-bar visibility observer exists because the user can show/hide the tab
bar manually:

```swift
tabBarVisibleObservation = tabGroup?.observe(
    \.isTabBarVisible,
     options: [.new]
) { [weak self] _, _ in
    guard let self else { return }
    guard let lastSurfaceConfig else { return }
    self.syncAppearance(lastSurfaceConfig)
}
```

Retab translation:

- Sheet count changes are not just data updates; they can invalidate geometry.
- Resize, font loading, zoom, sidebars opening/closing, and sheet creation or
  deletion must all re-run measurement.
- Geometry must be read after layout, not cached indefinitely.

### Tab Relabeling And Shortcut Labels

File:
`/tmp/ghostty/macos/Sources/Features/Terminal/TerminalController.swift`

Ghostty updates native tab accessory labels according to configured keyboard
shortcuts:

```swift
func relabelTabs() {
    tabListenForFrame = window?.tabbedWindows?.count ?? 0 > 1

    if let windows = window?.tabbedWindows as? [TerminalWindow] {
        for (tab, window) in zip(1..., windows) {
            guard tab <= 9 else {
                window.keyEquivalent = ""
                continue
            }

            if let equiv = ghostty.config.keyboardShortcut(for: "goto_tab:\(tab)") {
                window.keyEquivalent = "\(equiv)"
            } else {
                window.keyEquivalent = ""
            }
        }
    }
}
```

This matters visually because the screenshot shows shortcut labels such as
`⌘4`, `⌘5`, etc. Those labels are not custom React spans; they are AppKit tab
accessory labels driven by `window.keyEquivalent`.

Ghostty also has a frame-change hack for mouse reordering:

```swift
@objc private func onFrameDidChange(_ notification: NSNotification) {
    guard tabListenForFrame else { return }
    guard let v = self.window?.tabbedWindows?.hashValue else { return }
    guard tabWindowsHash != v else { return }
    tabWindowsHash = v
    self.relabelTabs()
}
```

The source comment says there is no clean AppKit event for manual tab reordering
in a native tab group, so Ghostty detects a changed `tabbedWindows` hash and
relabels.

Retab translation:

- If Retab ever shows sheet indices, accelerators, or close buttons inside tabs,
  they must be included in width measurement.
- Reordering or sheet-list mutation must refresh labels and geometry together.
- Do not measure only sheet-title text if additional inline controls are present.

### Native Tab Navigation

File:
`/tmp/ghostty/macos/Sources/Features/Terminal/TerminalController.swift`

Ghostty's previous/next/last/goto tab behavior operates on
`NSWindowTabGroup.windows`:

```swift
guard let tabGroup = windowController.window?.tabGroup else { return }
let tabbedWindows = tabGroup.windows
```

For previous/next/last, Ghostty computes the destination index:

```swift
if tabIndex == GHOSTTY_GOTO_TAB_PREVIOUS.rawValue {
    if selectedIndex == 0 {
        finalIndex = tabbedWindows.count - 1
    } else {
        finalIndex = selectedIndex - 1
    }
} else if tabIndex == GHOSTTY_GOTO_TAB_NEXT.rawValue {
    if selectedIndex == tabbedWindows.count - 1 {
        finalIndex = 0
    } else {
        finalIndex = selectedIndex + 1
    }
} else if tabIndex == GHOSTTY_GOTO_TAB_LAST.rawValue {
    finalIndex = tabbedWindows.count - 1
}
```

For numbered goto, the configured index is 1-based and clamps to the last tab:

```swift
finalIndex = min(Int(tabIndex - 1), tabbedWindows.count - 1)
```

Then AppKit selection is triggered by making that window key:

```swift
let targetWindow = tabbedWindows[finalIndex]
targetWindow.makeKeyAndOrderFront(nil)
```

Retab translation:

- Previous/next wraps.
- Numbered goto, if implemented, should be 1-based and clamp to last.
- Navigation should update selection; reveal should be a consequence of active
  selection, not a separate imperative path in every key handler.

### Native Accessory Actions Select Their Associated Tab First

File:
`/tmp/ghostty/macos/Sources/Features/Terminal/Window Styles/TitlebarTabsVenturaTerminalWindow.swift`

Ghostty has an accessory action for split zoom. It finds the tab whose accessory
view contains the sender, selects that window, then performs the action:

```swift
guard let associatedWindow = tabGroup.windows.first(where: {
    guard let accessoryView = $0.tab.accessoryView else { return false }
    return accessoryView.subviews.contains(sender)
}),
      let windowController = associatedWindow.windowController as? TerminalController
else { return }

tabGroup.selectedWindow = associatedWindow
windowController.splitZoom(self)
```

Retab translation:

- Any inline tab control must first resolve its owning sheet.
- If tab controls are added later, clicking them should not leave active sheet
  and focused tab out of sync.
- Event handlers inside tabs must preserve the same reveal behavior as clicking
  the tab itself.

### Title And Font Details Affect Native Tab Geometry

File:
`/tmp/ghostty/macos/Sources/Features/Terminal/Window Styles/TerminalWindow.swift`

Ghostty updates the native tab's attributed title when the window title or
titlebar font changes:

```swift
override var title: String {
    didSet {
        tab.attributedTitle = attributedTitle
        titlebarTextField?.usesSingleLineMode = !hasMoreThanOneTabs
    }
}

var titlebarFont: NSFont? {
    didSet {
        let font = titlebarFont ?? NSFont.titleBarFont(ofSize: NSFont.systemFontSize)
        titlebarTextField?.font = font
        titlebarTextField?.usesSingleLineMode = !hasMoreThanOneTabs
        tab.attributedTitle = attributedTitle
    }
}
```

The attributed title includes font and active/inactive foreground color:

```swift
let attributes: [NSAttributedString.Key: Any] = [
    .font: titlebarFont,
    .foregroundColor: isKeyWindow ? NSColor.labelColor : NSColor.secondaryLabelColor,
]
```

Retab translation:

- Font changes are geometry changes.
- Active/inactive styling must not change measured width.
- Avoid font-weight or letter-spacing changes on active tabs if they cause width
  jitter.
- If active styling changes weight, reserve width with a stable fixed tab width.

### Ghostty UI Tests Verify Geometry, Not Overflow Math

File:
`/tmp/ghostty/macos/GhosttyUITests/GhosttyTitlebarTabsUITests.swift`

The titlebar tabs UI tests enable:

```txt
macos-titlebar-style = tabs
title = "GhosttyTitlebarTabsUITests"
```

They verify:

- the custom titlebar title is vertically centered with the reset zoom button;
- two native tabs appear after `⌘T`;
- tab geometry works in a normal window;
- tab geometry works in fullscreen;
- tab geometry survives moving tabs;
- tab geometry survives merging all windows.

The core geometry assertions:

```swift
XCTAssertEqual(closeTabButtons.count, window.tabs.count)

for idx in 0 ..< window.tabs.count {
    let currentTab = window.tabs.element(boundBy: idx)
    currentTab.click()
    window.typeKey("\(idx + 1)", modifierFlags: .command)
    window.typeKey("d", modifierFlags: .command)
    window.typeKey("\n", modifierFlags: [.command, .shift])
    window.typeKey("\n", modifierFlags: [.command, .shift])

    if let previousHeight = previousTabHeight {
        XCTAssertEqual(currentTab.frame.height, previousHeight, accuracy: 1)
    }

    let titleFrame = currentTab.frame
    let shortcutLabelFrame = window.staticTexts.element(
        matching: NSPredicate(format: "value CONTAINS[c] '⌘\(idx + 1)'")
    ).firstMatch.frame
    let closeButtonFrame = closeTabButtons.element(boundBy: idx).frame

    XCTAssertEqual(titleFrame.midY, shortcutLabelFrame.midY, accuracy: 1)
    XCTAssertEqual(titleFrame.midY, closeButtonFrame.midY, accuracy: 1)
}
```

Important gap:

Ghostty's current UI tests verify height and vertical alignment, not the
overflow-reveal sliver behavior directly. The sliver behavior is inherited from
AppKit and visible in manual screenshots.

Retab translation:

- Retab cannot rely on native AppKit, so Retab must test the overflow slivers
  explicitly.
- Our tests need to go beyond Ghostty's tests because our implementation is
  custom web code.

### Compositing And Visual Stability

File:
`/tmp/ghostty/macos/Sources/Features/Terminal/TerminalController.swift`

Ghostty has a `fixTabBar` hack:

```swift
private func fixTabBar() {
    if let window = window, !window.isOpaque {
        window.isOpaque = true
        window.isOpaque = false
    }
}
```

The comment says this forces the tab bar to re-composite; otherwise it can drag
pieces of the background when a transparent window is moved.

Ventura titlebar tabs also repeatedly hide the toolbar overflow button and
titlebar separators:

```swift
hideToolbarOverflowButton()
hideTitleBarSeparators()
```

It hides the `NSVisualEffectView` in the titlebar-tabs case so the titlebar
background can show through while unselected native tabs still blend correctly.

Retab translation:

- The strip needs visual stability during scroll.
- Avoid translucent overlays or gradients that smear against the content.
- Avoid hover/active styles that cause repaint artifacts or size changes.
- If the grid below scrolls independently, the tab strip background should be
  opaque enough to avoid visual bleed-through.

## What The Overflow Reveal Actually Is

The overflow reveal is a composition of several native behaviors:

1. A fixed visible viewport for the tab bar.
2. A tab layout whose total ideal width exceeds that viewport.
3. A clip view that clips the tab row at arbitrary pixel positions.
4. Native tab widths that do not collapse to zero.
5. The selected tab being scrolled/revealed into full view.
6. Adjacent tabs being allowed to remain partially visible.
7. No hard "snap to whole tab" clipping at the viewport edges.
8. No explicit left/right scroll buttons.
9. No edge fade gradients.
10. No visible scrollbar.

The important part is item 3: clipping happens at arbitrary pixels, so the user
sees partial tab geometry at the edges. That is the difference between Ghostty's
feel and a pale web copy.

## Visual Contract For Retab XLSX Tabs

The XLSX sheet tab strip should behave like a native clipped tab bar.

Required visual properties:

- Overflow must be revealed by partial tab slivers at the left and/or right
  edge when more tabs exist.
- The strip must never end at a perfectly clean boundary that hides all evidence
  of offscreen tabs.
- The active sheet tab must always be fully visible after selection.
- If there are offscreen tabs before the active tab, a left sliver should remain
  visible unless the active tab is the first sheet.
- If there are offscreen tabs after the active tab, a right sliver should remain
  visible unless the active tab is the last sheet.
- The user should understand overflow without seeing arrows, fades, tooltips, or
  a scrollbar.
- The tab strip should read as one continuous control, not as individual cards
  inside a scroll container.

The native sliver is subtle. It should be enough to show "there is more here",
not so large that it looks like a broken tab.

Recommended sliver target:

- `16px` to `28px` of the neighboring clipped tab on desktop.
- `12px` to `20px` on narrow mobile widths.
- Minimum `8px` when the strip is very tight.
- Never reserve sliver space when there is no overflow on that side.

## Interaction Contract

### Selection

When a sheet tab is selected:

- If it is already fully visible and the relevant overflow slivers are present,
  do not move the strip.
- If it is clipped on the left, reveal it fully and leave a left overflow sliver
  when possible.
- If it is clipped on the right, reveal it fully and leave a right overflow
  sliver when possible.
- If it is far away, jump or auto-scroll directly. Avoid slow animated travel
  across dozens of sheets.
- If it is nearby, a short smooth scroll is acceptable.

### Wheel And Trackpad

Wheel behavior should feel like native tab-bar panning:

- Vertical wheel over the tab strip should map to horizontal movement when the
  tab strip overflows.
- Horizontal trackpad movement should move horizontally.
- The event should only be captured while the tab strip can actually move in
  the requested direction.
- At the left and right ends, wheel movement should pass through to the page or
  containing viewer rather than trapping the user.
- Momentum should not produce a stuck state or fake "rubber band" implemented in
  JavaScript.

### Keyboard

Keyboard behavior should preserve Ghostty's navigation feel:

- Previous/next selection wraps.
- Home selects the first sheet.
- End selects the last sheet.
- Keyboard selection uses the same reveal algorithm as pointer selection.
- The focused active tab must be fully visible after keyboard navigation.
- When wrapping from last to first, scroll returns to the left edge.
- When jumping to last, scroll reaches the right edge.

## Retab Implementation Model

Retab cannot use AppKit's `NSTabBar` inside the browser. We need to reproduce the
observable behavior.

The implementation should use three conceptual layers:

1. `clip`: the fixed viewport that clips overflow.
2. `track`: the horizontally translated tab row.
3. `tabs`: fixed-width or bounded-width tab buttons inside the track.

The current "just scroll a row" model is insufficient unless it intentionally
manages edge slivers.

### Required State

The tab strip needs enough state to know:

- `scrollLeft`
- `maxScrollLeft`
- `viewportWidth`
- `trackWidth`
- `canScrollLeft`
- `canScrollRight`
- active tab rect relative to track
- previous active index, to infer movement direction
- whether the current movement is user-driven wheel/pan or programmatic reveal

### Required Constants

Proposed constants:

```ts
const TAB_STRIP_HEIGHT_PX = 36
const TAB_HEIGHT_PX = 28
const TAB_MIN_WIDTH_PX = 92
const TAB_MAX_WIDTH_PX = 184
const PREFERRED_VISIBLE_TABS = 6
const OVERFLOW_REVEAL_DESKTOP_PX = 22
const OVERFLOW_REVEAL_MOBILE_PX = 16
const OVERFLOW_REVEAL_MIN_PX = 8
const TAB_REVEAL_PADDING_PX = 8
const LARGE_REVEAL_DISTANCE_MULTIPLIER = 1.25
```

The key new constants are the overflow reveal sizes. These replace the idea that
the active tab merely needs padding from the viewport edge.

### Width Model

The width model should leave room for edge slivers when possible.

For many tabs:

- Determine a bounded base tab width.
- Prefer around six full visible tabs on desktop.
- On narrow widths, allow fewer full tabs but preserve the edge sliver.
- Do not shrink below the minimum width just to show more full tabs.

For few tabs:

- Expand tabs up to the maximum width.
- Do not show fake slivers when all tabs fit.
- Do not enable overflow state.

The decisive behavior is that crowded tabs should create a track wider than the
clip viewport, and the clip viewport should cut through tabs at arbitrary
positions.

## Reveal Algorithm

The reveal algorithm must target tab visibility plus overflow affordance.

Definitions:

```ts
viewportLeft = scrollLeft
viewportRight = scrollLeft + viewportWidth
activeLeft = activeTab.offsetLeft
activeRight = activeLeft + activeTab.offsetWidth
hasTabsBefore = activeIndex > 0
hasTabsAfter = activeIndex < sheetCount - 1
leftReveal = hasTabsBefore ? overflowRevealPx : 0
rightReveal = hasTabsAfter ? overflowRevealPx : 0
```

The desired visible region for the active tab is not the full viewport. It is an
inset region that reserves sliver space on whichever side has overflow:

```ts
desiredLeft = viewportLeft + leftReveal
desiredRight = viewportRight - rightReveal
```

Reveal logic:

```ts
let nextScrollLeft = scrollLeft

if (activeLeft < desiredLeft) {
  nextScrollLeft = activeLeft - leftReveal
}

if (activeRight > desiredRight) {
  nextScrollLeft = activeRight - viewportWidth + rightReveal
}

nextScrollLeft = clamp(nextScrollLeft, 0, maxScrollLeft)
```

Then apply edge corrections:

```ts
if (activeIndex === 0) {
  nextScrollLeft = 0
}

if (activeIndex === sheetCount - 1) {
  nextScrollLeft = maxScrollLeft
}
```

This is the part that creates the Ghostty-like reveal: when selecting a middle
tab, the active tab is fully visible while the viewport still cuts into adjacent
tabs.

## User-Driven Scroll Model

User wheel or trackpad scroll should not snap to tab boundaries. Native AppKit
does not make the overflow feel like a carousel. It lets the clip reveal
arbitrary partial tabs.

Therefore:

- Wheel scrolling updates `scrollLeft` continuously.
- Do not snap after wheel.
- Do not center the active tab after every wheel event.
- Do not auto-correct slivers during direct user scroll.
- Only selection/focus changes should run the reveal algorithm.

This distinction matters. If every wheel event snaps to a "nice" position, the
strip will feel artificial.

## Styling Contract

The native Ghostty effect depends on visual continuity.

Retab should use:

- a single clipped strip container;
- no visible scrollbar;
- no edge fade;
- no left/right arrow controls;
- no separate cards around tabs;
- no large gaps between tabs;
- thin separators or subtle borders between unselected tabs;
- active tab visually merged with the strip background;
- inactive tabs visually present but subdued;
- text truncation inside tabs;
- stable tab height;
- stable tab width;
- a clipped track that can expose partial tabs.

The root container should have `overflow: hidden`.
The scroller or track viewport should clip the tab row.
The row itself should be wider than the viewport when crowded.

## DOM Contract

Recommended structure:

```tsx
<div data-slot="xlsx-viewer-tabs" role="tablist">
  <div data-slot="xlsx-viewer-tabs-clip">
    <div data-slot="xlsx-viewer-tabs-track">
      <button role="tab">...</button>
      <button role="tab">...</button>
    </div>
  </div>
</div>
```

If native browser scrolling is retained:

```tsx
<div data-slot="xlsx-viewer-tabs" role="tablist">
  <div data-slot="xlsx-viewer-tabs-scroll">
    <div data-slot="xlsx-viewer-tabs-track">
      <button role="tab">...</button>
    </div>
  </div>
</div>
```

But the important contract is that the scroll viewport must intentionally leave
partial tabs visible during overflow. A plain `scrollIntoView({ inline:
"nearest" })` is not enough.

## Acceptance Criteria

Static geometry:

- With dozens of tabs at desktop width, the first view shows the active tab fully
  and shows a partial tab at the right edge.
- After scrolling right, the left edge shows a partial previous tab and the right
  edge shows a partial next tab.
- At `scrollLeft = 0`, there is no fake left sliver.
- At `scrollLeft = maxScrollLeft`, there is no fake right sliver.
- On mobile width, the page itself does not gain horizontal overflow.

Selection:

- Selecting a clipped-right tab reveals it fully but leaves a right sliver if
  there are more tabs after it.
- Selecting a clipped-left tab reveals it fully but leaves a left sliver if
  there are more tabs before it.
- Selecting the first tab clamps to the left edge.
- Selecting the last tab clamps to the right edge.
- Selecting a far tab jumps quickly rather than slowly animating across the
  entire track.

Wheel:

- Wheel over an overflowing tab strip changes only the tab strip's horizontal
  scroll position.
- Wheel at the left edge with a leftward delta is not trapped.
- Wheel at the right edge with a rightward delta is not trapped.
- Wheel movement does not snap to tab boundaries.

Keyboard:

- Arrow navigation wraps.
- Home and End work.
- Revealed keyboard targets are fully visible.
- Edge slivers are preserved for non-edge targets.

Visual:

- No scroll arrows.
- No edge fade gradients.
- No visible horizontal scrollbar.
- No detached overflow menu.
- No card-like tab wrappers.
- No layout shift while hovering, focusing, selecting, or scrolling.

## Test Plan

Unit tests should cover the pure reveal math.

Cases:

- active first tab returns `0`;
- active last tab returns `maxScrollLeft`;
- active middle tab clipped right returns `activeRight - viewportWidth +
  revealPx`;
- active middle tab clipped left returns `activeLeft - revealPx`;
- active visible with both slivers already present returns current scroll;
- active visible but right sliver absent adjusts just enough to expose sliver;
- active visible but left sliver absent adjusts just enough to expose sliver;
- results clamp to `[0, maxScrollLeft]`;
- reveal size shrinks on narrow viewports;
- reveal size is `0` on sides without overflow.

Component tests should cover:

- one internal scroller/clip area;
- no scroll buttons;
- no edge fades;
- active tab roving `tabIndex`;
- wheel movement;
- wheel edge pass-through;
- keyboard wrap;
- tab width stability;
- compact mobile width.

Browser tests should cover:

- desktop screenshot or DOM geometry showing partial right tab at initial left
  edge;
- desktop after wheel showing partial left and partial right tabs;
- desktop after End showing last tab fully visible at right edge;
- desktop after wrap showing first tab fully visible at left edge;
- mobile geometry with no document horizontal overflow;
- mobile partial right tab after initial render;
- mobile partial left and right tabs after wheel.

## Implementation Warning

The current Retab implementation that only ensures the active tab is visible is
not enough. It can pass accessibility and scroll tests while still missing the
Ghostty feel.

The missing behavior is intentional sliver preservation.

In practical terms, any code that does this:

```ts
if (activeRight > viewportRight) {
  scrollLeft = activeRight - viewportWidth + padding
}
```

is incomplete unless `padding` is specifically the overflow-reveal sliver and is
only applied on sides where offscreen tabs exist.

The goal is not padding. The goal is visible clipped neighboring tabs.

## Retab Design Decision

Retab should implement a `resolveTabRevealScrollLeft` helper as a pure function.
It should take viewport geometry, active tab geometry, sheet count, active index,
and reveal constants. The React component should use that helper for selection,
keyboard navigation, and active-sheet prop changes.

This makes the behavior testable without relying on browser layout quirks.

Suggested function signature:

```ts
function resolveTabRevealScrollLeft({
  activeIndex,
  sheetCount,
  scrollLeft,
  viewportWidth,
  scrollWidth,
  activeLeft,
  activeWidth,
  overflowRevealPx,
}: {
  activeIndex: number
  sheetCount: number
  scrollLeft: number
  viewportWidth: number
  scrollWidth: number
  activeLeft: number
  activeWidth: number
  overflowRevealPx: number
}): number
```

This function should be the canonical tab-strip reveal policy.

## Retab Code Shape

This section is intentionally close to the TypeScript implementation shape.

### Data Slots And Refs

The component should have stable refs that correspond to Ghostty's AppKit
objects:

```ts
const clipRef = React.useRef<HTMLDivElement>(null)
const trackRef = React.useRef<HTMLDivElement>(null)
const tabRefs = React.useRef<Array<HTMLButtonElement | null>>([])
```

Mapping:

- `clipRef` is the Retab equivalent of `NSTitlebarAccessoryClipView`.
- `trackRef` is the Retab equivalent of the AppKit accessory view containing the
  `NSTabBar`.
- `tabRefs[index]` are the Retab equivalent of `NSTabButton` views.

Required DOM:

```tsx
<div
  data-slot="xlsx-viewer-tabs"
  data-overflowing={scrollState.isOverflowing}
  data-can-scroll-left={scrollState.canScrollLeft}
  data-can-scroll-right={scrollState.canScrollRight}
  role="tablist"
>
  <div
    ref={clipRef}
    data-slot="xlsx-viewer-tabs-clip"
    onWheel={onTabsWheel}
  >
    <div ref={trackRef} data-slot="xlsx-viewer-tabs-track">
      {sheets.map((sheet, sheetIndex) => (
        <button
          ref={(element) => {
            tabRefs.current[sheetIndex] = element
          }}
          data-slot="xlsx-viewer-tabs-tab"
          role="tab"
          aria-selected={sheetIndex === activeSheetIndex}
        />
      ))}
    </div>
  </div>
</div>
```

If implementation keeps `overflow-x-auto`, the scrolling element can be the
clip. The naming still matters: it is the visible clipped viewport.

### Geometry Read Function

Do not spread geometry reads through the component. Use one function.

```ts
interface TabStripGeometry {
  scrollLeft: number
  viewportWidth: number
  scrollWidth: number
  maxScrollLeft: number
  activeLeft: number
  activeWidth: number
}

function readTabStripGeometry(
  clipElement: HTMLDivElement,
  activeTabElement: HTMLButtonElement
): TabStripGeometry {
  const scrollLeft = clipElement.scrollLeft
  const viewportWidth = clipElement.clientWidth
  const scrollWidth = clipElement.scrollWidth
  const maxScrollLeft = Math.max(0, scrollWidth - viewportWidth)

  return {
    scrollLeft,
    viewportWidth,
    scrollWidth,
    maxScrollLeft,
    activeLeft: activeTabElement.offsetLeft,
    activeWidth: activeTabElement.offsetWidth,
  }
}
```

Important:

- Use `offsetLeft` relative to the track/scroller coordinate space.
- Use `offsetWidth`, not `getBoundingClientRect().width`, for scroll math.
- Use `clientWidth` for viewport width.
- Clamp every computed scroll target.

### Reveal Size Function

The sliver size should be a function of viewport width and overflow state, not a
hard-coded padding.

```ts
function resolveOverflowRevealPx(viewportWidth: number) {
  if (viewportWidth <= 420) return 16
  if (viewportWidth <= 640) return 18
  return 22
}
```

If the viewport is extremely constrained:

```ts
function clampOverflowRevealPx(viewportWidth: number, tabWidth: number) {
  const target = resolveOverflowRevealPx(viewportWidth)
  const maxReasonable = Math.max(8, Math.floor(tabWidth * 0.35))
  return Math.min(target, maxReasonable)
}
```

Reason:

The sliver should read as a tab edge, not as a second fully competing tab.

### Canonical Reveal Helper

This helper is the core of the behavior.

```ts
interface ResolveTabRevealScrollLeftInput {
  activeIndex: number
  sheetCount: number
  scrollLeft: number
  viewportWidth: number
  scrollWidth: number
  activeLeft: number
  activeWidth: number
  overflowRevealPx: number
}

function resolveTabRevealScrollLeft({
  activeIndex,
  sheetCount,
  scrollLeft,
  viewportWidth,
  scrollWidth,
  activeLeft,
  activeWidth,
  overflowRevealPx,
}: ResolveTabRevealScrollLeftInput) {
  const maxScrollLeft = Math.max(0, scrollWidth - viewportWidth)
  if (maxScrollLeft === 0) return 0

  if (activeIndex <= 0) return 0
  if (activeIndex >= sheetCount - 1) return maxScrollLeft

  const activeRight = activeLeft + activeWidth
  const hasTabsBefore = activeIndex > 0
  const hasTabsAfter = activeIndex < sheetCount - 1
  const leftReveal = hasTabsBefore ? overflowRevealPx : 0
  const rightReveal = hasTabsAfter ? overflowRevealPx : 0

  const visibleLeft = scrollLeft + leftReveal
  const visibleRight = scrollLeft + viewportWidth - rightReveal

  let nextScrollLeft = scrollLeft

  if (activeLeft < visibleLeft) {
    nextScrollLeft = activeLeft - leftReveal
  } else if (activeRight > visibleRight) {
    nextScrollLeft = activeRight - viewportWidth + rightReveal
  }

  return Math.min(maxScrollLeft, Math.max(0, nextScrollLeft))
}
```

Critical branch behavior:

- First tab bypasses sliver math and clamps to `0`.
- Last tab bypasses sliver math and clamps to `maxScrollLeft`.
- Middle tabs reserve reveal pixels on both sides.
- Left-clipped tabs align their left edge after the left sliver.
- Right-clipped tabs align their right edge before the right sliver.
- Already-valid tabs do not move.

This is the browser equivalent of placing the native `NSTabBar` in a clip view:
the active tab is in the usable viewport, while the clip can still cut through
neighboring tabs.

### Sliver Preservation For Already Visible Tabs

The helper above preserves slivers when the active tab is outside the desired
interior region. It does not force slivers when the active tab is already fully
visible but the current scroll offset happens to land exactly on a tab boundary.

To make the behavior stricter, add a second helper:

```ts
function resolveSliverPreservingScrollLeft({
  activeIndex,
  sheetCount,
  scrollLeft,
  viewportWidth,
  scrollWidth,
  activeLeft,
  activeWidth,
  overflowRevealPx,
}: ResolveTabRevealScrollLeftInput) {
  const maxScrollLeft = Math.max(0, scrollWidth - viewportWidth)
  if (maxScrollLeft === 0) return 0
  if (activeIndex <= 0) return 0
  if (activeIndex >= sheetCount - 1) return maxScrollLeft

  const target = resolveTabRevealScrollLeft({
    activeIndex,
    sheetCount,
    scrollLeft,
    viewportWidth,
    scrollWidth,
    activeLeft,
    activeWidth,
    overflowRevealPx,
  })

  if (target !== scrollLeft) return target

  const viewportLeft = scrollLeft
  const viewportRight = scrollLeft + viewportWidth
  const hasHiddenLeft = viewportLeft > 0
  const hasHiddenRight = viewportRight < scrollWidth

  if (hasHiddenLeft && activeLeft - viewportLeft < overflowRevealPx) {
    return Math.max(0, activeLeft - overflowRevealPx)
  }

  const activeRight = activeLeft + activeWidth
  if (hasHiddenRight && viewportRight - activeRight < overflowRevealPx) {
    return Math.min(maxScrollLeft, activeRight - viewportWidth + overflowRevealPx)
  }

  return scrollLeft
}
```

Use this stricter version when selection changes. Do not use it after every wheel
event, because user-driven wheel should remain continuous.

### Effect Timing

Use layout effects for measurement/reveal:

```ts
React.useLayoutEffect(() => {
  const clipElement = clipRef.current
  const activeTabElement = tabRefs.current[activeSheetIndex]
  if (!clipElement || !activeTabElement) return

  const geometry = readTabStripGeometry(clipElement, activeTabElement)
  const overflowRevealPx = clampOverflowRevealPx(
    geometry.viewportWidth,
    geometry.activeWidth
  )
  const left = resolveSliverPreservingScrollLeft({
    activeIndex: activeSheetIndex,
    sheetCount: sheets.length,
    overflowRevealPx,
    ...geometry,
  })

  if (Math.abs(left - clipElement.scrollLeft) <= 1) return

  clipElement.scrollTo({
    left,
    behavior: shouldAnimateReveal(clipElement.scrollLeft, left, geometry.viewportWidth)
      ? "smooth"
      : "auto",
  })
}, [activeSheetIndex, sheets.length, tabWidth])
```

Use `useLayoutEffect` because:

- tab widths must be present;
- reveal should happen before the user sees a wrong active tab position;
- this mirrors Ghostty's "wait a tick until AppKit has real views, then
  constrain" behavior.

### Animation Decision

Ghostty/AppKit does not visibly crawl across dozens of tabs. The Retab rule
should be distance-based:

```ts
function shouldAnimateReveal(
  currentScrollLeft: number,
  nextScrollLeft: number,
  viewportWidth: number
) {
  return Math.abs(nextScrollLeft - currentScrollLeft) <= viewportWidth * 1.25
}
```

Behavior:

- nearby reveal: `"smooth"`;
- far reveal: `"auto"`;
- first/last keyboard jumps: usually `"auto"` if far.

### Wheel Handler

Wheel code should be minimal and directional:

```ts
function onTabsWheel(event: React.WheelEvent<HTMLDivElement>) {
  const clipElement = clipRef.current
  if (!clipElement) return

  const maxScrollLeft = clipElement.scrollWidth - clipElement.clientWidth
  if (maxScrollLeft <= 1) return

  const delta =
    Math.abs(event.deltaX) > Math.abs(event.deltaY)
      ? event.deltaX
      : event.deltaY

  if (delta === 0) return

  const nextScrollLeft = Math.min(
    maxScrollLeft,
    Math.max(0, clipElement.scrollLeft + delta)
  )

  if (Math.abs(nextScrollLeft - clipElement.scrollLeft) <= 1) return

  event.preventDefault()
  clipElement.scrollLeft = nextScrollLeft
}
```

Important:

- Do not run reveal math in the wheel handler.
- Do not snap to tabs.
- Do not synthesize edge bounce.
- Do not prevent default at either scroll edge when the strip cannot move.

### Resize Observer

Ghostty's Tahoe path watches the native `NSTabBar` frame and re-runs setup. The
Retab equivalent is a `ResizeObserver` over both clip and track:

```ts
React.useLayoutEffect(() => {
  const clipElement = clipRef.current
  const trackElement = trackRef.current
  if (!clipElement || !trackElement) return

  const update = () => {
    setScrollState(readScrollState(clipElement))
  }

  const resizeObserver = new ResizeObserver(update)
  resizeObserver.observe(clipElement)
  resizeObserver.observe(trackElement)

  update()

  return () => {
    resizeObserver.disconnect()
  }
}, [])
```

After resize:

- update `canScrollLeft`;
- update `canScrollRight`;
- update `isOverflowing`;
- recompute tab width;
- reveal active only if it is no longer validly visible with slivers.

### Scroll State

Keep scroll state descriptive and small:

```ts
interface SheetTabScrollState {
  canScrollLeft: boolean
  canScrollRight: boolean
  isOverflowing: boolean
  viewportWidth: number
}
```

Do not store derived tab rects in React state. Read geometry from the DOM when
revealing. Storing rects invites stale geometry and animation glitches.

### Keyboard Handler

Keyboard selection should only compute the next active index. It should not
manually scroll. The active-index effect should handle reveal.

```ts
function onTabKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
  const currentIndex = Number(event.currentTarget.dataset.sheetIndex)
  let nextIndex: number | undefined

  if (event.key === "ArrowLeft") {
    nextIndex = currentIndex === 0 ? sheets.length - 1 : currentIndex - 1
  } else if (event.key === "ArrowRight") {
    nextIndex = currentIndex === sheets.length - 1 ? 0 : currentIndex + 1
  } else if (event.key === "Home") {
    nextIndex = 0
  } else if (event.key === "End") {
    nextIndex = sheets.length - 1
  }

  if (nextIndex === undefined) return

  event.preventDefault()
  onSelectSheet(nextIndex)
  tabRefs.current[nextIndex]?.focus()
}
```

The reveal effect then enforces:

- first tab -> `scrollLeft = 0`;
- last tab -> `scrollLeft = maxScrollLeft`;
- middle tab -> active visible plus slivers.

### Unit Test Table

The helper should have table-driven tests.

```ts
const cases = [
  {
    name: "first tab clamps left",
    input: { activeIndex: 0, scrollLeft: 500, activeLeft: 0 },
    expected: 0,
  },
  {
    name: "last tab clamps right",
    input: { activeIndex: 9, scrollLeft: 0, activeLeft: 900 },
    expected: 700,
  },
  {
    name: "middle tab clipped right leaves right sliver",
    input: { activeIndex: 5, scrollLeft: 0, activeLeft: 500 },
    expected: 222,
  },
  {
    name: "middle tab clipped left leaves left sliver",
    input: { activeIndex: 2, scrollLeft: 500, activeLeft: 200 },
    expected: 178,
  },
  {
    name: "valid visible tab does not move",
    input: { activeIndex: 3, scrollLeft: 178, activeLeft: 300 },
    expected: 178,
  },
]
```

Use real numbers in tests that make the sliver visible:

- `viewportWidth = 300`
- `scrollWidth = 1000`
- `activeWidth = 100`
- `overflowRevealPx = 22`

Example math:

- clipped-right active at `[500, 600]`
- viewport `[0, 300]`
- desired right edge is `300 - 22 = 278`
- target is `600 - 300 + 22 = 322`

The expected value should be `322`, not merely "some positive scroll".

### Browser Geometry Assertions

The browser test should verify partial tabs by geometry, not by visual guessing.

At a non-edge scroll position:

```ts
const clipRect = clip.getBoundingClientRect()
const tabRects = tabs.map((tab) => tab.getBoundingClientRect())

const clippedLeftTabs = tabRects.filter((rect) => {
  return rect.left < clipRect.left && rect.right > clipRect.left
})

const clippedRightTabs = tabRects.filter((rect) => {
  return rect.left < clipRect.right && rect.right > clipRect.right
})
```

Assertions:

```ts
expect(clippedLeftTabs).toHaveLength(1)
expect(clippedRightTabs).toHaveLength(1)
expect(activeRect.left).toBeGreaterThanOrEqual(clipRect.left)
expect(activeRect.right).toBeLessThanOrEqual(clipRect.right)
```

At the first tab:

```ts
expect(clip.scrollLeft).toBe(0)
expect(clippedLeftTabs).toHaveLength(0)
expect(clippedRightTabs.length).toBeGreaterThanOrEqual(1)
```

At the last tab:

```ts
expect(clip.scrollLeft).toBe(clip.scrollWidth - clip.clientWidth)
expect(clippedLeftTabs.length).toBeGreaterThanOrEqual(1)
expect(clippedRightTabs).toHaveLength(0)
```

## Summary

Ghostty's overflow reveal is native AppKit behavior exposed through careful
titlebar placement. Ghostty does not draw custom overflow cues. It gets the feel
by preserving the native `NSTabBar` and clipping it in a titlebar accessory
viewport.

Retab should reproduce the observable result:

- clipped neighboring tabs as overflow hints;
- full active-tab reveal;
- no arrows, fades, or scrollbars;
- continuous wheel movement;
- edge pass-through;
- keyboard wrap and reveal;
- stable geometry across desktop and mobile.

The implementation should treat partial tab slivers as a first-class invariant,
not an incidental side effect.
