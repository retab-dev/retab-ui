# Ghostty Tabs Catalog

This is a catalog of the Ghostty tab implementation, focused on what makes the tab interaction feel native and subtle. The main lesson is not that Ghostty has elaborate custom scrolling code. It is the opposite: Ghostty delegates tab layout, clipping, selection, reordering, and scrolling to native tabbar widgets, then spends its effort making those widgets sit perfectly in Ghostty's window chrome.

The local Ghostty checkout studied for this note is `/tmp/ghostty`.

## Executive Summary

Ghostty has two platform implementations:

- macOS: AppKit native window tabs via `NSTabBar`.
- GTK/Linux: libadwaita tabs via `Adw.TabBar` and `Adw.TabView`.

The important behavioral properties are:

- There is one tabbar surface.
- Overflow stays inside that surface.
- There are no external previous/next scroll buttons.
- There are no decorative edge fades added by Ghostty.
- There is no hand-written scroll physics layer.
- Tabs expand to fill space when the platform/config says wide tabs are enabled.
- Once tabs are crowded, the native tabbar owns clipping, scrolling, and active-tab visibility.
- Keyboard previous/next wraps.
- Numeric tab navigation is 1-indexed and clamps when targeting beyond the last tab.
- Geometry stability is treated as a first-class behavior: tab height, vertical centering, close-button alignment, shortcut label alignment, and titlebar integration are tested.

For the Excel tabs, the closest web translation is not a carousel. It is a single clipped horizontal tab strip with native scroll behavior, expanding tabs until crowding, wrapped keyboard movement, and nearest-edge active-tab reveal.

## Source Map

### macOS

- `/tmp/ghostty/macos/Sources/Features/Terminal/Window Styles/TerminalWindow.swift`
  - Common native-tabbar detection and tagging.
  - `tabBarIdentifier`.
  - `isTabBar(_:)`.
  - generic add/remove accessory detection.

- `/tmp/ghostty/macos/Sources/Features/Terminal/Window Styles/TitlebarTabsVenturaTerminalWindow.swift`
  - macOS 13-15 titlebar-tabs implementation.
  - Hooks native AppKit tabbar accessory insertion.
  - Moves/constrains the native tabbar into the toolbar/titlebar area.
  - Hides conflicting titlebar and toolbar chrome.
  - Handles dark-background blending.
  - Adds window-buttons backdrop and a drag handle.

- `/tmp/ghostty/macos/Sources/Features/Terminal/Window Styles/TitlebarTabsTahoeTerminalWindow.swift`
  - macOS 26+ titlebar-tabs implementation.
  - More defensive because AppKit moves the real `NSTabBar` between main windows.
  - Finds the actual native tabbar whenever the window becomes main.
  - Observes native tabbar frame changes and reapplies constraints.

- `/tmp/ghostty/macos/Sources/Features/Terminal/Window Styles/TransparentTitlebarTerminalWindow.swift`
  - Shared transparent titlebar behavior.
  - Resyncs titlebar appearance after tab group and tabbar visibility changes.

- `/tmp/ghostty/macos/Sources/Features/Terminal/TerminalController.swift`
  - Creates tabs by adding windows to native AppKit tab groups.
  - Handles macOS tab group consistency delays.
  - Relabels tab keyboard equivalents.
  - Forces tabbar recomposition for transparent windows.
  - Detects native reorder indirectly through frame changes.

- `/tmp/ghostty/macos/Sources/Helpers/Extensions/NSWindow+Extension.swift`
  - Private AppKit view lookup.
  - `titlebarView`.
  - `tabBarView`.
  - `tabButtonsInVisualOrder()`.
  - fullscreen-safe tab hit testing.

- `/tmp/ghostty/macos/Sources/Helpers/TabTitleEditor.swift`
  - Inline editing over native AppKit tab buttons.
  - Uses visual tab button order instead of assuming view hierarchy order.
  - Handles fullscreen tabbar window event routing.

- `/tmp/ghostty/macos/GhosttyUITests/GhosttyTitlebarTabsUITests.swift`
  - Geometry and stability tests for titlebar tabs.

### GTK

- `/tmp/ghostty/src/apprt/gtk/ui/1.5/window.blp`
  - Declares the tabbar:
    - `Adw.TabBar tab_bar`
    - `autohide: bind template.tabs-autohide`
    - `expand-tabs: bind template.tabs-wide`
    - `view: tab_view`
    - `visible: bind template.tabs-visible`
  - Declares the matching `Adw.TabView tab_view`.
  - Adds start and end controls around the tabbar only when titlebar style is tabs.

- `/tmp/ghostty/src/apprt/gtk/class/window.zig`
  - Exposes tabbar properties to the template.
  - Computes tabbar autohide, visibility, and wide-tab behavior.
  - Implements tab selection and wrapping.
  - Moves the `Adw.TabBar` to top or bottom toolbar slot based on config.

- `/tmp/ghostty/src/apprt/gtk/class/application.zig`
  - Routes `goto_tab` app actions into `window.selectTab(...)`.

- `/tmp/ghostty/src/config/Config.zig`
  - Documents and defaults `window-show-tab-bar`, `gtk-tabs-location`, `gtk-titlebar-style`, and `gtk-wide-tabs`.

## macOS: What Is Actually Happening

### AppKit Native Window Tabs

Ghostty is not rendering custom tabs on macOS. It creates native AppKit tabs by adding windows into an AppKit tab group. The UI surface is AppKit's `NSTabBar`.

The common detector is in `TerminalWindow.swift`:

- Every tabbar accessory gets tagged with `TerminalWindow.tabBarIdentifier`.
- The identifier is `_ghosttyTabBar`.
- A view controller is considered the tabbar if:
  - it has no identifier and contains a descendant with class name `NSTabBar`;
  - or it is a bottom accessory `NSView` placeholder with no subviews, because AppKit sometimes adds an empty view first and attaches the tabbar later;
  - or it has already been tagged with `_ghosttyTabBar`.

Important implication: Ghostty depends on native AppKit tab lifecycle, including the weird cases. It does not own a clean React-style state machine for tabbar structure.

### Private View Lookup

`NSWindow+Extension.swift` uses private AppKit view traversal:

- `titlebarView` is fetched from the root `NSThemeFrame` via the private `titlebarView` selector.
- In normal windows, `NSTabBar` is usually below `NSTitlebarView` inside `NSThemeFrame`.
- In fullscreen, AppKit may host the titlebar/tabbar in a separate fullscreen window, so Ghostty cannot assume the same view tree.
- `tabBarView` is the first descendant of `titlebarView` whose class name is `NSTabBar`.
- `tabButtonsInVisualOrder()` finds descendants named `NSTabButton` and sorts them by `frame.minX`.

This is a subtle but important choice: visual order is treated as the source of truth for hit testing and inline title editing, not the raw subview order.

### Fullscreen Hit Testing

`NSWindow+Extension.swift` has fullscreen-safe tab hit testing:

- Convert the screen point into the tabbar's window coordinate space.
- Convert from that window space into the tabbar view.
- Check whether the point is inside the tabbar bounds.
- Iterate visual tab buttons and convert into each tab button's coordinate space.
- Return the visual index and tab button.

This exists because fullscreen AppKit can route titlebar/tabbar events through an `NSToolbarFullScreenWindow`. Without this, clicks can be misinterpreted as content clicks or the wrong tab index.

For Excel tabs, the web equivalent is: hit testing should use the rendered tab strip and rendered tab order, not workbook metadata order after transforms or stale measurements.

### Ventura Titlebar Tabs

`TitlebarTabsVenturaTerminalWindow.swift` handles macOS 13-15.

Key lifecycle:

- `awakeFromNib` enables titlebar tabs.
- `titlebarTabs = true` hides the native title and generates a toolbar.
- `addTitlebarAccessoryViewController` intercepts AppKit when the native tabbar accessory is added.
- If the child is the tabbar:
  - set `layoutAttribute = .right`;
  - hide `titleVisibility`;
  - tag the child with `_ghosttyTabBar`;
  - call `pushTabsToTitlebar(...)`.
- `removeTitlebarAccessoryViewController` resets custom views when the tagged tabbar is removed.

`pushTabsToTitlebar(...)` is the core placement function:

- Ensure a toolbar exists.
- Hide the toolbar title because it conflicts with titlebar tabs.
- Wait one main-loop tick via `DispatchQueue.main.async`.
- Resolve:
  - accessory view,
  - accessory clip view,
  - titlebar view,
  - toolbar view.
- Add a window-buttons backdrop.
- Add a window drag handle.
- Constrain the accessory clip view:
  - left equals the window-buttons backdrop right edge;
  - right equals toolbar right;
  - top equals toolbar top;
  - height equals toolbar height.
- Constrain the accessory view to the clip view:
  - left, right, top, height all match.
- Mark clip and accessory views as needing layout.
- Hide toolbar overflow button.
- Hide titlebar separators.

The main-loop tick is not aesthetic. The comment says restored windows with tabs can otherwise start with tabbars that do not show all tabs. Ghostty deliberately waits for AppKit to finish its own layout.

### Tahoe Titlebar Tabs

`TitlebarTabsTahoeTerminalWindow.swift` handles macOS 26+.

Tahoe's implementation is more defensive:

- `awakeFromNib` hides the title and creates a toolbar.
- `becomeMain` calls `setupTabBar()`.
- `addTitlebarAccessoryViewController` detects the tabbar, clears the observer, sets `layoutAttribute = .right` before adding, then schedules `setupTabBar()` on the next main-loop tick.
- `removeTitlebarAccessoryViewController` calls `removeTabBar()`.

The comments explain why:

