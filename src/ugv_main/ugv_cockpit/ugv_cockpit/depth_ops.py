"""Pure depth-processing helpers for the cockpit nodes.

No ROS imports live here on purpose: the numeric core must be importable and
testable off-robot (CI, laptops) without rclpy. The nodes are thin wrappers.
"""
import cv2
import numpy as np


def colorize_depth(depth, encoding, min_m, max_m, quality=70):
    """Turn a raw depth image into JPEG-encoded, colormapped bytes.

    Clips to [min_m, max_m], maps through TURBO, blacks out no-measurement
    pixels so operators never read a false wall, and JPEG-encodes. Returns the
    encoded bytes, or None if encoding fails.
    """
    depth_m = np.asarray(depth).astype(np.float32)
    if encoding in ('16UC1', 'mono16'):
        depth_m = depth_m / 1000.0  # mm -> m

    valid = np.isfinite(depth_m) & (depth_m > 0.0)
    span = max(1e-3, max_m - min_m)
    clipped = np.clip(np.nan_to_num(depth_m, nan=min_m), min_m, max_m)
    norm = ((clipped - min_m) / span * 255.0).astype(np.uint8)

    colored = cv2.applyColorMap(norm, cv2.COLORMAP_TURBO)
    colored[~valid] = (0, 0, 0)

    ok, buf = cv2.imencode('.jpg', colored, [int(cv2.IMWRITE_JPEG_QUALITY), quality])
    if not ok:
        return None
    return buf.tobytes()


def compute_clearance(depth_m, top_frac, center_frac, pct):
    """Robust overhead clearance (m) from a metric depth image.

    Pure image-space measurement: crop the top band + horizontal centre, drop
    non-finite and zero (no-measurement) pixels, and take a low percentile.
    Returns 0.0 when there is not enough signal — 0 == unknown, surfaced as a
    loud absence in the cockpit, never a fake wall.
    """
    depth_m = np.asarray(depth_m, dtype=np.float32)
    if depth_m.ndim != 2 or depth_m.size == 0:
        return 0.0
    h, w = depth_m.shape[:2]
    top = depth_m[: max(1, int(h * top_frac)), :]
    cw = max(1, int(w * center_frac))
    x0 = (w - cw) // 2
    band = top[:, x0:x0 + cw]
    valid = band[np.isfinite(band) & (band > 0.0)]
    if valid.size < 10:
        return 0.0
    return float(np.percentile(valid, pct))
