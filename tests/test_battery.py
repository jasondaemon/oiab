from __future__ import annotations

import unittest
from unittest import mock

from backend.app import battery


class BatteryConversionTests(unittest.TestCase):
    def test_swap_word(self) -> None:
        self.assertEqual(battery.swap_word(0x1234), 0x3412)

    def test_percentage_from_raw_clamps_to_100(self) -> None:
        self.assertEqual(battery.percentage_from_raw(0x00FF), 100.0)

    def test_percentage_from_raw(self) -> None:
        raw = battery.swap_word(87 * 256)
        self.assertEqual(battery.percentage_from_raw(raw), 87.0)

    def test_voltage_from_raw(self) -> None:
        swapped = int(4.08 * 1_000_000 / 78.125)
        raw = battery.swap_word(swapped)
        self.assertAlmostEqual(battery.voltage_from_raw(raw), 4.08, places=2)

    def test_missing_i2c_library_is_unavailable(self) -> None:
        with mock.patch("backend.app.battery._load_smbus", side_effect=RuntimeError("I2C Python library unavailable")):
            result = battery.read_x1206_battery_uncached()
        self.assertFalse(result["available"])
        self.assertEqual(result["source"], "x1206")
        self.assertIn("error", result)


if __name__ == "__main__":
    unittest.main()