- AppKit creates an accessory view controller for every window in a tab group.
- Only the main window actually has the live `NSTabBar`.
- When the main window changes, AppKit creates or moves the tabbar.
- `addTitlebarAccessoryViewController` is not enough to detect the real tabbar reliably.
- The best reliable approach is to search for and set up the tabbar whenever the window gains focus.

`setupTabBar()`:

- exits if an observer already exists, making setup idempotent;
- requires `titlebarView` and `tabBarView`;
- asynchronously marks `viewModel.hasTabBar = true`;
- finds:
  - `NSTitlebarAccessoryClipView`,
  - accessory view,
  - `NSToolbarView`,
  - `NSTabBarNewTabButton`;
- sets tabbar height to `newTabButton.frame.width` so the tabbar is not stretched;
- chooses the toolbar view as the constraint container;
- computes left padding:
  - `0` when macOS window buttons are hidden;
  - `70` when window buttons are visible;
- constrains the clip view:
  - left equals container left plus padding;
  - right equals container right;
  - top equals container top plus `2`;
  - height equals container height;
- constrains the accessory view to the clip view:
  - left, right, top, height all match;
- marks both views as needing layout;
- enables `postsFrameChangedNotifications` on the native `NSTabBar`;
- observes `NSView.frameDidChangeNotification`;
- when the frame changes:
  - clear the observer;
  - wait one main-loop tick;
  - call `setupTabBar()` again.

This is one of the clearest signals of Ghostty's quality: the native tabbar is allowed to move and resize, but Ghostty watches for it and reapplies just enough constraints to keep it integrated.

### Transparent Titlebar Resync

`TransparentTitlebarTerminalWindow.swift` is not only visual polish. It exists because macOS tab operations can recreate titlebar and tabbar views.

It stores `lastSurfaceConfig`, then re-applies appearance when:

- the window becomes main;
- tab group windows change;
- tabbar visibility changes.

Specific details:

- When going from two tabs to one tab, the tabbar can automatically disappear. Ghostty schedules a resync after 50ms because macOS replaces tab views during that transition.
- `setupTabGroupObservation()` observes `tabGroup.windows`.
- The comment says they once tried to optimize this for only 0-to-N or N-to-0 changes, but Tahoe proved that wrong. They now resync unconditionally because it is cheap.
- `setupTabBarVisibleObservation()` observes `tabGroup.isTabBarVisible`.
- On macOS 13-15, Ghostty hides `NSVisualEffectView` to let the titlebar background color show through.
- On Tahoe, Ghostty hides `NSTitlebarBackgroundView`.

For Excel tabs, this maps to: do not assume tab strip measurements are stable after sheet count, active sheet, container resize, zoom, or theme changes. Re-measure the strip and active tab after relevant layout changes.

### Visual Treatment On macOS

Ghostty's subtle visual work is mostly about removing conflicts with native UI rather than adding decoration.

Ventura details:

- `hideTitleBarSeparators()` hides `NSTitlebarSeparatorView` descendants to remove an unwanted shadow/separator.
- `hideToolbarOverflowButton()` hides `NSToolbarClippedItemsIndicatorViewer`, which can appear in macOS 15+ and interfere with the tabbar.
- The normal toolbar title is hidden while tabs occupy the titlebar.
- `effectViewIsHidden` prevents repeatedly hiding visual effect views once handled.
- `updateNewTabButtonOpacity()` sets the native plus button image alpha:
  - `1` for key window;
  - `0.5` otherwise.
- `updateNewTabButtonImage()` adds a `VibrantLayer` overlay to the native new-tab button image rather than replacing the image.
- The comment explicitly says altering/hiding the original native image caused maintenance burden and broke opacity behavior.

Very dark backgrounds:

- `hasVeryDarkBackground` is `backgroundColor.luminance < 0.05`.
- When a tab group has a visible tabbar:
  - find the active tab background view;
  - set active tab background to `titlebarColor`;
  - set titlebar container background to a highlighted titlebar color.
- Without visible tabbar:
  - set titlebar container background to `titlebarColor`.

Window buttons backdrop:

- `WindowButtonsBackdropView` fills the area under the traffic lights.
- Its width is `78` when window buttons exist, otherwise `0`.
- It changes color based on `isHighlighted`.
- `isHighlighted` is set based on whether the selected window is index `0` in `tabbedWindows`.
- In dark mode it blends titlebar color with a system overlay color.
- In very dark backgrounds it uses special highlighted/background colors.

Window drag handle:

- `WindowDragView` is added above the titlebar area.
- It calls `window?.performDrag(with:)` on a single left mouse down.
- It sets open/closed hand cursors.
- Double-clicks bypass the drag handle.
- This is for moving the window, not for scrolling tabs.

For Excel tabs, the important negative lessons are:

- Do not add a fake gradient edge fade just because overflow exists.
- Do not add separate scroll buttons.
- Do not add a grab cursor or drag-to-pan behavior unless the native pattern actually has it.
- Do not create visual elements that compete with the tab strip. Geometry and restraint are the point.

### macOS Tab Creation And Native Plus Button

`TerminalController.newTab(...)` creates a new terminal window and adds it to the parent window's native tab group.

Subtleties:

- If the parent is miniaturized, Ghostty deminiaturizes it first because macOS behaves strangely otherwise.
- If the native plus button already caused macOS to add the window to the tab group, Ghostty removes it first so it can set the correct order.
- The comment says the known case is clicking the `+` button in the tabbar.
- New tab position can be:
  - `end`, using the last tab group window as the parent;
  - `current`, using the current parent.
- AppKit tab group state is not immediately consistent after tab creation. Ghostty schedules `relabelTabs()` after 0.1 seconds.

For Excel tabs, this maps to: after tab list changes, do not rely on synchronous measurements if layout is not settled. Schedule measurement after React/browser layout has applied.

### macOS Auto-Tabbing Guardrails

`TerminalController` explicitly undoes some AppKit automatic tabbing.

Context:

- macOS can automatically tab new windows.
- This can happen when the system user tabbing preference is `always`.
- It can also happen when the native `+` button in the tabbar is clicked.
- Ghostty wants to manage tab creation through its own core event logic, even though the UI is native.

Behavior:

- During window setup, if the new window is not fullscreen:
  - check whether the window is already in a tab group with more than one window;
  - if so, remove the window from that native tab group.
- Ghostty avoids this in fullscreen because removing the window there can move it into a separate dedicated fullscreen space.

Native plus button:

- `newWindowForTab(_:)` is the AppKit hook for the native tabbar `+` button.
- Ghostty overrides it.
- It gets the focused surface.
- It calls `ghostty.newTab(surface:)`.
- That routes the click back through Ghostty's normal new-tab logic.

This is a subtle boundary: Ghostty uses native tab UI, but it still centralizes tab creation semantics in the app.

For Excel tabs:

- UI controls that add/select/reorder sheets should route through one workbook/viewer action path.
- Do not let multiple UI affordances mutate sheet state differently.
- If a browser/native control creates an event, normalize it into the same sheet action model as keyboard/menu/API actions.

### macOS Shortcut Labels And Reordering

`TerminalController.relabelTabs()`:

- Assigns keyboard equivalents for tabs 1 through 9.
- Clears key equivalents beyond tab 9.
- Enables frame-change listening only when there is more than one tabbed window.
- Uses configured shortcuts for `goto_tab:n`.

`onFrameDidChange(...)`:

- Exists because AppKit exposes no clean tab reorder event.
- Ghostty enables frame change notifications on the accessory view.
- It compares `tabbedWindows.hashValue` to detect reorder.
- If changed, it calls `relabelTabs()`.

`fixTabBar()`:

- For transparent windows, toggles `window.isOpaque` true then false.
- This forces the tabbar to recomposite.
- Without it, transparent windows can visually drag pieces of the background when moved.

For Excel tabs, if sheet tabs become reorderable later, the active shortcut/accessibility labels should be derived from visual order after reorder, not from stale workbook order.

### macOS Native Tab Context Menu

`TerminalWindow.swift` observes native menu opening because AppKit does not expose an official API for customizing native tabbar menus.

Behavior:

- `awakeFromNib()` registers for `NSMenuWillOpenNotification`.
- The observer receives any opening `NSMenu`.
- It calls `configureTabContextMenuIfNeeded(menu)`.
- The comment explicitly calls this fragile.
- It is still used because native tabbar menus are otherwise not cleanly customizable.

This is another signal that Ghostty is not recreating native tabs to get complete control. It accepts native ownership and patches only where necessary.

For Excel tabs:

- A sheet context menu can be custom because the web owns the tabs.
- But it should still follow Ghostty's target model:
  - target the tab under the pointer;
  - do not force-select a sheet just to open its context menu unless that is the chosen product behavior;
  - keep menu actions bound to sheet identity, not array index alone.

### macOS Tabbing Mode And Restoration

`TerminalWindow.awakeFromNib()` sets AppKit tabbing behavior:

- `tabbingMode = .preferred`;
- then on the next main-loop tick, `tabbingMode = .automatic`.

The comment says this is required so window restoration recreates tabs correctly. Without it, tabs restore as separate windows.

This is an important lifecycle detail: native tab state must be allowed to restore through AppKit's own mechanisms. Ghostty nudges the mode, but does not rebuild all tabs manually on startup.

For Excel tabs:

- Persisted active sheet state should be restored through workbook/viewer state.
- The tab strip should render from that restored state and then measure.
- Avoid imperative "restore scroll position" before tabs are laid out unless it is based on stable DOM measurements.

### macOS Fullscreen Restoration

`Fullscreen.swift` has a specific titlebar accessory restoration rule:

- Removing the `titled` style dereferences titlebar accessory view controllers.
- On exit, Ghostty restores saved accessory controllers.
- But it explicitly skips restoring the tabbar accessory.
- Comment: restoring the tabbar causes many problems, so it is ignored.
- The native/AppKit tabbar will be recreated or reattached through the normal tabbar lifecycle.

