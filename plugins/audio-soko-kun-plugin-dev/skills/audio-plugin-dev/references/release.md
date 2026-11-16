# Releasing with attestations

Listing conditions: `attestation`, `immutable-release`, `distribution-format`. Audio Plugin Soko-kun lists a release only if it is immutable, every release file has a build provenance attestation made by the repository's workflow for that tag, and the plugins come as zip archives without installers.

## Before the first release

- The repository is public, and immutable releases were turned on before any tag existed (see [project-setup.md](project-setup.md)).
- `.audio-soko-kun/config.json`, the logo, and the description image are committed (see [audio-soko-kun.md](audio-soko-kun.md)). The catalog reads them at the release tag, so a later change needs a new release.
- The README and `packaging/README.txt` describe this version, and the changelog has an entry for it.
- `submit_plugin` in `check` mode reports nothing you still need to fix.

## Release procedure

Each step that writes to GitHub needs the author's approval.

1. Set the version in `project(... VERSION x.y.z ...)` in `CMakeLists.txt`, merge it to `main`, and wait for CI to pass on `main`.
2. Create an annotated tag on that commit. Its message becomes the release notes:

   ```sh
   git tag -a v1.0.0 -m "My Gain 1.0.0" -m "First release. A stereo gain in VST 3 and CLAP formats for Windows x64 and Linux x86_64."
   git push origin v1.0.0
   ```

   The tag must be on the default branch. A tag on a commit outside it holds the release for an administrator (`tag-not-on-default-branch`).
3. Wait for the tag's workflow run. The `release` job checks that the tag matches the version, attests every zip, and creates a draft release with the zips.
4. Download the draft's files and verify each attestation:

   ```sh
   gh release download v1.0.0 --repo <owner>/<repo> --dir release-check
   gh attestation verify release-check/<file>.zip --repo <owner>/<repo>
   ```

   The certificate's build signer should be `.github/workflows/build.yaml` at `refs/tags/v1.0.0`.
5. Publish the draft: `gh release edit v1.0.0 --repo <owner>/<repo> --draft=false --latest`. Check with `gh release view v1.0.0 --repo <owner>/<repo> --json isImmutable` that it prints `true`.

## When the tag's run fails

A re-run or a re-pushed tag uses the workflow of the commit the tag points to. If the workflow itself was wrong, fix it on `main`, check that no release exists for the tag, delete the tag (with the author's approval; the tag ruleset lets only admins do it), and create it again on the fixed commit. Do not delete a published release: it is immutable, and the next version is the way forward.

## Notes on `gh`

- `gh release create --notes-from-tag` cannot be combined with `--repo`, and the release job has no checkout. The template reads the annotated tag's message through the API and passes it with `--notes-file`.
- Run `gh release edit` without `--jq`. One run with `--jq` failed without an error message.
