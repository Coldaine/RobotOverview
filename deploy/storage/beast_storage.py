#!/usr/bin/env python3
"""Dependency-free storage guardrails for BEAST-01."""
import argparse
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
import fcntl
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
from typing import Dict, Iterable, List, Optional

GIB = 1024 ** 3
DEFAULTS = {
    "MIN_FREE_GIB": 300, "TARGET_FREE_GIB": 350, "BLACKBOX_SESSION_SECONDS": 900,
    "MISSION_SPLIT_SECONDS": 900, "MISSION_SPLIT_GIB": 4,
    "NVME_WARN_TEMP_C": 65, "NVME_CRITICAL_TEMP_C": 70,
    "NVME_WARN_PERCENT_USED": 80,
}
RECORDING_CATEGORIES = ("blackbox", "missions")


class ConfigError(ValueError):
    pass


class PathSafetyError(ValueError):
    pass


@dataclass(frozen=True)
class Config:
    data_root: Path = Path("/data/beast")
    state_dir: Path = Path("/var/lib/beast/storage")
    min_free_gib: int = 300
    target_free_gib: int = 350
    blackbox_session_seconds: int = 900
    mission_split_seconds: int = 900
    mission_split_gib: int = 4
    nvme_warn_temp_c: int = 65
    nvme_critical_temp_c: int = 70
    nvme_warn_percent_used: int = 80

    def __post_init__(self):
        if self.target_free_gib < self.min_free_gib:
            raise ConfigError("TARGET_FREE_GIB must be at least MIN_FREE_GIB")
        if any(not isinstance(value, int) or value <= 0 for key, value in asdict(self).items()
               if key not in ("data_root", "state_dir")):
            raise ConfigError("all numeric storage settings must be positive integers")
        if self.nvme_critical_temp_c < self.nvme_warn_temp_c:
            raise ConfigError("NVME_CRITICAL_TEMP_C must be at least NVME_WARN_TEMP_C")


def parse_env_file(path: Path, data_root: Path = Path("/data/beast"),
                   state_dir: Path = Path("/var/lib/beast/storage")) -> Config:
    values = dict(DEFAULTS)
    seen = set()
    if path.exists():
        for number, raw in enumerate(path.read_text(encoding="utf8").splitlines(), 1):
            line = raw.strip()
            if not line or line.startswith("#"):
                continue
            if "=" not in line:
                raise ConfigError("%s:%d is not KEY=VALUE" % (path, number))
            key, value = line.split("=", 1)
            if key not in DEFAULTS or not re.fullmatch(r"[1-9][0-9]*", value):
                raise ConfigError("%s:%d has unsupported or invalid value" % (path, number))
            if key in seen:
                raise ConfigError("%s:%d duplicates %s" % (path, number, key))
            seen.add(key)
            values[key] = int(value)
    return Config(data_root=Path(data_root), state_dir=Path(state_dir),
                  min_free_gib=values["MIN_FREE_GIB"],
                  target_free_gib=values["TARGET_FREE_GIB"],
                  blackbox_session_seconds=values["BLACKBOX_SESSION_SECONDS"],
                  mission_split_seconds=values["MISSION_SPLIT_SECONDS"],
                  mission_split_gib=values["MISSION_SPLIT_GIB"],
                  nvme_warn_temp_c=values["NVME_WARN_TEMP_C"],
                  nvme_critical_temp_c=values["NVME_CRITICAL_TEMP_C"],
                  nvme_warn_percent_used=values["NVME_WARN_PERCENT_USED"])


def _mkdir(path: Path, mode: int) -> None:
    path.mkdir(parents=True, exist_ok=True)
    path.chmod(mode)


def assert_managed_path_has_no_symlinks(root: Path, relative: Path) -> None:
    absolute_root = root if root.is_absolute() else Path.cwd() / root
    current = Path(absolute_root.anchor)
    for part in absolute_root.parts[1:]:
        current /= part
        if current.is_symlink():
            raise PathSafetyError("managed storage root must not contain symlinks")
    for part in relative.parts:
        current /= part
        if current.is_symlink():
            raise PathSafetyError("managed storage paths must not contain symlinks")


def prepare(config: Config, apply_ownership: bool = False) -> None:
    parts = ("recordings", "recordings/blackbox", "recordings/missions", "datasets", "maps",
             "models", "recovery-staging")
    for part in parts:
        assert_managed_path_has_no_symlinks(config.data_root, Path(part))
    assert_managed_path_has_no_symlinks(config.state_dir, Path())
    for part in parts:
        _mkdir(config.data_root / part, 0o750)
    _mkdir(config.state_dir, 0o750)
    if apply_ownership:
        shutil.chown(config.data_root, user="beast", group="beast")
        for path in config.data_root.rglob("*"):
            if not path.is_symlink():
                shutil.chown(path, user="beast", group="beast")
        shutil.chown(config.state_dir, user="root", group="beast")