This is a strong negative detail. Ghostty avoids manually restoring the native tabbar even when it has a saved reference, because doing so fights AppKit.

For Excel tabs:

- Do not preserve stale tab element references through unmount/remount.
- After major layout mode changes, let React render fresh elements and re-measure.
- Reusing stale DOM nodes or old measurements after fullscreen/sidebar/layout transitions is likely to create the same class of bugs.

### macOS Focus Behavior Around Tab Accessories

`BaseTerminalController.ghosttyDidToggleSplitZoom(...)` has a tabbar-specific focus comment:

- Clicking the reset zoom button in a tabbar of an unfocused tab should focus that window.
- Ghostty calls `window?.makeKeyAndOrderFront(nil)`.
- It then schedules focus restoration to the target surface on the next main-loop tick.

The pattern is:

- accessory interaction may steal or disturb focus;
- make the relevant window active;
- restore content focus asynchronously.

For Excel tabs:

- Clicking sheet-tab controls should not strand focus on decorative controls if the expected next interaction is the grid.
- Keyboard tab navigation should focus the selected tab for accessibility.
- Mouse selection may reasonably return focus to the grid if that is the spreadsheet interaction model.
- If toolbar/accessory controls are added to the strip, define focus restoration deliberately.

### macOS Tab Group Close Coordination

`TabGroupCloseCoordinator.swift` exists because native AppKit tab close events are ambiguous.

Problem:

- With macOS native tabs, closing a single tab and closing a whole tabbed window can both surface as close requests across windows in a tab group.
- Ghostty needs to decide whether the user's intent is:
  - close one tab;
  - close the entire window/tab group.

Coordinator model:

- `CloseScope` is either `tab` or `window`.
- Each participating controller owns or forwards to the first tab group's coordinator.
- The coordinator stores:
  - weak reference to the tab group;
  - callbacks keyed by `ObjectIdentifier(window)`;
  - a debounce timer.

Behavior:

- If the window is not in a tab group, treat it as a window close immediately.
- If this controller is not the first controller in the tab group, forward to the first controller's coordinator.
- If the tab group changes unexpectedly, assume tab close and trigger pending callbacks.
- Add the close request for the window.
- If close requests match every window in the tab group, trigger `window` scope immediately.
- Otherwise start a 100ms debounce timer.
- If the timer fires, trigger `tab` scope.
- On deinit, trigger pending callbacks as `tab`.

`TerminalController.windowShouldClose(...)` uses the coordinator:

- for `.tab`, call `closeTab(nil)`;
- for `.window`, only the first window in the tab group closes the window.
- It always returns false because Ghostty explicitly performs the close itself.

For Excel tabs:

- Browser sheet tabs do not have native AppKit ambiguity, but destructive operations still need one coordinator.
- Closing/removing current sheet, closing/removing other sheets, and closing/removing sheets to the right should not be implemented as separate ad hoc handlers.
- Confirmation should happen at the sheet/workbook action layer, not inside each button.
- If batch sheet actions are added, debounce or transaction boundaries should be explicit.

### macOS Inline Tab Title Editing

`TabTitleEditor.swift` is another example of how much Ghostty leans on the native tabbar while carefully adapting to it.

Behavior:

- A local event monitor watches left mouse down events.
- It allows events from either:
  - the host window;
  - the host window's tabbar window, for fullscreen.
- It converts the click to screen coordinates.
- It asks the host window for `tabIndex(atScreenPoint:)`.
- It maps the visual tab index to `tabbedWindows`.
- It requires the delegate to allow renaming.
- It starts editing only on double-click.
- It defers `beginEditing` to the next main-loop tick to avoid visual flicker.
- If inline editing cannot start, it invokes a fallback rename flow.

Editor setup:

- Resolve the visual tab button for the target window.
- Use `tabButtonsInVisualOrder()` to avoid trusting raw hierarchy order.
- Build an `NSTextField`.
- Copy alignment/style from the existing tab title label when possible.
- Use a single-line, scrollable, clipping text field.
- Hide until the tab button finishes layout to avoid flicker.

For Excel tabs, if inline sheet rename is added or exists elsewhere, this argues for:

- double-click only;
- reuse tab text geometry;
- single-line clipping behavior;
- no layout shift while editing;
- measure/render against the visual tab element.

## GTK: What Is Actually Happening

### Declarative Structure

`window.blp` defines the tab architecture:

- `Adw.TabOverview tab_overview`
  - connected to `tab_view`;
  - can create tabs;
  - can show overview UI.
- `Adw.ToolbarView toolbar`
  - top and bottom bar style are bound to config.
- `Adw.HeaderBar`
  - used when the native titlebar style is active.
- `Adw.TabBar tab_bar`
  - `autohide` bound to `tabs-autohide`;
  - `expand-tabs` bound to `tabs-wide`;
  - `view` bound to `tab_view`;
  - `visible` bound to `tabs-visible`.
- `Adw.TabView tab_view`
  - owns selected page;
  - owns page attachment/detachment;
  - owns close-page, setup-menu, and create-window behaviors.

This means GTK tab scrolling is libadwaita behavior. Ghostty is not mapping wheel delta or calculating scrollLeft.

### Start And End Controls

Inside `Adw.TabBar`:

- start side:
  - window controls;
  - flat new-tab split button;
- end side:
  - flat tab overview toggle;
  - flat main menu button;
  - window controls.

These controls are visible only when `titlebar-style` is `tabs`.

The new-tab split button:

- uses icon `tab-new-symbolic`;
- has tooltip `New Tab`;
- has dropdown tooltip `New Split`;
- does not focus on click.

The overview button:

- uses icon `view-grid-symbolic`;
- toggles `tab_overview.open`;
- does not focus on click.

The main-menu button:

- uses icon `open-menu-symbolic`;
- does not focus on click.

For Excel tabs, these are not sheet-tab scroll buttons. If we need workbook controls, they should not become tab overflow controls.

### GTK Config Properties

`window.zig` defines GObject properties consumed by the template:

- `tabs-autohide`
  - default true;
  - getter `getTabsAutohide`.
- `tabs-wide`
  - default true;
  - getter `getTabsWide`.
- `tabs-visible`
  - getter `getTabsVisible`.

`getTabsAutohide()`:

- If `gtk-titlebar-style` is `tabs`, returns false. The tabbar cannot autohide because it is the titlebar.
- If style is `native`, it depends on `window-show-tab-bar`:
  - `auto`: autohide true;
  - `always`: autohide false;
  - `never`: autohide true, but visibility is false anyway.

`getTabsVisible()`:

- If `gtk-titlebar-style` is `tabs`:
  - returns false only when maximized and `gtk-titlebar-hide-when-maximized` is set;
  - otherwise returns true.
- If style is `native`:
  - `window-show-tab-bar` `always` or `auto`: visible true;
  - `never`: visible false.

`getTabsWide()`:

- returns `config.gtk-wide-tabs`.

Defaults from `Config.zig`:

- `window-show-tab-bar = auto`.
- `gtk-tabs-location = top`.
- `gtk-titlebar = true`.
- `gtk-titlebar-hide-when-maximized = false`.
- `gtk-toolbar-style = raised`.
- `gtk-titlebar-style = native`.
- `gtk-wide-tabs = true`.

`gtk-wide-tabs` documentation:

- true means tabs are "wide";
- wide tabs are the newer typical GNOME style;
- tabs fill their available space;
- false means tabs only take the space they need, the older style.

This is highly relevant to Excel tabs: the Ghostty feel is wide tabs by default, not tiny content-width tabs with arbitrary arrows.

### Cross-Platform Tab Config Semantics

`Config.zig` documents several tab-facing behaviors that matter to interaction fidelity.

New tab position:

- Config key: `window-new-tab-position`.
- Default: `current`.
- Valid values:
  - `current`: insert the new tab after the currently focused tab, or at the end if there are no focused tabs;
  - `end`: insert the new tab at the end of the tab list.
- GTK implements this directly in `newTabPage(...)`.
- macOS mirrors this when adding a new window to the native tab group:
  - if `end`, use the last window in the tab group as the parent;
  - otherwise add above/current.

Tabbar visibility:

- Config key: `window-show-tab-bar`.
- GTK only.
- Default: `auto`.
- Values:
  - `always`: display tabbar even when there is only one tab;
  - `auto`: show tabbar only when there are two or more tabs;
  - `never`: hide tabbar; tabs remain accessible through overview/keybinds.

GTK tab location:

- Config key: `gtk-tabs-location`.
- Default: `top`.
- Values are top and bottom in the current implementation.
- Older `hidden` behavior was moved to `window-show-tab-bar`.

GTK titlebar style:

- Config key: `gtk-titlebar-style`.
- Default: `native`.
- `native`: normal titlebar plus separate tabbar when needed.
- `tabs`: merges tabbar and titlebar, saving vertical space.
- In `tabs` mode, tabbar visibility is forced unless hidden due to maximized/titlebar-hide config.

GTK wide tabs:

- Config key: `gtk-wide-tabs`.
- Default: `true`.
- True means GNOME-style tabs that fill available space.
- False means old-style tabs that only take the space they need.

macOS titlebar style:

- Config key: `macos-titlebar-style`.
- Default: `transparent`.
- `tabs` moves the tabbar into the titlebar.
- The docs warn that on macOS 13 and below, saved window state may not restore tabs correctly.
- Runtime changes only apply to new windows.

For Excel tabs:

- default should behave like `window-show-tab-bar = auto`: hide the strip for one sheet, show for multiple;
- adding sheets should have one explicit insertion policy;
- wide tabs should be the default;
- any alternate compact/old-style mode should be a deliberate product choice, not accidental behavior.

### GTK Tabbar Placement

