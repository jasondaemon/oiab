This directory vendors the `pmtiles` CLI needed by OIAB production builds.

Why it exists:
- The Pi production build path must not depend on `go install github.com/protomaps/go-pmtiles@latest`.
- That external fetch was the main reason deployments drifted into live container patching.

Current binaries:
- `linux-arm64/pmtiles`

Notes:
- The current production target is Raspberry Pi arm64.
- If another deployment target is introduced, add the matching `linux-<arch>/pmtiles` binary and the Docker build will pick it up through `TARGETARCH`.
