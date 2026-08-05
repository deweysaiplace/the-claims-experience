## 2026-08-04

- **`getUserMedia` camera snapshots default to low resolution.** Without explicit `width`/`height` constraints, the browser defaults to something close to video-call quality — visibly fuzzy on a real device. Must set explicit high-res constraints, and prefer Chrome's `ImageCapture` API (`imageCapture.takePhoto()`) where available for a true full-resolution still photo instead of a video-frame snapshot.
- **Mobile Chrome's `100vh` includes the collapsible address bar.** It miscalculates as the bar collapses/expands on scroll, causing dead space or layout jumps. Always use `100dvh` for viewport-relative heights on this app (mobile-primary usage).
- **Renaming a Vercel project does NOT change its existing production `.vercel.app` URL by default.** The original auto-assigned domain persists even after `vercel project rename`. Safe to rename a project without breaking a live bookmarked URL.
