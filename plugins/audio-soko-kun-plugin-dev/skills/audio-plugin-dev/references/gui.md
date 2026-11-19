# Adding a GUI

A plugin without a window is fully usable: every DAW shows a generic view of the parameters. Add a window only when the plugin needs one, such as for a meter or a spectrum display. This file describes what one published plugin with a GPU-drawn window learned. The template has no GUI.

## Constraints of plugin windows

- The plugin does not own a window or an event loop. The host gives a parent window: an `HWND` on Windows and an X11 window ID on Linux (the CLAP `gui` extension). On Linux the plugin registers the file descriptor of its X11 connection with the host through the CLAP `posix-fd-support` extension, and the host's loop calls back when it is readable. A GUI library that runs its own main loop does not fit.
- Wayland has no way to embed a window from another process. Support X11 embedding on Linux, and build the GUI library without its Wayland backend, so that the plugin does not need the Wayland libraries at run time.
- The VST 3 plugin built by clap-wrapper rounds CLAP timer periods below 30 ms up to 30 ms (`src/wrapasvst3.cpp` in clap-wrapper). A GUI that redraws on the host's timer is limited to about 33 frames per second. A GUI library that runs its own redraw thread avoids this on Windows.
- CI runners have no GPU. A GPU-drawn GUI must work with a software renderer: WARP for Direct3D 11 on Windows, and Mesa's lavapipe (Vulkan) or llvmpipe (OpenGL) on Linux under Xvfb.

## Choosing a GUI library

Check before choosing: the license of the library and of everything it embeds (fonts, icons, images), an official example of embedding into a CLAP plugin on Windows and X11, whether it works with the software renderers above, and whether it builds with CMake and FetchContent.

One published plugin used Visage (MIT, https://github.com/VitalAudio/visage), a GPU UI library with an official CLAP example, Direct3D 11 on Windows and Vulkan on Linux. What it needed:

- C++20.
- `VISAGE_WAYLAND` set to `OFF`.
- On Linux, the Vulkan headers pinned by URL and hash and passed as `VISAGE_VULKAN_INCLUDE_DIR`. Otherwise Visage uses the system's headers when they exist, so the build and the license files depend on the machine.
- Visage embeds fonts into the binary: Lato (SIL OFL 1.1), Droid Sans Mono (Apache-2.0), and on Linux Twemoji Mozilla (Apache-2.0 code, CC-BY-4.0 art). Their license texts must be in the release archive, as must FreeType's FTL and the licenses of other embedded parts. These licenses do not restrict commercial use, so they do not by themselves make `restrictedAssets` true.
- Development packages on Linux: `libx11-dev libxrandr-dev libxinerama-dev libxcursor-dev libxcomposite-dev libxcb1-dev libxcb-present-dev libfontconfig1-dev`.

VSTGUI (BSD-3) draws with cairo on the CPU on Linux, which avoids GPU questions in CI, but needs many system packages and runs at the 30 ms timer period on Linux.

Check the choice with a small prototype that opens the window under pluginval in CI on both systems before writing the real GUI.

## Testing a GUI in four layers

Existing validators only open and close the window. pluginval opens the editor, opens it while processing, automates every parameter with the editor open, and opens it after releasing processing, but it does not check what is drawn or resize the window. clap-validator and the VST 3 SDK validator have no GUI tests.

| Layer | What it checks | How |
| --- | --- | --- |
| 1. Numbers | The values behind the picture: positions, levels, scaling, smoothing, and the effect of a resize on them | Keep the computation out of the drawing code and unit-test it |
| 2. Picture | The drawn picture for a fixed input | Draw without a window into an offscreen buffer, read the pixels, and compare them with a golden image |
| 3. Window | Opening, closing, opening while processing, automation with the window open | pluginval at strictness 10. On Linux under Xvfb with the software renderer |
| 4. Look and feel | The window in a real DAW, resizing, HiDPI, flicker | A checklist that the author goes through before each release |

### Making the picture test deterministic

- Advance the display state by the number of input samples, not by time. Then the same input always gives the same picture, and the test does not depend on how fast the machine is.
- Pass the same drawing function to the window and to the test, so the test checks the pixels the user sees.
- Generate the golden image on a CI runner and commit it. Different renderers differ at the edges of antialiased lines. In one plugin, a 640 × 320 image differed in 22 pixels between the Windows and Linux runners and in 323 pixels against a local GPU, by at most one level per channel. A tolerance of a few levels per channel and a small share of differing pixels absorbed this.
- Draw two deliberately broken pictures in the test (a peak at the wrong place, a missing curve) and check that they fail the comparison. This proves the tolerance is not so loose that it accepts anything.
- On Linux, select lavapipe explicitly with `VK_DRIVER_FILES` set to its manifest. Look the manifest up with `dpkg -L mesa-vulkan-drivers`, because its file name changed between Mesa versions. An empty `VK_DRIVER_FILES` hides every driver. Record the selected device with `vulkaninfo --summary`.

### CI steps with background processes

If a CI step starts Xvfb or a demo window in the background, wait only for the process you need (`wait "$pid"`), give the step a `timeout-minutes`, and stop Xvfb at the end. A bare `wait` also waits for Xvfb, which never exits, and the step hangs until the job times out.
