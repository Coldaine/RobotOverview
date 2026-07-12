import fcntl
import importlib.util
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import tempfile
import time
import unittest


MODULE = Path(__file__).parents[1] / "beast_storage.py"
SPEC = importlib.util.spec_from_file_location("beast_storage", MODULE)
storage = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(storage)


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
        kept = self.recording("blackbox", "kept", 700, keep=True)
        active = self.recording("blackbox", "active", 700)
        lock = (active / ".active.lock").open("w")
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

    def test_sanitizes_mission_labels(self):
        self.assertEqual(storage.sanitize_label("  Loading Dock / #2!  "), "loading-dock-2")
        self.assertEqual(storage.sanitize_label("***"), "mission")

    def test_atomic_status_replacement_leaves_valid_json(self):
        storage.write_status_atomic(self.config, {"schema_version": 1, "ok": True})
        self.assertEqual(json.loads((self.state / "status-v1.json").read_text())["ok"], True)
        self.assertFalse(list(self.state.glob("*.tmp")))

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

    def test_recorder_command_is_dependency_free_and_handles_sigint(self):
        source = (Path(__file__).parents[1] / "beast_record").read_text(encoding="utf8")
        self.assertNotIn("rclpy", source)
        self.assertNotIn("rclpy", MODULE.read_text(encoding="utf8"))
        self.assertIn("SIGINT", source)

    def test_recorder_forwards_sigint_to_rosbag(self):
        fake_bin = Path(self.temp.name) / "bin"; fake_bin.mkdir()
        fake_ros2 = fake_bin / "ros2"
        fake_ros2.write_text("#!/bin/sh\ntrap 'exit 0' INT TERM\nwhile :; do sleep 1; done\n", encoding="utf8")
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
            for _ in range(40):
                if list((self.root / "recordings" / "blackbox").glob("*")):
                    break
                time.sleep(0.025)
            process.send_signal(signal.SIGINT)
            self.assertEqual(process.wait(timeout=3), 0)
        finally:
            if process.poll() is None:
                process.kill()

    def test_installer_defaults_to_dry_run(self):
        installer = Path(__file__).parents[1] / "install.sh"
        result = subprocess.run(["bash", str(installer)], text=True, capture_output=True, check=True)
        self.assertIn("DRY-RUN", result.stdout)

    def test_installer_makes_the_data_parent_traversable_and_owns_every_storage_directory(self):
        source = (Path(__file__).parents[1] / "install.sh").read_text(encoding="utf8")
        self.assertIn("install -d -o root -g root -m 0711 /data", source)
        self.assertIn("/data/beast /data/beast/recordings /data/beast/recordings/blackbox", source)


if __name__ == "__main__":
    unittest.main(verbosity=2)
