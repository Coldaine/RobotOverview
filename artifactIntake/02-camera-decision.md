# 02: Servo-Head Camera Decision

Status: **RULED**, pending three verification flags.
Supersedes the earlier camera-candidates doc entirely; that doc's analysis was built on premises that did not survive (see `03-rejected-paths.md`).

## Slot definition

This decision covers **the camera on the 2-DOF servo pan-tilt head only.**

| Slot | Occupant | Notes |
|---|---|---|
| Fixed chassis mount | **OAK-D Lite, already owned** | Build B perception. Carries a CAUTION verdict: passive stereo fails in dark or textureless scenes, and there is documented USB brownout on the Beast rail |
| **Servo pan-tilt head** | **This decision** | Currently the stock 5MP 160° USB camera |
| LiDAR mount | Open, see `04` | Servo-vs-rigid mounting for the LiDAR is a separate unresolved question |

## The ruling

**Arducam B0497: 8.3MP Sony STARVIS 2 IMX678 USB 3.0 camera module, $159.99.**

Verified on Arducam's product page, 2026-07-28.

| Property | Value |
|---|---|
| Sensor | Sony STARVIS 2 IMX678, 1/1.8", back-illuminated |
| Pixel size | 2 x 2 µm |
| Resolution / rate | 3840x2160 at 15fps; 1920x1080 at 60fps; 1280x720 at 90fps |
| Shutter | Rolling (acceptable, see `01`) |
| Lens | F1.65, 100° diagonal, **M12 mount**, fixed focus |
| Interface | USB 3.2 Gen 1 Type-C, **UVC, no drivers** |
| Board size | 34 x 34 mm |
| Power | 1.48W max, 0.86W min |
| Manual controls | Brightness, contrast, saturation, **white balance auto/manual**, gain, backlight comp, **exposure auto/manual** |

## Why this one

| Criterion | Fit |
|---|---|
| 4K resolution target from `01` | 8.3MP, exactly at the useful ceiling |
| Low light | STARVIS 2 back-illuminated; the strongest consumer-tier low-light sensor family |
| Fits the servo head | 34x34mm board |
| Will not brown out the rail | 1.48W max, the documented failure mode on this chassis |
| Locked exposure and white balance | Manual UVC controls present, which `01` requires |
| No driver work on the Jetson | UVC compliant |
| Lens flexibility | M12 mount, lenses swappable |

The Jetson Orin Nano Super carrier has 4x USB 3.2 Gen 2 Type-A ports, so the host is not a constraint. Verify actual negotiation with `lsusb -t`; there are field reports of these kits enumerating at USB 2.0 speeds due to cable or hub quality.

## Three flags before purchase

1. **Fixed focus is set for 3m to infinity.** Any indoor or crawlspace work is inside that range and will be soft. The M12 mount means a closer-focusing lens can be fitted; budget for one. Do not assume the stock lens works indoors.
2. **Integral IR-cut filter, visible light only.** No IR-illuminator option with this variant.
3. **4K runs at only 15fps.** Irrelevant for stop-and-shoot. Disqualifying for live teleop, which would run from the 1080p60 or 720p90 modes or from a separate camera.

## Alternatives considered, not chosen

| Option | Why not |
|---|---|
| Arducam IMX585 USB 3.0 + 16mm C-mount | Larger 1/1.2" sensor and better low light, but the listed bundle ships a 50° telephoto, wrong optic for scene capture |
| INNO-MAKER CAM-IMX585 MIPI CSI | 10/12/16-bit RAW output avoids the onboard ISP black box, which is genuinely attractive for reconstruction. Killed by CSI ribbon routing on a rotating mount: cables are short and rigid |
| Arducam IMX678 USB 2.0 variant | Same sensor, bandwidth-limited |
| Machine-vision cameras (LUCID Triton, FLIR Blackfly S) | Recommended by an external research pass. Correct for Architecture A, unnecessary under the ruled architecture. Also 12-24V or PoE power, C-mount lenses heavier than the camera body, several times the cost |

## Open item: servo repeatability

Not a blocker under Architecture B, but worth measuring: command a servo preset repeatedly and observe how tightly it lands. Approach each preset from the same direction to reduce hysteresis, and let it settle before shooting. Relevant if per-position calibration is ever wanted later.

**Note:** an earlier suggestion to calibrate one rigid transform per servo preset was invented on the spot and is not documented practice. It is not part of this ruling.
