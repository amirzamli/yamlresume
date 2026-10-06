# yamlresume development tasks
#
# Run `just` with no arguments to list every recipe.

# List all available recipes
default:
    @just --list

# ---------------------------------------------------------------- run -------
# Show the CLI help screen
cli:
    pnpm --filter yamlresume dev

# Run the CLI watch-mode server on a resume file
#
#   just server resume.yml
server resume="resume.yml":
    pnpm --filter yamlresume dev dev {{ resume }} --no-pdf

# Run the playground web UI
#
#   just frontend
#
# Serves the endpoint that compiles LaTeX to PDF, so `latex` layouts get a
# rendered PDF preview toggle.
frontend:
    PATH="$HOME/.local/bin:$PATH" pnpm -C packages/playground/web dev --host 0.0.0.0

# Run the CLI server and the playground web UI together
#
#   just dev resume.yml
dev resume="resume.yml": (server resume) frontend

# ------------------------------------------------------------- setup --------
# Install dependencies
install:
    pnpm install

# Full build of every workspace package
build:
    pnpm build

# Remove build output from every package
clean-build:
    pnpm build:clean

# Rebuild from a clean state
rebuild: clean-build build

# Reinstall, then build so workspace bin links resolve
#
# Bin links point into each package's dist/, so build must run before install.
setup:
    pnpm build
    pnpm install

# Watch every package and rebuild on change
watch:
    pnpm build:watch

# ------------------------------------------------------------- resume -------
# Create a new resume file
#
#   just new resume.yml
new file="resume.yml":
    node packages/cli/dist/cli.js new {{ file }}

# Create a resume from a curated sample
#
#   just sample software-engineer
#   just sample software-engineer en my-resume.yml
#
# Language codes come from `just languages`.
sample id language="en" file="resume.yml":
    node packages/cli/dist/cli.js new {{ file }} --sample {{ id }} --language {{ language }}

# List the available curated samples
samples:
    node packages/cli/dist/cli.js samples list

# List all resume templates by engine
templates:
    node packages/cli/dist/cli.js templates list

# List supported languages
languages:
    node packages/cli/dist/cli.js languages list

# Validate a resume against the YAMLResume schema
#
#   just validate resume.yml
validate resume="resume.yml":
    node packages/cli/dist/cli.js validate {{ resume }}

# Build a resume to HTML, Docx, Markdown and TeX
#
#   just build-resume resume.yml
build-resume resume="resume.yml":
    node packages/cli/dist/cli.js build {{ resume }} --no-pdf

# Build a resume including PDF
#
# Needs a LaTeX toolchain; run `just install-tectonic` for a self-contained one.
build-pdf resume="resume.yml":
    PATH="$HOME/.local/bin:$PATH" node packages/cli/dist/cli.js build {{ resume }}

# Remove generated artifacts for a resume, source and outputs
#
#   just clean-resume
#   just clean-resume my-resume
clean-resume base="resume":
    #!/usr/bin/env bash
    for ext in yml yaml tex pdf html docx md; do rm -f "{{base}}.$ext"; done

# Check environment dependencies
doctor:
    node packages/cli/dist/cli.js doctor

# Install Tectonic, used for PDF output and the PDF preview toggle
#
# A standalone binary needing no system TeX. Exits early when present already.
install-tectonic:
    #!/usr/bin/env bash
    set -euo pipefail
    if command -v tectonic >/dev/null 2>&1; then
        echo "tectonic already installed: $(command -v tectonic)"
        exit 0
    fi
    version="0.17.0"
    tmp="$(mktemp -d)"
    trap 'rm -rf "$tmp"' EXIT
    curl -sSL -o "$tmp/tectonic.tar.gz" \
      "https://github.com/tectonic-typesetting/tectonic/releases/download/tectonic%40${version}/tectonic-${version}-x86_64-unknown-linux-gnu.tar.gz"
    mkdir -p "$HOME/.local/bin"
    tar xzf "$tmp/tectonic.tar.gz" -C "$HOME/.local/bin"
    chmod +x "$HOME/.local/bin/tectonic"
    echo "installed $HOME/.local/bin/tectonic"
    echo "make sure ~/.local/bin is on your PATH"

# ------------------------------------------------------------- test ---------
# Run the full test suite
test:
    pnpm test

# Run the fast smoke tests
test-smoke:
    pnpm test:smoke

# Run built-CLI end to end tests
test-e2e:
    pnpm test:e2e

# Run tests for one package
#
#   just test-pkg @yamlresume/core
test-pkg pkg:
    pnpm --filter {{ pkg }} test

# Run tests with coverage for one package
test-cov pkg:
    pnpm --filter {{ pkg }} test:cov

# ------------------------------------------------------------ check ---------
# Lint, format and typecheck, writing fixes
check:
    pnpm check

# Lint and typecheck without writing fixes
check-ci:
    pnpm check:ci

# Format and lint only
fmt:
    pnpm check:biome --write

# Typecheck only
tsc:
    pnpm check:tsc

# Verify every source file carries the MIT license header
license:
    pnpm license:check

# ------------------------------------------------------------- misc ---------
# Generate API docs for every package
docs:
    pnpm typedoc

# Serve a release build of the playground web UI
preview:
    pnpm -C packages/playground/web preview --host 0.0.0.0
