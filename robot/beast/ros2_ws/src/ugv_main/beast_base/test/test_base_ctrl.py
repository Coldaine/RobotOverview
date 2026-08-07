# Copyright 2026 Coldaine
# SPDX-License-Identifier: Apache-2.0

"""Behavioral tests for the beast_base serial protocol layer (base_ctrl).

ReadLine framing and BaseController command dispatch are tested against fake
serial objects — no real device, no ROS.  The wire contract comes from the
ESP32 firmware: frames are ``{...}\r\n`` JSON, T:3/T:13 write immediately, and
everything else is queued on a dedicated thread.
"""

import json

import pytest

from beast_base.base_ctrl import BaseController, ReadLine


class FakeSerial:
    """Enough of pyserial for ReadLine/BaseController: in_waiting + read."""

    def __init__(self, stream=b''):
        self.stream = bytearray(stream)
        self.written = bytearray()
        self._reset_calls = 0

    @property
    def in_waiting(self):
        return len(self.stream)

    def read(self, size):
        chunk = bytes(self.stream[:size])
        del self.stream[:size]
        return chunk

    def write(self, data):
        self.written.extend(data)

    def reset_input_buffer(self):
        self._reset_calls += 1
        self.stream.clear()


def b(*lines):
    return b''.join(
        line.encode('utf-8') if isinstance(line, str) else line
        for line in lines
    )


def make_ctrl(ser):
    """Unconstructed BaseController carrying the state the tests drive."""
    import logging
    import threading

    ctrl = BaseController.__new__(BaseController)
    ctrl.ser = ser
    ctrl.lock = threading.Lock()
    ctrl.command_dict = {}
    ctrl.log = logging.getLogger('test.BaseController')
    ctrl.read_fail_count = 0
    ctrl.read_fail_threshold = 5
    ctrl.base_data = {"T": 1001, "L": 0}
    return ctrl


# ---------------------------------------------------------------------------
# ReadLine framing
# ---------------------------------------------------------------------------
def test_readline_returns_the_latest_complete_frame_and_drops_older_ones():
    """Vendor framing uses ``rfind``: the LAST complete frame in the buffer
    wins and older buffered frames are dropped — freshest-telemetry-wins."""
    ser = FakeSerial(b('{"T":1}\r\n{"T":2}\r\n'))
    rl = ReadLine(ser)

    assert rl.readline() == b'{"T":2}\r\n'
    assert rl.readline() is None  # nothing left in the buffer


def test_readline_reassembles_frames_split_across_reads():
    ser = FakeSerial(b('{"T":1001,"odl":12'))
    rl = ReadLine(ser)
    assert rl.readline() is None  # incomplete frame, timeout

    ser.stream.extend(b('5}\r\n'))
    assert rl.readline() == b('{"T":1001,"odl":125}\r\n')


def test_readline_skips_garbage_before_frame_start():
    ser = FakeSerial(b('garbage\x00bytes{"T":1001}\r\n'))
    rl = ReadLine(ser)

    assert rl.readline() == b'{"T":1001}\r\n'


def test_readline_drops_oversized_tail_beyond_max_frame_length():
    ser = FakeSerial(b(b'x' * 600 + b'{"T":1001}\r\n'))
    rl = ReadLine(ser)

    # 600 bytes of noise exceed max_frame_length (512): read() only ever pulls
    # up to the cap, so the noise cannot accumulate without bound.
    assert rl.readline() == b'{"T":1001}\r\n'
    assert len(rl.buf) < 512


# ---------------------------------------------------------------------------
# BaseController command dispatch
# ---------------------------------------------------------------------------
def test_t3_and_t13_write_immediately_and_are_not_queued():
    ser = FakeSerial()
    ctrl = make_ctrl(ser)

    ctrl.send_command(b('{"T":3,"lineNum":1,"Text":"W:1.2.3.4"}\n'))
    ctrl.send_command(b('{"T":13,"X":0.5,"Z":0.0}\n'))

    written = [json.loads(line)
               for line in ser.written.split(b'\n') if line]
    assert [w['T'] for w in written] == [3, 13]  # JSON T:3 / T:13 write-through


def test_other_codes_are_queued_for_the_command_thread():
    ser = FakeSerial()
    ctrl = make_ctrl(ser)

    ctrl.send_command(b('{"T":133,"X":1.0}\n'))
    ctrl.send_command(b('{"T":132,"IO4":255,"IO5":0}\n'))

    assert ctrl.command_dict == {
        '133': b('{"T":133,"X":1.0}\n'),
        '132': b('{"T":132,"IO4":255,"IO5":0}\n'),
    }
    assert ser.written == b''  # nothing flushed until process_commands runs


def test_command_thread_flushes_and_clears_the_queue(monkeypatch):
    ser = FakeSerial()
    ctrl = make_ctrl(ser)
    ctrl.command_dict = {
        '133': b('{"T":133,"X":1.0}\n'),
        '132': b('{"T":132,"IO4":255,"IO5":0}\n'),
    }
    ctrl.running = True

    def one_sleep(_seconds):
        ctrl.running = False  # exit the loop after the first pass

    monkeypatch.setattr('beast_base.base_ctrl.time.sleep', one_sleep)

    ctrl.process_commands()

    written = [json.loads(line)
               for line in ser.written.split(b'\n') if line]
    assert {w['T'] for w in written} == {133, 132}
    assert ctrl.command_dict == {}


def test_feedback_data_parses_valid_json_into_base_data():
    ser = FakeSerial(b('{"T":1001,"odl":125}\r\n'))
    ctrl = make_ctrl(ser)
    ctrl.rl = ReadLine(ser)

    data = ctrl.feedback_data()

    assert data == {"T": 1001, "odl": 125}
    assert ctrl.base_data == data
    assert ctrl.read_fail_count == 0


def test_feedback_data_soft_rejects_garbage_and_counts_failures():
    ser = FakeSerial(b('this is not json\r\n'))
    ctrl = make_ctrl(ser)
    ctrl.rl = ReadLine(ser)

    assert ctrl.feedback_data() is None
    assert ctrl.read_fail_count == 1
    # base_data keeps its previous (safe) value — a garbage frame must not
    # blank the telemetry the node last published.
    assert ctrl.base_data == {"T": 1001, "L": 0}


def test_feedback_data_clears_the_buffer_after_failure_threshold():
    ser = FakeSerial()
    ctrl = make_ctrl(ser)
    ctrl.rl = ReadLine(ser)
    ctrl.rl.clear_buffer = lambda: setattr(ctrl, '_cleared', True)
    ctrl.read_fail_count = 4

    ser.stream.extend(b('still garbage\r\n'))
    ctrl.feedback_data()

    assert ctrl._cleared is True
    assert ctrl.read_fail_count == 0


def test_send_command_swallows_unparseable_input():
    ser = FakeSerial()
    ctrl = make_ctrl(ser)

    ctrl.send_command(b('not json at all'))
    assert ser.written == b''