When config changes, `window.zig` moves the same `Adw.TabBar` into the correct toolbar slot:

- remove `tab_bar` from the toolbar;
- if `gtk-tabs-location` is top, add it as a top bar;
- if bottom, add it as a bottom bar.

Again: same tabbar, different placement. Not two competing render paths.

### GTK Tab Selection

`window.zig` defines:

```zig
pub const SelectTab = union(enum) {
    previous,
    next,
    last,
    n: usize,
};
```

`selectTab(...)`:

- gets the selected page;
- gets current page position;
- gets total page count;
- computes target:
  - `previous`: `current - 1`, or `total - 1` if already at first;
  - `next`: `current + 1`, or `0` if already at last;
  - `last`: `total - 1`;
  - `n`: rejects `0`, casts to integer, then clamps `n - 1` to `total - 1`;
- asserts target is in range;
- if target equals current, returns false;
- otherwise gets the nth page and calls `tab_view.setSelectedPage(page)`;
- returns true.

`application.zig` routes `goto_tab` actions:

- `previous` maps to `.previous`;
- `next` maps to `.next`;
- `last` maps to `.last`;
- numeric enum values map to `.n`.

For Excel tabs, this supports:

- ArrowLeft wraps to the last sheet.
- ArrowRight wraps to the first sheet.
- End goes to the last sheet.
- Home goes to the first sheet.
- Selecting the active sheet should not call the change handler.
- If numeric shortcuts are added, out-of-range shortcuts should clamp or no-op according to the chosen model.

### GTK Tab Creation And Insertion

`window.zig` creates tabs through `newTabPage(...)`, not by mutating the tabbar directly.

Creation flow:

- `newTab(...)` calls `newTabPage(parent, .tab, .none)`.
- `newTabForWindow(...)` calls `newTabPage(parent, .window, overrides)`.
- `newTabPage(...)` receives:
  - optional parent surface;
  - new-surface context (`tab` or `window`);
  - optional command override;
  - optional working directory override;
  - optional title override.
- It creates a `GhosttyTab`.
- If a parent surface exists:
  - for a new window's first tab, it inherits the parent's initial size hints;
  - it sets the tab parent with the appropriate context.
- It reads `window-new-tab-position`.
- If the position is `current`:
  - get selected page;
  - insert the new page immediately after the current tab;
  - if there is no selected page, append at the end.
- If the position is `end`, append at the end.
- It inserts the tab widget into `Adw.TabView`.
- It selects the newly inserted page immediately.

After insertion:

- Bind the `GhosttyTab.title` property to `Adw.TabPage.title`.
- Bind the `GhosttyTab.tooltip` property to `Adw.TabPage.tooltip`.
- Connect the tab's split-tree changed signal.
- Run an initial split-tree notification to set up window state.

The key design point: the visual tabbar is a view over `Adw.TabView` pages. Ghostty changes tab pages, not tabbar DOM. The tabbar remains the same component and reacts through libadwaita.

For Excel tabs, this argues for keeping sheet selection and sheet list as the single source of truth, with the tab strip as a stable view over that list. Avoid imperative DOM insertion/reordering outside React state.

### GTK Tab Object Model

`class/tab.zig` defines `GhosttyTab` as a `gtk.Box` subclass.

Important tab properties:

- `active-surface`
  - the surface that should receive surface-targeted actions;
  - usually the focused surface, but not always.
- `config`
  - tab-level config reference.
- `split-tree`
  - the content tree inside the tab.
- `surface-tree`
  - derived from the split tree.
- `tooltip`
  - usually bound to active surface state.
- `title`
  - usually bound to active surface state.
- `title-override`
  - manual tab title override from prompt title flow.

Private state:

- config reference;
- current title;
- manual title override;
- tooltip;
- split tree template child.

Tab creation:

- `Tab.new(...)` creates a GObject instance.
- It stores or resolves config.
- It creates the initial surface inside the split tree.
- The tab's visual title is not hard-coded in the tabbar. It is exposed as a property, then bound to the `Adw.TabPage`.

Template binding:

- `tab.blp` declares `$GhosttyTab` as a vertical `Box`.
- It has the style class `tab`.
- It sets `hexpand: true` and `vexpand: true`.
- `title` is bound to `$computed_title(...)`.
- `tooltip` is bound to the active surface's present working directory.
- The split tree notifies tab state when active surface or tree changes.

Computed title precedence:

- manual tab title override;
- surface title override;
- terminal-reported title;
- configured window/title value;
- default string `Ghostty`.

Computed title prefixes:

- If bell is ringing and title bell features are enabled, prefix with a bell indicator.
- If the split tree is zoomed, prefix with a zoom indicator.
- Then append the plain resolved title.

This explains why tab labels can reflect terminal state without the tabbar itself becoming stateful. The page title is just a bound property.

Tab actions:

- `close`;
- `ring-bell`;
- `next-page`;
- `previous-page`;
- `prompt-tab-title`.

Manual title editing:

- `promptTabTitle()` opens a `TitleDialog`.
- The dialog is seeded with `title_override` if present, otherwise current `title`.
- Empty title input clears the override.
- Non-empty title input becomes the override.

For Excel tabs, a comparable model would separate:

- sheet identity;
- sheet displayed name;
- optional user override or rename state;
- active sheet index/id;
- optional sheet state markers such as dirty/error/attention;
- tab strip rendering.

The tab component should not own workbook mutation semantics. It should expose selection and possibly rename events.

### GTK Tab Reordering

`moveTab(...)` moves the tab containing a given surface by a signed amount.

Behavior:

- If there is only one tab, no-op.
- Find the `GhosttyTab` ancestor for the given surface.
- Get its `Adw.TabPage`.
- Get the current page position.
- Compute desired position with wrapping:
  - negative movement before index `0` wraps to the end;
  - positive movement after the last index wraps to the beginning;
  - otherwise move by the requested offset.
- Assert the target position is in range.
- Call `tab_view.reorderPage(page, desired_pos)`.
- Return whether ordering changed.

This is a second place where Ghostty wraps tab navigation behavior. Not only previous/next selection wraps; movement also wraps.

For Excel tabs, if sheet reordering is ever added:

- moving left from first should probably wrap to last if copying Ghostty;
- moving right from last should probably wrap to first;
- visual order should be the source for keyboard movement and measurement after reorder.

### GTK Tab Overview

Ghostty uses `Adw.TabOverview` as the overview surface.

Relevant behavior:

- `toggleTabOverview()` flips `tab_overview.open`.
- `tabOverviewCreateTab(...)` creates a new tab using the active surface as parent context.
- When the tab overview closes, Ghostty works around a libadwaita focus issue:
  - if overview is opening, do nothing;
  - if overview is closing, remove any old focus timer;
  - start a 500ms timer;
  - 500ms is chosen because the Adw animation is 400ms;
  - when the timer fires, get the currently active surface and call `grabFocus()`.

The important detail is that Ghostty restores focus after animated tab UI closes. It does not assume focus remains correct after an overview animation.

For Excel tabs, if there is ever an overflow overview or sheet picker:

- focus should return to the grid or selected sheet content after closing;
- do not rely on browser focus staying correct through animations;
- if an animation exists, restore focus after the animation completes.

### GTK Close Behavior

`Adw.TabView` is wired with:

- `close-page => $close_page()`;
- `notify::n-pages => $notify_n_pages()`;
- `page-attached => $page_attached()`;
- `page-detached => $page_detached()`;
- `create-window => $tab_create_window()`;
- `setup-menu => $setup_tab_menu()`;
- `menu-model: tab_context_menu`;
- `shortcuts: none`.

Close page behavior:

- `tabViewClosePage(...)` receives an `Adw.TabPage`.
- It casts page child to `GhosttyTab`.
- If the tab does not need quit confirmation:
  - call `closePageFinish(page, true)`;
  - return handled.
- If the tab needs confirmation:
  - show `CloseConfirmationDialog` for a tab;
  - connect close to `closePageFinish(page, true)`;
  - connect cancel to `closePageFinish(page, false)`;
  - present dialog over the tab child;
  - return handled.

Tab-level close requests:

- `tabCloseRequest(...)` gets the `Adw.TabPage` for the tab widget.
- Calls `tab_view.closePage(page)`.
- Close confirmation is then handled by the tab view close-page handler.

Tab action close modes:

- `this`: close this page.
- `other`: close other pages.
- `right`: close pages after this page.
- The tab action parses and validates the mode defensively because actions can be triggered externally.
- The actual close operation is delegated to `Adw.TabView`, so parent-level close confirmation can intercept it.

Zero pages:

- `tabViewNPages(...)` watches page count.
- If page count becomes zero:
  - if tab overview is open, do not close the window, because that is abrupt;
  - otherwise close the window.
- This fixes a case where dragging out the last tab in overview should not immediately exit Ghostty.

For Excel tabs, closing sheets may not be supported, but the lesson is still useful: destructive tab actions should be mediated by the tab container, not by individual tab buttons directly completing state mutation.

### GTK Selected Page Effects

`tabViewSelectedPage(...)` runs whenever selected page changes.

Behavior:

- Reset tab binding source to null first, in case there are no pages.
- Get selected page; if none, return.
- Assert child is a `GhosttyTab`.
- Set the binding group source to the selected tab.
- This keeps window title and active-tab-derived state synced from the active tab.
- If the page was marked as needing attention, clear `needs-attention`.

That last point matters: selection is also acknowledgement. If a tab rang a bell or requested attention, selecting it clears that state.

For Excel tabs, if sheet tabs ever gain dirty/error/attention markers:

- selecting the sheet may need to acknowledge or clear the marker;
- marker state should be bound to sheet/page state, not stored as transient styling in the tab button.

### GTK Context Menu