def recording_root(data_root: Path, category: str) -> Path:
    if category not in RECORDING_CATEGORIES:
        raise PathSafetyError("unknown recording category")
    assert_managed_path_has_no_symlinks(data_root, Path("recordings") / category)
    root = data_root.resolve()
    recordings = root / "recordings"
    category_root = recordings / category
    if recordings.is_symlink() or category_root.is_symlink():
        raise PathSafetyError("recording category roots must not be symlinks")
    resolved = category_root.resolve(strict=False)
    try:
        resolved.relative_to(root)
    except ValueError as error:
        raise PathSafetyError("recording category escapes the data root") from error
    return category_root


def safe_recording_path(data_root: Path, category: str, name: str) -> Path:
    if not name or Path(name).name != name or name in (".", ".."):
        raise PathSafetyError("recording name must be one path component")
    root = recording_root(data_root, category)
    candidate = (root / name).resolve(strict=False)
    try:
        candidate.relative_to(root)
    except ValueError as error:
        raise PathSafetyError("recording path escapes its category") from error
    return candidate


def sanitize_label(label: str) -> str:
    cleaned = re.sub(r"[^a-z0-9]+", "-", label.lower()).strip("-")
    return (cleaned[:48].strip("-") or "mission")


def directory_size(path: Path) -> int:
    total = 0
    for base, dirs, files in os.walk(path, followlinks=False):
        dirs[:] = [name for name in dirs if not (Path(base) / name).is_symlink()]
        for name in files:
            target = Path(base) / name
            if not target.is_symlink():
                total += target.stat().st_size
    return total


def active_lock_path(path: Path) -> Path:
    return path.parent / (".%s.active.lock" % path.name)


def lock_is_active(path: Path) -> bool:
    lock_path = active_lock_path(path)
    if not lock_path.exists() or lock_path.is_symlink():
        return False
    try:
        handle = lock_path.open("a+")
    except OSError:
        return True
    try:
        try:
            fcntl.flock(handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            return True
        except OSError:
            return True
        fcntl.flock(handle.fileno(), fcntl.LOCK_UN)
        return False
    finally:
        handle.close()


def category_entries(data_root: Path, category: str) -> List[Path]:
    root = recording_root(data_root, category)
    if not root.exists():
        return []
    entries = []
    for entry in root.iterdir():
        if entry.is_symlink() or not entry.is_dir():
            continue
        try:
            safe_recording_path(data_root, category, entry.name)
        except PathSafetyError:
            continue
        entries.append(entry)
    return entries


def eligible_entries(data_root: Path, category: str) -> List[Path]:
    return sorted((entry for entry in category_entries(data_root, category)
                   if not (entry / ".keep").exists() and not lock_is_active(entry)),
                  key=lambda entry: entry.stat().st_mtime)


def filesystem_free_bytes(path: Path) -> int:
    info = os.statvfs(path)
    return info.f_bavail * info.f_frsize


def _delete(entry: Path, dry_run: bool) -> int:
    size = directory_size(entry)
    if not dry_run:
        shutil.rmtree(entry)
    return size


def maintain(config: Config, free_bytes: Optional[int] = None, dry_run: bool = True) -> Dict[str, object]:
    prepare(config)
    free = filesystem_free_bytes(config.data_root) if free_bytes is None else free_bytes
    deleted: List[str] = []
    deleted_bytes = 0
    def prune_blackbox(required: int) -> None:
        nonlocal free, deleted_bytes
        for entry in eligible_entries(config.data_root, "blackbox"):
            if free >= required:
                break
            size = _delete(entry, dry_run)
            free += size
            deleted_bytes += size
            deleted.append(str(entry))

    emergency = free < config.min_free_gib * GIB
    if emergency:
        prune_blackbox(config.target_free_gib * GIB)
    recording_allowed = free >= config.min_free_gib * GIB and (
        not emergency or free >= config.target_free_gib * GIB)
    return {"dry_run": dry_run, "deleted": deleted, "deleted_bytes": deleted_bytes,
            "free_after_bytes": free, "recording_allowed": recording_allowed}


def smart_health(raw: Optional[str], baseline: Dict[str, int], config: Optional[Config] = None) -> Dict[str, object]:
    config = config or Config()
    try:
        report = json.loads(raw) if raw else None
        if not isinstance(report, dict):
            raise ValueError
        raw_temperature = report["temperature"]
        temperature = (float(raw_temperature["current"]) if isinstance(raw_temperature, dict)
                       else float(raw_temperature) - 273.15)
        used = int(report["percentage_used"] if "percentage_used" in report else report["percent_used"])
        spare = int(report["available_spare"] if "available_spare" in report else report["avail_spare"])
        media = int(report["media_errors"])
        unsafe = int(report["unsafe_shutdowns"])
        errors = int(report["num_err_log_entries"])
        critical_warning = int(report["critical_warning"])
    except (KeyError, TypeError, ValueError, json.JSONDecodeError):
        return {"state": "unknown", "reason": "missing or malformed SMART data"}
    values = {"temperature_c": temperature, "percent_used": used, "available_spare": spare,
              "media_errors": media, "unsafe_shutdowns": unsafe, "error_log_entries": errors,
              "critical_warning": critical_warning}
    values["deltas"] = {"media_errors": media - int(baseline.get("media_errors", media)),
                        "unsafe_shutdowns": unsafe - int(baseline.get("unsafe_shutdowns", unsafe)),
                        "error_log_entries": errors - int(baseline.get("error_log_entries", errors))}
    media_increased = media > int(baseline.get("media_errors", media))
    warning = (temperature >= config.nvme_warn_temp_c or used >= config.nvme_warn_percent_used or spare <= 10 or
               unsafe > int(baseline.get("unsafe_shutdowns", unsafe)) or errors > int(baseline.get("error_log_entries", errors)))
    critical = critical_warning != 0 or temperature >= config.nvme_critical_temp_c or used >= 100 or spare <= 0 or media_increased
    values["state"] = "critical" if critical else "warning" if warning else "healthy"
    return values


def read_smart() -> Optional[str]:
    for command in (["smartctl", "-j", "/dev/nvme0"], ["nvme", "smart-log", "-o", "json", "/dev/nvme0"]):
        try:
            result = subprocess.run(command, check=False, capture_output=True, text=True, timeout=15)
        except (FileNotFoundError, subprocess.TimeoutExpired):
            continue
        if result.stdout.strip():
            try:
                if isinstance(json.loads(result.stdout), dict):
                    return result.stdout
            except json.JSONDecodeError:
                continue
    return None


def write_status_atomic(config: Config, status: Dict[str, object]) -> Path:
    prepare(config)
    destination = config.state_dir / "status-v1.json"
    fd, temporary = tempfile.mkstemp(prefix="status-v1-", suffix=".tmp", dir=config.state_dir)
    try:
        with os.fdopen(fd, "w", encoding="utf8") as handle:
            json.dump(status, handle, sort_keys=True, indent=2)
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.chmod(temporary, 0o640)
        os.replace(temporary, destination)
        try:
            shutil.chown(destination, user="root", group="beast")
        except LookupError:
            pass
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)
    return destination


