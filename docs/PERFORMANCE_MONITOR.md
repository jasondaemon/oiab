# Performance Monitor

The Performance Monitor reads CPU, memory, disk, temperature, network, services, and optional Raspberry Pi UPS telemetry.

## Geekworm X1206 UPS HAT

OIAB supports battery telemetry from a Geekworm X1206 UPS HAT on Raspberry Pi 5. The X1206 fuel gauge is normally exposed on I2C bus 1 at address `0x36`.

The monitor reads:

- battery percentage from register `0x04`
- single-cell battery voltage from register `0x02`
- charge/discharge status inferred from recent percentage trend

If the HAT is absent, I2C is disabled, or permissions are wrong, the monitor keeps loading and shows `UPS not detected`.

## Host Setup

Install Pi OS tooling:

```bash
sudo apt-get update
sudo apt-get install -y i2c-tools python3-smbus python3-smbus2
```

Enable I2C with Raspberry Pi configuration tooling:

```bash
sudo raspi-config
```

Then use `Interface Options` -> `I2C` -> `Enable`, or set it through your normal provisioning system. OIAB does not blindly edit `/boot` configuration.

Reboot after enabling I2C, then verify:

```bash
ls -l /dev/i2c-1
i2cdetect -y 1
i2cget -f -y 1 0x36 4 w
i2cget -f -y 1 0x36 2 w
```

The `i2cdetect` output should show a device at `36`.

## Docker Device Pass-through

The core container needs access to the I2C device. The root Compose file maps:

```text
OIAB_I2C_DEVICE_HOST -> /dev/i2c-1 inside the container
```

Defaults:

```text
OIAB_I2C_DEVICE_HOST=/dev/null
OIAB_I2C_DEVICE=/dev/i2c-1
OIAB_I2C_BUS=1
OIAB_I2C_ADDRESS=0x36
```

`scripts/deploy.sh` automatically sets `OIAB_I2C_DEVICE_HOST=/dev/i2c-1` when the device exists on the Pi. On non-Pi systems it stays `/dev/null`, and the battery card reports unavailable.

If running Compose manually on a Pi, set:

```bash
OIAB_I2C_DEVICE_HOST=/dev/i2c-1 docker compose up -d --build oiab-core
```

## Permissions

Using Docker `devices:` normally grants container access to `/dev/i2c-1`. For host-side verification commands, the user may need the `i2c` group:

```bash
sudo usermod -aG i2c "$USER"
```

Log out and back in after changing group membership.