The `Adw.TabView` owns the context menu with `menu-model: tab_context_menu`.

`setupTabMenu(...)` stores the page the context menu is for:

- receives optional `Adw.TabPage`;
- writes it to `context_menu_page`.

The main menu includes tab actions:

- `Change Tab Title...`;
- `New Tab`;
- `Close Tab`.

The important pattern is target binding: context menu actions know which page they were opened for, rather than assuming the currently selected page is always the target.

For Excel tabs, right-click sheet menu behavior should target the sheet under the pointer, not necessarily the active sheet.

### GTK Focus After Menus

`surface.zig` handles a subtle focus issue:

- When a surface context menu closes, GTK can move focus back to the tabbar if tabs exist.
- Ghostty says that is incorrect.
- It explicitly calls `surface.grabFocus()` when the context menu closes.

This matches the tab overview focus workaround: after transient tab/menu UI closes, Ghostty restores focus to terminal content.

For Excel tabs:

- After closing a sheet context menu, focus should return to the grid or the previously active spreadsheet surface, unless the user explicitly moved focus elsewhere.
- This matters for keyboard-heavy spreadsheet workflows.

### GTK Window Creation From Tabs

`Adw.TabView` has `create-window => $tab_create_window()`.

Ghostty supports tab detaching/new-window creation through the tab view:

- create a new `GhosttyWindow`;
- present it;
- return the new window's `Adw.TabView`.

This lets libadwaita move pages between tab views while Ghostty supplies the destination container.

For Excel tabs this is probably not relevant unless sheets become detachable views, but it reinforces the larger pattern: native tab containers own tab movement semantics; app code supplies content and container boundaries.

### GTK Styling Absence

Searches through GTK Blueprint, Zig, and CSS-related files show Ghostty's tabbar behavior is not driven by a custom tabbar stylesheet.

What exists:

- `$GhosttyTab` content has a style class `tab`.
- `Adw.TabBar` is a libadwaita widget.
- wide tabs are controlled by `Adw.TabBar.expand-tabs`.
- top/bottom placement is controlled by `Adw.ToolbarView`.
- titlebar-style tabs add flat start/end controls inside the tabbar.

What does not appear:

- custom `AdwTabBar` CSS implementing scrolling;
- custom tab fade CSS;
- custom tab overflow CSS;
- custom tab width calculations in Ghostty code.

For Excel tabs, this means visual fidelity should come from layout restraint and state behavior, not an ornate stylesheet.

## Action Routing Model

Ghostty tab operations are not handled as raw tabbar button callbacks only. They are routed through app actions, surface targets, notifications, and container lookup. This keeps behavior consistent whether the user invokes a keybind, menu item, context menu, native tabbar button, or programmatic action.

### GTK Action Routing

GTK app actions live in `application.zig`.

General shape:

- Most tab actions reject app-level targets.
- They expect a surface target.
- From the surface, Ghostty finds the containing `GhosttyTab` or `GhosttyWindow`.
- Then it invokes the corresponding tab/window action.

Close tab:

- `Action.closeTab(target, value)` rejects `.app`.
- For `.surface`, it activates the GTK action `tab.close`.
- It passes the close mode as a string:
  - `this`;
  - `other`;
  - `right`.
- The tab action validates the mode defensively.
- The tab delegates close behavior to `Adw.TabView`.

Move tab:

- `Action.moveTab(target, value)` rejects `.app`.
- For `.surface`, it finds the window ancestor.
- It calls `window.moveTab(surface, amount)`.
- The window finds the tab ancestor and page, then reorders the page.

New tab:

- `Action.newTab(target)` rejects `.app`.
- For `.surface`, it finds the window ancestor.
- It calls `window.newTab(core)`.
- `window.newTab` routes into `newTabPage(...)`.

Prompt tab title:

- `Action.promptTitle(target, .tab)` rejects `.app`.
- For `.surface`, it finds the tab ancestor.
- It calls `tab.promptTabTitle()`.

Set tab title:

- `set_tab_title` rejects `.app`.
- For `.surface`, it finds the tab ancestor.
- Empty title clears the title override.
- Non-empty title sets the title override.

Goto tab:

- `Action.gotoTab(target, tab)` rejects `.app`.
- For `.surface`, it finds the window ancestor.
- It calls `window.selectTab(...)`.

The key pattern: actions start from the active surface because the terminal surface is the thing receiving keybinds. Tab/window context is resolved upward from there.

### macOS Action Routing

macOS action routing uses notifications to bridge core actions into window/controller behavior.

Goto tab:

- `Ghostty.App.gotoTab(...)` rejects app targets.
- It requires a surface target.
- It maps the core surface to a `SurfaceView`.
- If the surface's window has one tab or no tab group, it returns false.
- It posts `Notification.ghosttyGotoTab`.
- Notification user info carries `GotoTabKey`.
- `TerminalController.onGotoTab(...)` receives the notification.
- It only handles the notification if the target surface is the focused surface for that controller.
- It gets the window's tab group and tabbed windows.
- It computes final index:
  - previous wraps from first to last;
  - next wraps from last to first;
  - last maps to final tab;
  - positive numeric values are handled as explicit tab indexes.
- It selects the target window through the native tab group.

Move tab:

- `Ghostty.App.moveTab(...)` rejects app targets.
- It requires a surface target.
- It requires more than one tab in the window tab group.
- It posts `Notification.ghosttyMoveTab`.
- User info carries the move amount.
- The controller handles native tab movement separately.

Close tab:

- `Ghostty.App.closeTab(...)` rejects app targets.
- It requires a surface target.
- It maps mode to notifications:
  - close this tab;
  - close other tabs;
  - close tabs to the right.

Set tab title:

- `Ghostty.App.setTabTitle(...)` rejects app targets.
- It requires a surface target.
- Empty title clears override.
- Non-empty title becomes override.
- It finds the `BaseTerminalController` through the surface window and sets `controller.titleOverride`.

This mirrors GTK: actions originate from surface targets, then resolve to tab/window containers. The platform-specific part is only how the action is delivered.

### Action Routing Implications For Excel Tabs

Retab XLSX tab behavior should follow a similar target model:

- UI clicks can pass a stable sheet id or index into one viewer action.
- Keyboard actions should operate from the active sheet/grid context, not from arbitrary DOM focus state alone.
- Context menu actions should resolve the sheet under the menu target.
- Programmatic sheet selection should reuse the same select-sheet path.
- Add/remove/rename/reorder should all update workbook/viewer state first; the tab strip should render from that state.
- Avoid separate one-off behavior in wheel, click, keyboard, context menu, and API paths.

## Keybinding And Shortcut Semantics

Ghostty's tab feel is also shaped by keybinding semantics.

### Binding Types

`Binding.zig` defines:

- `new_tab`;
- `previous_tab`;
- `next_tab`;
- `last_tab`;
- `goto_tab: usize`;
- `move_tab: isize`;
- `toggle_tab_overview`;
- `close_tab: CloseTabMode`.

`goto_tab`:

- indices start at 1;
- if the requested tab number is higher than tab count, go to the last tab.

`move_tab`:

- positive values move forward;
- negative values move backward;
- out-of-bounds movement wraps cyclically;
- `move_tab:1` from the last tab wraps to first;
- `move_tab:-1` from the first tab wraps to last.

`close_tab`:

- supports close current;
- close other tabs;
- close tabs to the right;
- may trigger close confirmation depending on close-confirmation config.

### Default Move And Goto Bindings

Default move-tab bindings:

- Shift+Ctrl+PageUp moves current tab left.
- Shift+Ctrl+PageDown moves current tab right.
- These actions are marked performable.

Default numeric tab bindings:

- macOS uses Super/Cmd.
- Other platforms use Alt.
- Digits 1 through 8 map to `goto_tab:1` through `goto_tab:8`.
- Digit 9 maps to `last_tab`.
- Ghostty registers both physical digit keys and unicode digit keys.
- The physical-key registration helps keyboard layouts where digit keys do not produce the unicode digit directly, such as AZERTY.
- The unicode-key binding is deliberately registered last so libghostty's trigger API returns that one for action lookup.
- That ordering matters for macOS native tabbar key-equivalent labels.
- On macOS these numeric bindings are marked non-performable so native tabbar shortcuts work correctly.

For Excel tabs:

- Numeric sheet shortcuts, if added, should define whether `9` means ninth sheet or last sheet.
- Layout-sensitive keyboard behavior should consider physical vs character keys.
- Visible shortcut labels, if any, should be derived from the same binding source as actual behavior.
- Reorder shortcuts should wrap only if the product intentionally follows Ghostty.

## Overflow And Scrolling: What Ghostty Does Not Do

This is the most important section for reproducing the feel.

Ghostty does not:

- add separate scroll-left and scroll-right controls around the tabbar;
- add a second scroll state UI outside the native tabbar;
- paint its own gradient fades at the edges;
- use custom wheel event math for tabs;
- add a custom pointer-drag-to-pan behavior to the tab strip;
- center the active tab aggressively;
- use a carousel model;
- render a different compact overflow representation for many tabs;
- maintain separate tab measurement state for every interaction.

Ghostty does:

- let the native tabbar decide how overflow scrolls;
- keep the tabbar clipped to the exact titlebar/toolbar container;
- reapply constraints when the native toolkit mutates the tabbar;
- preserve a single visual surface;
- keep geometry stable;
- hide conflicting chrome;
- use native selected-tab reveal/visibility behavior through the platform tabbar.

For a web implementation, "copy Ghostty" means emulate the absence of extra UI as much as the presence of behavior.

## Geometry And Stability Rules

Ghostty's UI tests reveal what the team considers important:

- The number of close buttons must match the number of tabs.
- Tab height must stay stable while switching tabs and adding split/zoom accessories.
- Tab title vertical center must match shortcut label vertical center.
- Tab title vertical center must match close button vertical center.
- Geometry must hold:
  - in a normal window;
  - in fullscreen;
  - after moving tabs between windows;
  - after merging windows.

The tests do not assert scrollLeft values. They assert that the native tabbar remains coherent under state changes.

For Excel tabs, the matching tests should focus on:

- one tablist and one overflow scroller;
- no external sheet-scroll buttons;
- stable strip height;
- selected and unselected tab height equality;
- label vertical centering;
- active sheet reveal at the nearest edge;
- correct overflow state after resize;
- wrapped keyboard movement;
- no selection event when selecting the active sheet;
- no layout shift when sheet names are long.

## Design Translation For Excel Tabs

### Required Behaviors

- Render a single `role="tablist"` surface.
- Render each sheet as one `role="tab"` button.
- Hide the sheet tabbar when there is only one sheet, matching Ghostty's default auto tabbar behavior.
- Let tabs expand across available width while there is room.
- Use a minimum tab width once crowded.
- Clip overflow inside the tab strip.
- Make the scroll container the only horizontal overflow surface.
- Hide browser scrollbars if the design calls for a native chrome-less strip, but keep native scroll behavior.
- Wheel and trackpad horizontal movement should scroll the strip.
- Vertical wheel over the strip may map to horizontal only while the strip can actually consume the movement.
- Selecting a far-away sheet should reveal the tab by the nearest edge.
- Small reveal distances can animate smoothly.
- Large jumps should avoid long animated travel.
- Keyboard previous/next should wrap.
- Home/End should select first/last.
- Selecting the current sheet should be a no-op.
- Text should truncate inside a fixed tab width.
- The strip height should not change when tabs overflow.

### Behaviors To Avoid

- Do not add separate left/right sheet scroll buttons.
- Do not add fake "overflow affordance" gradients unless the platform/design system already uses them globally.
- Do not add a grab cursor to the tab strip.
- Do not implement pointer drag-to-scroll as a primary behavior.
- Do not center the active tab every time; that creates a non-native carousel feel.
- Do not let tabs shrink to unreadable widths.
- Do not allow dynamic tab label length to resize the strip during interactions.
- Do not render tabs in multiple rows.
- Do not move the active tab to a special pinned region.
- Do not introduce alternate overflow menus as the main path for dozens of tabs.

### Measurement Model

The web equivalent of Ghostty's native-layout trust should be:

- Measure the scroll viewport width.
- Measure total scroll width.
- Measure active tab offset and width from the rendered DOM.
- Compute only the scroll delta needed to reveal the active tab.
- Recompute after:
  - sheet count changes;
  - active sheet changes;
  - container resize;
  - zoom/layout changes;
  - font load or theme changes if they affect dimensions.
- Avoid maintaining a parallel model of tab positions when the DOM can provide the rendered truth.

### Active Reveal Model

Use nearest-edge reveal:

- Let `tabLeft = active.offsetLeft - padding`.
- Let `tabRight = active.offsetLeft + active.offsetWidth + padding`.
- Let `viewportLeft = scrollLeft`.
- Let `viewportRight = scrollLeft + clientWidth`.
- If `tabLeft < viewportLeft`, scroll to `tabLeft`.
- Else if `tabRight > viewportRight`, scroll to `tabRight - clientWidth`.
- Else do nothing.

This matches the feel of a native strip keeping the selected tab visible without theatrical recentering.

### Width Model

Ghostty GTK wide tabs imply:

- For a small number of tabs, tabs fill the available width.
- For many tabs, tabs settle at a readable compact width and overflow.
- The tabbar owns the overflow.

For Excel tabs:

- Choose a readable `min-width`.
- Choose a restrained `max-width`.
- Compute a preferred width from available viewport width divided by a target visible count.
- Clamp between min and max.
- Use that width for all tabs to keep rhythm and avoid per-label jitter.

### Accessibility Model

Ghostty relies heavily on native accessibility. The web implementation needs to supply it explicitly:

- `role="tablist"` on the strip.
- `aria-label="Workbook sheets"` or equivalent.
- `role="tab"` on each sheet tab.
- `aria-selected` on each tab.
- Roving `tabIndex`:
  - selected tab `0`;
  - inactive tabs `-1`.
- Button `title` for full sheet names when truncated.
- Keyboard handling for ArrowLeft, ArrowRight, Home, End.
- Focus the newly selected tab after keyboard movement.

## Implementation Checklist For Retab XLSX Tabs

- One clipped scroll container.
- No external arrows.
- No edge fades.
- No custom drag-pan affordance.
- Tabs are equal-width in a given layout pass.
- Tabs expand while count is small.
- Tabs compact to a readable width when count is large.
- Horizontal overflow belongs to the scroll container only.
- Active tab reveal uses nearest-edge math.
- Large active-tab jumps do not animate through the whole strip.
- Wheel handling consumes movement only when the tab strip can scroll.
- `data-can-scroll-left`, `data-can-scroll-right`, and `data-overflowing` can exist for tests/debugging but should not create visible extra UI.
- ResizeObserver tracks viewport/list changes.
- Scroll listener updates overflow state.
- The component does not call `onSelectSheet` for the already active sheet.
- Keyboard previous/next wraps.
- Tests cover dense overflow and few-tab expansion.
- Browser verification uses a workbook with dozens of sheets.

## Lifecycle Checklist For Retab XLSX Tabs

Use this checklist when evaluating whether the web tab strip has the same robustness as Ghostty's native integrations.

### Creation And Initial Layout

- Render tabs from workbook sheet state.
- Select the active sheet from viewer state.
- Measure only after the tab elements exist.
- If initial layout depends on fonts or container width, schedule a post-layout measurement.
- Do not force scroll position before the active tab has a measurable `offsetLeft` and `offsetWidth`.
- If there are many sheets, initial render should not show a transient row of tiny tabs before measurement settles.

### Selection

- Selecting a sheet updates the active sheet state.
- Selecting the already active sheet is a no-op.
- Selection should not mutate tab order.
- Selection should not change strip height.
- Selection should reveal the selected tab only if needed.
- Reveal should prefer nearest-edge visibility over centering.
- Selection should not steal focus from the grid on mouse interaction unless intentionally designed.
- Keyboard interaction should focus the newly selected tab for accessibility.

### Overflow

- Overflow remains inside the strip.
- The page itself should not horizontally scroll because sheet tabs overflow.
- No external overflow controls appear when sheet count grows.
- No visible affordance should resize the tab strip when scrollability changes.
- `canScrollLeft` and `canScrollRight` should be internal/test state, not an excuse to add extra chrome.
- Scrolling to the far right should exactly reach max scroll and clear right-scrollability state.
- Scrolling back to the far left should exactly reach zero and clear left-scrollability state.

### Resize

- Container resize recomputes tab width.
- Container resize recomputes overflow state.
- Active tab should remain visible after resize.
- Width changes should not create mixed tab widths in the same layout pass.
- If the viewport gets wider and tabs no longer overflow, scroll position should not leave hidden leading content.
- If the viewport gets narrower and tabs overflow, selected tab should remain reachable and visible.

### Sheet Count Changes

- Going from one sheet to multiple sheets shows the strip.
- Going from multiple sheets to one sheet hides the strip.
- Adding a sheet should insert it according to the chosen product rule.
- If a new sheet is selected immediately, reveal it after layout.
- Removing a sheet before the active sheet should not leave stale tab refs.
- Removing the active sheet should select a deterministic replacement.
- Removing all sheets should be handled by viewer state before the tab strip renders.

### Long Names

- Long sheet names truncate inside the tab.
- Long names do not widen one tab independently of the rest in crowded mode.
- Full name remains available through `title` or another accessible affordance.
- Truncation should be stable between selected and unselected states.

### Attention/Error Markers

If sheet-level markers are added:

- Marker state should come from sheet state.
- Selecting a sheet may clear an attention marker if that is the product rule.
- Markers should not change tab height.
- Markers should not cause label text to jump horizontally between states.
- Marker layout should be included in width calculations.

### Menus And Rename

If sheet context menus are added:

- Right-click targets the sheet under the pointer.
- Menu actions should use stable sheet identity.
- Closing the menu should restore focus to the spreadsheet surface.
- Opening the menu should not require selecting the sheet unless that is explicitly intended.

If rename is added:

- Prefer double-click or explicit menu command.
- Editing should reuse the tab label's geometry.
- Editing should not change tab height.
- Editing should use single-line clipping behavior.
- Commit/cancel should restore focus deliberately.

### Reordering

If sheet reordering is added:

- Visual order becomes the source for keyboard movement.
- Measurements should follow rendered order.
- Moving left from first and right from last should be intentionally specified; Ghostty wraps.
- Reorder should not break active tab reveal.
- Reorder should not leave stale `tabRefs`.

### Verification Workbooks

Use at least these cases:

- 2 sheets.
- 4 sheets with wide-tab non-overflow.
- 8 sheets with mild overflow.
- 80+ sheets with dense overflow.
- very long sheet names.
- mixed short and long sheet names.
- active first sheet.
- active middle sheet.
- active last sheet.
- rapid active-sheet changes.
- resize while active tab is near the right edge.

## Fidelity Notes

The closest browser analog to Ghostty is not exact platform native behavior, because web tabs are not AppKit or libadwaita widgets. The goal should be to copy the observable principles:

- native-feeling restraint;
- no extra carousel controls;
- stable geometry;
- clipped overflow;
- wide tabs by default;
- selection reveal by visibility, not centering;
- wrapped navigation;
- no duplicate state surface.

If the Excel tabs still feel unlike Ghostty, the likely causes are:

- tab widths are too narrow or vary too much;
- active reveal recenters too aggressively;
- scroll controls/fades/cursors make the strip feel custom;
- the strip height or vertical alignment changes between states;
- wheel behavior scrolls the page instead of the strip when the pointer is over overflowing tabs;
- measurement happens before layout settles, so the strip jumps after render;
- selected and unselected tabs have different border/height/padding geometry.

## Complete XLSX Tabs Blueprint

This section distills the Ghostty catalog into a concrete implementation blueprint for Retab's XLSX sheet tabs.

The target is not a generic web tab carousel. The target is the closest browser-native analog of Ghostty's native tabbar:

- one visual tabbar;
- one overflow surface;
- equal-width wide tabs;
- no extra scroll chrome;
- selected sheet kept visible;
- wrapped navigation;
- stable geometry under load.

## Product Behavior Contract

### Visibility

- If `sheets.length <= 1`, render no sheet tab strip.
- If `sheets.length > 1`, render exactly one sheet tab strip.
- The tab strip is always at the bottom of the workbook viewport unless the viewer design explicitly changes location.
- The tab strip does not reserve space for hidden arrows, hidden fades, or hidden menus.
- The tab strip height is fixed and must not change with:
  - sheet count;
  - active sheet;
  - long sheet names;
  - overflow state;
  - focus state;
  - hover state.

### Selection

- Clicking an inactive tab selects that sheet.
- Clicking the active tab is a no-op.
- Keyboard navigation selects and focuses the next logical tab.
- Programmatic `activeSheetIndex` changes reveal the active tab.
- Active reveal only scrolls when the active tab is outside the visible strip.
- Active reveal does not center a tab that is already visible.
- Active reveal does not move the tab strip when the active tab is fully visible.
- Active reveal uses rendered DOM positions, not guessed positions.

### Overflow

- Overflow is horizontal only.
- Overflow is clipped inside the tab strip.
- The workbook page must never gain horizontal overflow because of sheet tabs.
- The scroller owns `scrollLeft`.
- The tablist wrapper owns metadata such as `data-overflowing`, but not a second visible scrolling UI.
- Browser scrollbars may be visually hidden, but scroll behavior must remain native.
- No scroll arrows are rendered.
- No gradient edge fades are rendered.
- No grab cursor is rendered.
- No custom drag-to-pan interaction is rendered.

### Wheel And Trackpad

- Horizontal wheel/trackpad movement over the strip scrolls the strip horizontally.
- Vertical wheel movement over an overflowing strip may be mapped to horizontal movement, but only while the strip can consume the movement.
- If the strip cannot scroll in the requested direction, do not trap the event unnecessarily.
- Prevent default only when the strip actually moved.
- Wheel handling should not generate selection.
- Wheel handling should not focus a tab.
- Wheel handling should not snap to tab boundaries.

### Keyboard

Required:

- ArrowLeft selects previous tab.
- ArrowRight selects next tab.
- ArrowLeft from first wraps to last.
- ArrowRight from last wraps to first.
- Home selects first tab.
- End selects last tab.
- After keyboard selection, focus moves to the selected tab.
- Keyboard selection calls the same `onSelectSheet` path as click selection.
- Keyboard selection does not call `onSelectSheet` when the target equals active.

Optional future bindings:

- Numeric shortcuts can map to sheet positions.
- If copying Ghostty numeric semantics:
  - indices are 1-based;
  - out-of-range numeric targets clamp to the last sheet;
  - 9 can mean "last" rather than "ninth", if desired.

### Focus

- Mouse selection can leave focus policy to the viewer, but it must be intentional.
- Keyboard selection must keep visible focus on the selected tab.
- If sheet context menus are added, closing the menu should restore focus to the spreadsheet surface or selected tab according to the viewer policy.
- Focus ring must not resize the tab.
- Focus ring must not change strip height.
- Focus ring must not affect scroll measurements.

## Concrete Constants

These constants are the starting point for a Ghostty-like browser implementation. They should be treated as behavioral constants, not arbitrary styling.

```ts
const TAB_STRIP_HEIGHT_PX = 36
const TAB_HEIGHT_PX = 28
const TAB_REVEAL_PADDING_PX = 10
const SCROLL_EPSILON_PX = 1
const TAB_MIN_WIDTH_PX = 92
const TAB_MAX_WIDTH_PX = 184
const PREFERRED_VISIBLE_TABS = 6
const LARGE_REVEAL_DISTANCE_MULTIPLIER = 1.25
```

### Constant Rationale

`TAB_STRIP_HEIGHT_PX = 36`:

- Keeps the strip compact.
- Allows 4px vertical breathing room around 28px tabs.
- Matches the current browser-verified strip height.
- Prevents a dashboard/footer feel.

`TAB_HEIGHT_PX = 28`:

- Dense enough for a sheet tab bar.
- Tall enough for text, focus ring, and pointer target.
- Should be identical for selected and unselected tabs.

`TAB_REVEAL_PADDING_PX = 10`:

- Active tabs should not be hard-flush against the clipped edge.
- Padding should be small enough to avoid carousel-like movement.

`SCROLL_EPSILON_PX = 1`:

- Browser scroll positions can be fractional.
- Avoids false positive `canScrollLeft`/`canScrollRight` states near edges.

`TAB_MIN_WIDTH_PX = 92`:

- Keeps crowded tabs readable.
- Avoids native-tabbar collapse into unusable slivers.

`TAB_MAX_WIDTH_PX = 184`:

- Prevents few-tab layouts from becoming huge segmented controls.
- Still allows wide-tab behavior.

`PREFERRED_VISIBLE_TABS = 6`:

- Gives the dense workbook view a native-tabbar rhythm.
- Avoids showing only two or three giant tabs in common widths.

`LARGE_REVEAL_DISTANCE_MULTIPLIER = 1.25`:

- Small reveal changes may animate.
- Large jumps should not animate across dozens of sheets.
- Ghostty/native tabbars do not feel like they slowly pan through every hidden tab for far jumps.

## DOM Contract

The DOM should be small and stable.

Required structure:

```tsx
<div
  data-slot="xlsx-viewer-tabs"
  role="tablist"
  aria-label="Workbook sheets"
  data-can-scroll-left={canScrollLeft}
  data-can-scroll-right={canScrollRight}
  data-overflowing={isOverflowing}
>
  <div data-slot="xlsx-viewer-tabs-scroll">
    <div data-slot="xlsx-viewer-tabs-list">
      {sheets.map((sheet) => (
        <button
          type="button"
          role="tab"
          aria-selected={isActive}
          tabIndex={isActive ? 0 : -1}
          title={sheet.name}
          data-active={isActive}
        >
          <span>{sheet.name}</span>
        </button>
      ))}
    </div>
  </div>
</div>
```

Required DOM properties:

- One `role="tablist"`.
- One horizontal scroll element.
- One list element.
- One button per sheet.
- No scroll-arrow buttons.
- No edge-fade elements.
- No hidden duplicate tabs.
- No overflow menu as the primary representation.

Allowed test/debug attributes:

- `data-can-scroll-left`.
- `data-can-scroll-right`.
- `data-overflowing`.
- `data-active`.
- `data-slot`.

Do not use test/debug attributes to drive visible extra UI.

## CSS Contract

Root tablist:

- fixed height;
- `flex-shrink: 0`;
- `overflow: hidden`;
- top border if matching viewer chrome;
- stable background.

Scroll element:

- full height;
- `overflow-x: auto`;
- `overflow-y: hidden`;
- browser scrollbar hidden visually;
- `overscroll-behavior-x: contain`;
- horizontal padding only;
- vertical padding fixed.

List:

- `display: flex`;
- `min-width: max-content`;
- `align-items: stretch`;
- stable gap.

Tab:

- fixed height;
- `flex-shrink: 0`;
- equal width from measured calculation;
- `overflow: hidden`;
- `white-space: nowrap`;
- label truncates;
- selected and unselected states share the same box metrics;
- hover state changes color only;
- focus state does not change layout;
- border width is constant across selected/unselected states.

Forbidden CSS:

- layout-affecting selected border that changes width;
- selected font size changes;
- selected padding changes;
- dynamic font sizing based on viewport;
- negative letter spacing;
- multi-line labels;
- CSS scroll snap;
- visible native scrollbar unless the product explicitly wants it;
- gradient masks/fades for overflow.

## State Model

Required refs:

```ts
const scrollRef = React.useRef<HTMLDivElement>(null)
const listRef = React.useRef<HTMLDivElement>(null)
const tabRefs = React.useRef<(HTMLButtonElement | null)[]>([])
```

Required measured state:

```ts
interface SheetTabScrollState {
  canScrollLeft: boolean
  canScrollRight: boolean
  isOverflowing: boolean
  viewportWidth: number
}
```

Derived state:

```ts
const tabWidth = resolveTabWidth(scrollState.viewportWidth, sheets.length)
```

Do not store:

- per-tab left positions;
- per-tab widths;
- active tab visibility as independent state;
- duplicated sheet names;
- duplicated active sheet index.

Reason:

- The DOM is the source of truth for rendered geometry.
- Workbook/viewer state is the source of truth for sheets and active sheet.
- The component should only store scrollability and viewport measurement.

## Width Algorithm

```ts
function resolveTabWidth(viewportWidth: number, sheetCount: number) {
  if (viewportWidth <= 0 || sheetCount <= 0) return undefined

  const visibleTabs = Math.min(sheetCount, PREFERRED_VISIBLE_TABS)
  const availableWidth = Math.max(0, viewportWidth - 16)
  return Math.round(
    Math.min(
      TAB_MAX_WIDTH_PX,
      Math.max(TAB_MIN_WIDTH_PX, availableWidth / visibleTabs)
    )
  )
}
```

Behavior:

- No measured viewport yet: let DOM render without fixed width.
- Few tabs: expand toward available width.
- Many tabs: settle at min/readable width.
- Width is equal across all tabs.
- Width is clamped.

