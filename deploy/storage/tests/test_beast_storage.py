import fcntl
import importlib.util
from importlib.machinery import SourceFileLoader
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import tempfile
import time
import unittest
from unittest import mock


MODULE = Path(__file__).parents[1] / "beast_storage.py"
SPEC = importlib.util.spec_from_file_location("beast_storage", MODULE)
storage = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(storage)
sys.modules["beast_storage"] = storage
RECORDER_MODULE = Path(__file__).parents[1] / "beast_record"
RECORDER_SPEC = importlib.util.spec_from_loader(
    "beast_record_test", SourceFileLoader("beast_record_test", str(RECORDER_MODULE)))
recorder = importlib.util.module_from_spec(RECORDER_SPEC)
RECORDER_SPEC.loader.exec_module(recorder)


class StorageTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name) / "data"
        self.state = Path(self.temp.name) / "state"
        for category in ("blackbox", "missions"):
            (self.root / "recordings" / category).mkdir(parents=True)
        self.config = storage.Config(data_root=self.root, state_dir=self.state, blackbox_max_gib=1,
                                     missions_max_gib=1, min_free_gib=3, target_free_gib=4)

    def tearDown(self):
        self.temp.cleanup()

    def recording(self, category, name, size=100, keep=False):
        path = self.root / "recordings" / category / name
        path.mkdir()
        with (path / "bag.db3").open("wb") as handle:
            handle.truncate(size)
        if keep:
            (path / ".keep").touch()
        return path

    def test_rejects_unknown_and_invalid_environment_values(self):
        env = Path(self.temp.name) / "storage.env"
        env.write_text("BLACKBOX_MAX_GIB=0\nSURPRISE=1\n", encoding="utf8")
        with self.assertRaises(storage.ConfigError):
            storage.parse_env_file(env, self.root, self.state)

    def test_prepares_directories_idempotently_with_expected_modes(self):
        storage.prepare(self.config)
        storage.prepare(self.config)
        self.assertTrue((self.root / "models").is_dir())
        self.assertEqual((self.root / "recordings").stat().st_mode & 0o777, 0o750)

    def test_prunes_oldest_closed_session_before_newer_session(self):
        old = self.recording("blackbox", "2026-01-01T00-00-00", 700 * 1024 ** 2)
        new = self.recording("blackbox", "2026-01-02T00-00-00", 700 * 1024 ** 2)
        os.utime(old, (10, 10)); os.utime(new, (20, 20))
        result = storage.maintain(self.config, free_bytes=10 * storage.GIB, dry_run=False)
        self.assertIn(str(old), result["deleted"])
        self.assertFalse(old.exists())
        self.assertTrue(new.exists())

    def test_keep_file_and_advisory_lock_protect_recordings(self):
        kept = self.recording("blackbox", "kept", 2 * storage.GIB, keep=True)
        active = self.recording("blackbox", "active", 2 * storage.GIB)
        lock = storage.active_lock_path(active).open("w")
        fcntl.flock(lock.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        try:
            result = storage.maintain(self.config, free_bytes=10 * storage.GIB, dry_run=False)
        finally:
            lock.close()
        self.assertEqual(result["deleted"], [])
        self.assertTrue(kept.exists())
        self.assertTrue(active.exists())

    def test_free_space_hysteresis_prunes_blackbox_before_missions(self):
        self.config = storage.Config(data_root=self.root, state_dir=self.state, blackbox_max_gib=3,
                                     missions_max_gib=3, min_free_gib=3, target_free_gib=4)
        blackbox = self.recording("blackbox", "blackbox", 2 * storage.GIB + 10)
        mission = self.recording("missions", "mission", 2 * storage.GIB + 10)
        result = storage.maintain(self.config, free_bytes=2 * storage.GIB, dry_run=False)
        self.assertEqual(result["deleted"][0], str(blackbox))
        self.assertTrue(mission.exists())
        self.assertGreaterEqual(result["free_after_bytes"], 4 * storage.GIB)

    def test_rejects_traversal_and_never_counts_symlink_recordings(self):
        outside = Path(self.temp.name) / "outside"
        outside.mkdir(); (outside / "bag.db3").write_bytes(b"x" * 100)
        link = self.root / "recordings" / "blackbox" / "link"
        link.symlink_to(outside, target_is_directory=True)
        with self.assertRaises(storage.PathSafetyError):
            storage.safe_recording_path(self.root, "blackbox", "../outside")
        self.assertEqual(storage.category_entries(self.root, "blackbox"), [])

    def test_rejects_a_symlinked_recording_category_root(self):
        category_root = self.root / "recordings" / "blackbox"
        category_root.rmdir()
        outside = Path(self.temp.name) / "outside"
        outside.mkdir()
        category_root.symlink_to(outside, target_is_directory=True)

        with self.assertRaises(storage.PathSafetyError):
            storage.category_entries(self.root, "blackbox")

    def test_rejects_a_symlinked_data_root(self):
        root_link = Path(self.temp.name) / "data-link"
        root_link.symlink_to(self.root, target_is_directory=True)

        with self.assertRaises(storage.PathSafetyError):
            storage.safe_recording_path(root_link, "blackbox", "session")

    def test_rejects_a_symlinked_data_root_ancestor(self):
        parent_link = Path(self.temp.name) / "parent-link"
        parent_link.symlink_to(Path(self.temp.name), target_is_directory=True)

        with self.assertRaises(storage.PathSafetyError):
            storage.safe_recording_path(parent_link / "data", "blackbox", "session")

    def test_prepare_rejects_a_symlinked_storage_directory_without_chmodding_its_target(self):
        category_root = self.root / "recordings" / "blackbox"
        category_root.rmdir()
        outside = Path(self.temp.name) / "outside"
        outside.mkdir(mode=0o700)
        category_root.symlink_to(outside, target_is_directory=True)

        with self.assertRaises(storage.PathSafetyError):
            storage.prepare(self.config)

        self.assertEqual(outside.stat().st_mode & 0o777, 0o700)

    def test_sanitizes_mission_labels(self):
        self.assertEqual(storage.sanitize_label("  Loading Dock / #2!  "), "loading-dock-2")
        self.assertEqual(storage.sanitize_label("***"), "mission")

    def test_atomic_status_replacement_leaves_valid_json(self):
        storage.write_status_atomic(self.config, {"schema_version": 1, "ok": True})
        self.assertEqual(json.loads((self.state / "status-v1.json").read_text())["ok"], True)
        self.assertFalse(list(self.state.glob("*.tmp")))

    def test_status_reuses_a_maintenance_result_that_was_already_computed(self):
        maintenance = {"dry_run": False, "deleted": [], "deleted_bytes": 0,
                       "free_after_bytes": 10 * storage.GIB, "category_sizes": {},
                       "recording_allowed": True}
        with mock.patch.object(storage, "maintain") as maintain, \
                mock.patch.object(storage, "read_smart", return_value=None):
            result = storage.status(self.config, maintenance=maintenance)

        maintain.assert_not_called()
        self.assertIs(result["last_maintenance"], maintenance)

    def test_status_prepares_storage_before_using_a_supplied_maintenance_result(self):
        maintenance = {"dry_run": False, "deleted": [], "deleted_bytes": 0,
                       "free_after_bytes": 10 * storage.GIB, "category_sizes": {},
                       "recording_allowed": True}
        with mock.patch.object(storage, "prepare") as prepare, \
                mock.patch.object(storage, "read_smart", return_value=None):
            storage.status(self.config, maintenance=maintenance)

        prepare.assert_called_once_with(self.config)

    def test_unreadable_active_lock_fails_closed(self):
        active = self.recording("blackbox", "active")
        storage.active_lock_path(active).mkdir()

        self.assertTrue(storage.lock_is_active(active))

    def test_open_lock_rejects_symlink_target(self):
        target = Path(self.temp.name) / "target"
        target.touch()
        lock_path = Path(self.temp.name) / "lock"
        lock_path.symlink_to(target)

        with self.assertRaises(OSError):
            recorder.open_lock(lock_path)

    def test_release_lock_ignores_unlink_errors(self):
        lock_path = Path(self.temp.name) / "lock"
        lock_path.mkdir()

        recorder.release_lock(lock_path)

        self.assertTrue(lock_path.is_dir())

    def test_missing_and_malformed_smart_are_unknown(self):
        self.assertEqual(storage.smart_health(None, {} )["state"], "unknown")
        self.assertEqual(storage.smart_health("not-json", {} )["state"], "unknown")

    def test_smart_warning_and_critical_transitions(self):
        warning = json.dumps({"temperature": {"current": 65}, "percentage_used": 2,
                              "available_spare": 100, "media_errors": 0, "unsafe_shutdowns": 62,
                              "num_err_log_entries": 91, "critical_warning": 0})
        critical = json.dumps({"temperature": {"current": 70}, "percentage_used": 100,
                               "available_spare": 5, "media_errors": 1, "unsafe_shutdowns": 62,
                               "num_err_log_entries": 91, "critical_warning": 0})
        self.assertEqual(storage.smart_health(warning, {"unsafe_shutdowns": 62, "error_log_entries": 91})["state"], "warning")
        self.assertEqual(storage.smart_health(critical, {"media_errors": 0})["state"], "critical")

    def test_nvme_cli_smart_shape_is_normalized(self):
        report = json.dumps({"critical_warning": 0, "temperature": 316, "avail_spare": 100,
                             "percent_used": 1, "media_errors": 0, "unsafe_shutdowns": 62,
                             "num_err_log_entries": 91})
        health = storage.smart_health(report, {"unsafe_shutdowns": 62, "error_log_entries": 91,
                                               "media_errors": 0})
        self.assertEqual(health["state"], "healthy")
        self.assertAlmostEqual(health["temperature_c"], 42.85)

    def test_nvme_kelvin_temperature_uses_the_exact_warning_threshold(self):
        report = json.dumps({"critical_warning": 0, "temperature": 338, "avail_spare": 100,
                             "percent_used": 1, "media_errors": 0, "unsafe_shutdowns": 62,
                             "num_err_log_entries": 91})
        health = storage.smart_health(report, {"unsafe_shutdowns": 62, "error_log_entries": 91,
                                               "media_errors": 0})
        self.assertEqual(health["state"], "healthy")
        self.assertAlmostEqual(health["temperature_c"], 64.85)

    @mock.patch.object(storage.subprocess, "run")
    def test_read_smart_uses_valid_smartctl_json_even_when_smartctl_reports_health_failure(self, run):
        report = json.dumps({"temperature": {"current": 44}})
        run.return_value = subprocess.CompletedProcess(["smartctl"], 8, report, "")

        self.assertEqual(storage.read_smart(), report)

    @mock.patch.object(storage.subprocess, "run")
    def test_read_smart_falls_back_to_nvme_when_smartctl_is_unavailable(self, run):
        report = json.dumps({"temperature": 316})
        run.side_effect = [FileNotFoundError(), subprocess.CompletedProcess(["nvme"], 0, report, "")]

        self.assertEqual(storage.read_smart(), report)
        self.assertEqual(run.call_count, 2)

    def test_recorder_command_is_dependency_free_and_handles_sigint(self):
        source = (Path(__file__).parents[1] / "beast_record").read_text(encoding="utf8")
        self.assertNotIn("rclpy", source)
        self.assertNotIn("rclpy", MODULE.read_text(encoding="utf8"))
        self.assertIn("SIGINT", source)

    def test_recorder_forwards_sigint_to_rosbag(self):
        fake_bin = Path(self.temp.name) / "bin"; fake_bin.mkdir()
        fake_ros2 = fake_bin / "ros2"
        fake_ros2.write_text(
            "#!/bin/sh\n"
            "output=\n"
            "while [ \"$#\" -gt 0 ]; do\n"
            "  case \"$1\" in\n"
            "    --output) output=$2; shift 2 ;;\n"
            "    *) shift ;;\n"
            "  esac\n"
            "done\n"
            "[ -n \"$output\" ] || exit 65\n"
            "[ ! -e \"$output\" ] || exit 66\n"
            "mkdir \"$output\" || exit 67\n"
            "touch \"$output/started\"\n"
            "trap 'exit 0' INT TERM\n"
            "while :; do sleep 1; done\n", encoding="utf8")
        fake_ros2.chmod(0o755)
        env_file = Path(self.temp.name) / "storage.env"
        env_file.write_text("MIN_FREE_GIB=1\nTARGET_FREE_GIB=1\n", encoding="utf8")
        topics_dir = Path(self.temp.name) / "topics"; topics_dir.mkdir()
        (topics_dir / "blackbox.topics").write_text("/demo\n", encoding="utf8")
        storage.prepare(self.config)
        environment = os.environ | {"PATH": str(fake_bin) + os.pathsep + os.environ["PATH"]}
        recorder = Path(__file__).parents[1] / "beast_record"
        process = subprocess.Popen([sys.executable, str(recorder), "blackbox", "--env", str(env_file),
                                    "--topics-dir", str(topics_dir), "--data-root", str(self.root),
                                    "--state-dir", str(self.state)], cwd=recorder.parent, env=environment)
        try:
            started = self.root / "recordings" / "blackbox"
            deadline = time.monotonic() + 3
            while not list(started.glob("*/started")) and process.poll() is None and time.monotonic() < deadline:
                time.sleep(0.01)
            self.assertTrue(list(started.glob("*/started")), "rosbag did not create its output directory")
            self.assertEqual(len(list(started.glob(".*.active.lock"))), 1)
            process.send_signal(signal.SIGINT)
            self.assertEqual(process.wait(timeout=3), 0)
            self.assertEqual(list(started.glob(".*.active.lock")), [])
        finally:
            if process.poll() is None:
                process.kill()

    def test_installer_defaults_to_dry_run(self):
        installer = Path(__file__).parents[1] / "install.sh"
        result = subprocess.run(["bash", str(installer)], text=True, capture_output=True, check=True)
        self.assertIn("DRY-RUN", result.stdout)
        self.assertNotIn("\n0755:", result.stdout)

    def test_installer_makes_the_data_parent_traversable_and_owns_every_storage_directory(self):
        source = (Path(__file__).parents[1] / "install.sh").read_text(encoding="utf8")
        self.assertIn("install -d -o root -g root -m 0711 /data", source)
        self.assertIn(
            "install -d -o beast -g beast -m 0750 /data/beast /data/beast/recordings "
            "/data/beast/recordings/blackbox /data/beast/recordings/missions /data/beast/datasets "
            "/data/beast/maps /data/beast/models /data/beast/recovery-staging", source)
        self.assertIn("local source=$1 target=$2 file_mode=$3", source)
        result = subprocess.run(["bash", str(Path(__file__).parents[1] / "install.sh")], text=True,
                                capture_output=True, check=True)
        self.assertIn("DRY-RUN: create /data and /data/beast", result.stdout)

    def test_prepare_service_stays_active_after_initialization_and_is_sandboxed(self):
        source = (Path(__file__).parents[2] / "systemd" / "beast-storage-prepare.service").read_text(encoding="utf8")
        self.assertIn("RemainAfterExit=yes", source)
        self.assertIn("NoNewPrivileges=true", source)
        self.assertIn("PrivateTmp=true", source)


if __name__ == "__main__":
    unittest.main(verbosity=2)