def status(config: Config, dry_run: bool = True,
           maintenance: Optional[Dict[str, object]] = None) -> Dict[str, object]:
    if maintenance is None:
        maintenance = maintain(config, dry_run=dry_run)
    else:
        prepare(config)
    stats = os.statvfs(config.data_root)
    baseline = {"unsafe_shutdowns": 62, "error_log_entries": 91, "media_errors": 0}
    smart = smart_health(read_smart(), baseline, config)
    aggregate = "critical" if smart["state"] == "critical" else "warning" if smart["state"] == "warning" else smart["state"]
    return {"schema_version": 1, "generated_at": datetime.now(timezone.utc).isoformat(), "health": aggregate,
            "filesystem": {"total_bytes": stats.f_blocks * stats.f_frsize, "free_bytes": stats.f_bavail * stats.f_frsize},
            "thresholds": {key: value for key, value in asdict(config).items() if key not in ("data_root", "state_dir")},
            "categories": {category: {"count": len(category_entries(config.data_root, category))}
                           for category in RECORDING_CATEGORIES},
            "active_recorders": [str(item) for category in RECORDING_CATEGORIES for item in category_entries(config.data_root, category)
                                 if lock_is_active(item)], "smart": smart, "last_maintenance": maintenance}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--env", type=Path, default=Path("/etc/beast/storage.env"))
    parser.add_argument("--data-root", type=Path, default=Path("/data/beast"))
    parser.add_argument("--state-dir", type=Path, default=Path("/var/lib/beast/storage"))
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("prepare")
    status_parser = commands.add_parser("status"); status_parser.add_argument("--json", action="store_true")
    maintain_parser = commands.add_parser("maintain"); maintain_parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    try:
        config = parse_env_file(args.env, args.data_root, args.state_dir)
        if args.command == "prepare":
            prepare(config, apply_ownership=True); return 0
        if args.command == "maintain":
            maintenance = maintain(config, dry_run=args.dry_run)
            result = status(config, maintenance=maintenance)
            write_status_atomic(config, result)
        else:
            result = status(config, dry_run=True)
            write_status_atomic(config, result)
        print(json.dumps(result, indent=2, sort_keys=True) if getattr(args, "json", False) or args.command == "maintain" else
              "health=%s free_gib=%.1f recording_allowed=%s" % (result["health"], result["filesystem"]["free_bytes"] / GIB, result["last_maintenance"]["recording_allowed"]))
        return 0
    except (ConfigError, PathSafetyError, OSError) as error:
        parser.error(str(error))
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
