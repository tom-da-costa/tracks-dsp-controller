# probe: query a DSP from the command line

`tracks-dsp-controller probe` talks to a DSP (or to the [simulator](SIMULATOR.md)) directly,
without the web app: read its identity, its meters, its live configuration, or save the live
setup as a preset file of the official editor. It is a diagnostic tool, also used to answer
protocol questions ([captures.md](captures.md)).

```bash
tracks-dsp-controller probe --dsp 192.168.1.50 info
```

The standalone executables include it: `./tracks-dsp-controller-<version>-linux-amd64 probe …`.

## Safety

- Every action only **reads** from the DSP, except `raw`, which sends any payload you give it:
  avoid it on a DSP in use.
- The DSP accepts **one client at a time**: stop the app (or the official editor) before
  probing, or the probe gets no answer.

## Choosing the DSP

| Option | Variable | Default | What it does |
|---|---|---|---|
| `--dsp [MODEL@]HOST[:PORT][/ID]` | `TDSP_DSP` | `127.0.0.1` (the simulator) | The DSP to query, written as for the app's `--dsp`: its address, port (9761 by default), model and front-panel ID. One DSP only, and not `demo` (for a simulated DSP, run `tracks-dsp-controller sim` and give `--dsp 127.0.0.1`) |
| `--model auto\|408\|206\|204` | `TDSP_MODEL` | `auto` | `auto` detects the model from the device's identity; `MODEL@` in `--dsp` wins |
| `--device-id N` | `TDSP_DEVICE_ID` | searched for | The ID number set on the DSP's front panel (1-250); `/ID` in `--dsp` wins |
| `--timeout S` | | `0.5` | Floor of the adaptive response timeout, for a slow link |
| `--profile FILE` | `TDSP_PROFILE` | | Protocol profile (TOML) overriding the model's built-in one |
| `--log-level LEVEL` | `TDSP_LOG_LEVEL` | `info` | `debug` also shows the frames that were skipped (late or unexpected answers) |

The options go before the action: `probe --dsp 192.168.1.50 --timeout 2 meters`.

## Actions

| Action | What it does |
|---|---|
| `info` | Identity (model and firmware), handshake and status bytes, active preset and the names of the presets |
| `meters [--watch] [--interval S] [--count N]` | A meter frame: the raw values and the level in dB of each channel, and the limiter / compressor / clip flags; `--watch` repeats it every `--interval` seconds (0.5 by default), `--count` stops after N frames |
| `dump-config -o FILE` | Save the live configuration to a file (the raw config blob) |
| `export-preset -o FILE.prs` | Save the live setup as a preset file of the official editor |
| `diff-config A B` | Compare two config dumps or `.prs` files, offline (no DSP needed): one line per byte that differs (offset, old and new value, the parameter it holds); the model comes from the files |
| `raw HEX… [--no-init]` | Send a raw payload, e.g. `raw 34 04 18 01`, and print the answer. The init sequence is sent first, unless `--no-init`. **Can write to the DSP** |

## Examples

```bash
# What is there, and which preset is loaded
tracks-dsp-controller probe --dsp 192.168.1.50 info

# A DSP 206 with front-panel ID 2, on a slow link
tracks-dsp-controller probe --dsp 206@192.168.1.51/2 --timeout 2 info

# Watch the meters, 10 frames
tracks-dsp-controller probe --dsp 192.168.1.50 meters --watch --count 10

# Back up the live setup before a change, then see what the change touched
tracks-dsp-controller probe --dsp 192.168.1.50 dump-config -o before.bin
#   … change something (app or editor) …
tracks-dsp-controller probe --dsp 192.168.1.50 dump-config -o after.bin
tracks-dsp-controller probe diff-config before.bin after.bin

# The live setup as a preset file for the official editor
tracks-dsp-controller probe --dsp 192.168.1.50 export-preset -o live.prs
```