Known tradeoff:

- Native `Adw.TabBar` may distribute width slightly differently.
- Equal-width web tabs are preferable here because they preserve rhythm, simplify measurement, and avoid label-based jitter.

## Scroll State Algorithm

```ts
function readScrollState(scrollElement: HTMLElement) {
  const maxScrollLeft = Math.max(
    0,
    scrollElement.scrollWidth - scrollElement.clientWidth
  )

  return {
    canScrollLeft: scrollElement.scrollLeft > SCROLL_EPSILON_PX,
    canScrollRight:
      scrollElement.scrollLeft < maxScrollLeft - SCROLL_EPSILON_PX,
    isOverflowing: maxScrollLeft > SCROLL_EPSILON_PX,
    viewportWidth: scrollElement.clientWidth,
  }
}
```

Update triggers:

- initial layout effect;
- scroll event;
- `ResizeObserver` on scroll element;
- `ResizeObserver` on list element;
- sheet count change;
- active tab reveal completion frame.

State update must be equality-checked before `setState` to avoid render loops.

## Active Reveal Algorithm

```ts
function revealActiveTab(
  scrollElement: HTMLDivElement,
  activeTab: HTMLButtonElement
) {
  const tabLeft = activeTab.offsetLeft - TAB_REVEAL_PADDING_PX
  const tabRight =
    activeTab.offsetLeft + activeTab.offsetWidth + TAB_REVEAL_PADDING_PX
  const viewportLeft = scrollElement.scrollLeft
  const viewportRight = viewportLeft + scrollElement.clientWidth

  const nextLeft =
    tabLeft < viewportLeft
      ? tabLeft
      : tabRight > viewportRight
        ? tabRight - scrollElement.clientWidth
        : null

  if (nextLeft == null) return

  const distance = Math.abs(nextLeft - scrollElement.scrollLeft)
  const behavior =
    distance > scrollElement.clientWidth * LARGE_REVEAL_DISTANCE_MULTIPLIER
      ? "auto"
      : "smooth"

  scrollTabsTo(scrollElement, nextLeft, behavior)
}
```

Rules:

- Use nearest edge.
- Do nothing if visible.
- Clamp target scroll.
- Use smooth only for local corrections.
- Use auto for far jumps.
- Re-read scroll state on the next animation frame.

## Wheel Algorithm

```ts
function onTabsWheel(event: React.WheelEvent<HTMLDivElement>) {
  if (!scrollState.isOverflowing) return

  const dominantDelta =
    Math.abs(event.deltaX) > Math.abs(event.deltaY)
      ? event.deltaX
      : event.deltaY

  if (dominantDelta === 0) return
  if (!scrollTabsBy(dominantDelta)) return

  event.preventDefault()
}
```

`scrollTabsBy(delta)`:

- read current `scrollLeft`;
- compute max scroll;
- clamp target;
- if target is effectively unchanged, return false;
- set `scrollLeft`;
- update scroll state;
- return true.

This is the only intentional wheel customization. It exists because web sheet tabs sit inside a scrollable page, while Ghostty's native tabbar receives native horizontal scroll handling directly.

## Keyboard Algorithm

```ts
function nextSheetIndexForKey(
  key: string,
  sheetIndex: number,
  sheetCount: number
) {
  const lastSheetIndex = sheetCount - 1

  if (key === "ArrowLeft") {
    return sheetIndex > 0 ? sheetIndex - 1 : lastSheetIndex
  }

  if (key === "ArrowRight") {
    return sheetIndex < lastSheetIndex ? sheetIndex + 1 : 0
  }

  if (key === "Home") return 0
  if (key === "End") return lastSheetIndex
  return null
}
```

Handling:

- If key is unsupported, do nothing.
- If target is null, do nothing.
- Prevent default for supported keys.
- If target equals active, do not call selection handler.
- Otherwise call selection handler.
- Focus the target tab.

## Test Blueprint

### Unit Tests

Render basics:

- renders one tab per sheet.
- hides tablist for a one-sheet workbook.
- selected tab has `aria-selected="true"`.
- inactive tabs have `aria-selected="false"`.
- selected tab has `tabIndex=0`.
- inactive tabs have `tabIndex=-1`.
- clicking inactive tab calls `onSelectSheet(index)`.
- clicking active tab does not call `onSelectSheet`.

Overflow shape:

- with many sheets, tablist has `data-overflowing="true"`.
- no "Scroll sheets left" button exists.
- no "Scroll sheets right" button exists.
- no edge-fade elements exist.
- scroll container is the only `overflow-x-auto` element inside the tablist.

Width:

- few sheets expand above min width.
- many sheets clamp to min width.
- all tabs receive the same inline width.
- width is omitted before measurement.

Active reveal:

- active tab to the right scrolls nearest right edge into view.
- active tab to the left scrolls nearest left edge into view.
- active tab already visible does not call `scrollTo`.
- far jump uses `behavior: "auto"`.
- near correction uses `behavior: "smooth"`.
- target left is clamped to max scroll.
- target left is clamped to zero.

Wheel:

- horizontal wheel changes `scrollLeft`.
- vertical wheel maps to horizontal when overflowing.
- wheel at left edge moving left does not prevent default.
- wheel at right edge moving right does not prevent default.
- wheel when not overflowing does not prevent default.
- wheel updates `data-can-scroll-left/right`.

Keyboard:

- ArrowLeft selects previous.
- ArrowRight selects next.
- ArrowLeft from first selects last.
- ArrowRight from last selects first.
- Home selects first.
- End selects last.
- unsupported keys no-op.
- target tab receives focus.

Resize:

- ResizeObserver updates viewport width.
- after width growth that removes overflow, `data-overflowing` becomes false.
- after width shrink that creates overflow, `data-overflowing` becomes true.
- active tab remains visible after width change.

### Browser Tests

Use a real XLSX page with 80+ sheets.

Desktop checks:

- tab strip height is 36px.
- tab count matches workbook sheet count.
- visible tabs are equal width.
- approximately six tabs are visible at default docs width.
- no external scroll controls are visible.
- horizontal wheel/trackpad over strip moves `scrollLeft`.
- `data-can-scroll-left` flips true after scrolling right.
- End selects the last sheet and reveals it.
- after End, `scrollLeft === maxScrollLeft` within 1px.
- ArrowRight from last wraps to first and reveals first.
- after wrap to first, `scrollLeft === 0` within 1px.

Narrow viewport checks:

- strip does not overflow page horizontally.
- labels truncate.
- focus ring remains inside strip.
- active reveal still works.

Resize checks:

- start at desktop width with active middle tab.
- shrink viewport.
- active tab remains visible or is revealed.
- expand viewport.
- overflow state updates.
- no stale scroll offset hides leading tabs when all tabs fit.

Long-name checks:

- long sheet names truncate.
- hover/selected/focus states do not change width.
- full name is available via `title`.

## Acceptance Criteria

The XLSX tabs implementation is acceptable when all of the following are true:

- The tab strip renders as one native-like clipped surface.
- There are no external scroll arrows.
- There are no edge fades.
- There is no grab cursor.
- There is no pointer drag-to-scroll behavior.
- The active tab reveal uses nearest-edge math.
- Far active-tab jumps do not animate through dozens of tabs.
- Tabs are equal-width in a layout pass.
- Few tabs expand across the strip.
- Many tabs compact and overflow.
- Wheel/trackpad movement scrolls the strip when applicable.
- Keyboard previous/next wraps.
- Home/End work.
- Active sheet click is a no-op.
- Focus behavior is intentional and tested.
- Long names truncate without layout shift.
- Strip height is stable.
- Selected/unselected box metrics are identical.
- Overflow state is internally observable for tests.
- Unit tests cover the behavior.
- Browser verification covers a workbook with dozens of tabs.

## Non-Goals

- Do not implement a tab overview for XLSX sheets in this pass.
- Do not implement sheet close/remove in this pass unless separately requested.
- Do not implement sheet reorder in this pass unless separately requested.
- Do not implement sheet rename in this pass unless separately requested.
- Do not mirror Ghostty's terminal-specific split/zoom/bell UI.
- Do not add macOS traffic-light/titlebar behavior to the web component.
- Do not emulate private AppKit visuals literally.
- Do not add a separate mobile-only sheet picker unless required by viewer design.

## Implementation Diff Checklist

When reviewing the actual code diff, check:

- Did any new visible element appear outside the tab strip?
- Did any visible element appear solely because overflow exists?
- Did selected tab style change dimensions?
- Did hover style change dimensions?
- Did focus style change dimensions?
- Is scroll state measured from the actual scroller?
- Is active reveal based on actual active tab DOM geometry?
- Is `scrollTo` clamped?
- Is `ResizeObserver` cleaned up?
- Is scroll listener cleaned up?
- Are tab refs overwritten safely during render?
- Are stale refs harmless when sheet count shrinks?
- Does the component return `null` for one sheet?
- Does the component avoid `onSelectSheet(activeSheetIndex)`?
- Does keyboard behavior use current rendered sheet count?
- Does generated registry JSON contain the same implementation?

## Review Questions

Before calling the blueprint implemented, answer these:

- With 89 sheets, how many tabs are visible at default docs width?
- Does scroll feel like moving one native strip, or like operating a carousel?
- If you press End, does it jump cleanly to the last tab?
- If you press ArrowRight on the last tab, does it wrap cleanly to first?
- If the active tab is barely clipped, does the strip move only enough to reveal it?
- If the active tab is already visible, does the strip remain still?
- Does any UI appear/disappear when `canScrollLeft` changes?
- Does the page scroll horizontally?
- Does a tab ever change height?
- Does a tab ever change width because it became selected?
- Does the selected tab remain readable among dozens of sheets?
