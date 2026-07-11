-- Migration 2026-07-11: reconcile BEAST-01 with the owned ACCE ROS2 kit.
--
-- The existing database describes a RoArm-M2 that is not installed and omits the
-- owned OAK-D Lite and D500 LiDAR. This migration is intentionally repeatable:
-- it upserts current hardware truth, removes only the disproven RoArm records,
-- and reconciles the affected loadout and connected-twin relationships.

BEGIN;
SET client_min_messages = warning;

DO $$
BEGIN
  IF to_regclass('public.terminals') IS NULL OR to_regclass('public.nets') IS NULL THEN
    RAISE EXCEPTION '2026-07-03-connected-twin.sql must be applied first';
  END IF;
END
$$;

-- The Orin is owned inventory now, so its old wishlist extension must be removed
-- before changing the lifecycle value protected by the composite foreign key.
DELETE FROM wishlist_meta WHERE asset_id = 'orin-nano';

-- Removing the false asset cascades through its tags, interfaces, loadout,
-- terminals, document relationships, and connected-twin relationships.
DELETE FROM assets WHERE id = 'roarm-m2';

-- Current asset truth. Preserve created_at while making the content columns
-- match the TypeScript spine used to generate a clean rebuild.
INSERT INTO assets(
  id,kind,name,manufacturer,model,callsign,status,lifecycle,provenance,flagship,
  summary,description,planning_notes,monitored_via,acquired,horizon,quantity,
  power_watts,power_volts,power_rail,mass_grams,price_us,price_import,
  specs,links,limitations,sources
) VALUES (
  'beast','system','UGV Beast',NULL,NULL,'BEAST-01','needs-attention','assembled','owner',true,
  'Waveshare UGV Beast ACCE ROS2 kit with the stock pan-tilt 5MP camera, OAK-D Lite depth camera, and D500 LiDAR. First unit of the fleet; the current upper computer is a Raspberry Pi 5 pending the owned Jetson Orin Nano cutover.',
  NULL,NULL,NULL,'2026',NULL,1,25,5,'5V',3200,NULL,NULL,
  '[{"label":"Chassis","value":"Tracked, all-terrain"},{"label":"Onboard host","value":"Raspberry Pi 5"},{"label":"Motor control","value":"ESP32 (PID)"},{"label":"Pan-tilt camera","value":"5MP · 160° · USB"},{"label":"Depth camera","value":"OAK-D Lite · USB"},{"label":"LiDAR","value":"D500 / STL-19P · 360° · 230400 baud"},{"label":"Pack","value":"3S Li-ion (~11.1V)"},{"label":"Control","value":"Remote teleop (FPV)"}]'::jsonb,
  '[{"label":"Waveshare UGV Beast","url":"https://www.waveshare.com/ugv-beast.htm"},{"label":"Waveshare UGV hardware tutorial","url":"https://www.youtube.com/watch?v=8wqPs7rNkJ4"}]'::jsonb,
  NULL,NULL
), (
  'oak-d-lite','module','Luxonis OAK-D Lite',NULL,NULL,'BEAST-RGBD','operational','assembled','owner',false,
  'OAK-D Lite depth and AI camera installed as part of the BEAST-01 ACCE ROS2 kit.',
  NULL,NULL,NULL,'included',NULL,1,NULL,NULL,NULL,NULL,NULL,NULL,
  '[{"label":"Role","value":"Stereo depth · RGB · onboard vision"},{"label":"Interface","value":"USB"},{"label":"ROS","value":"depthai_ros_driver"}]'::jsonb,
  NULL,NULL,NULL
), (
  'd500-lidar','module','Waveshare D500 LiDAR',NULL,NULL,'BEAST-LIDAR','operational','assembled','owner',false,
  'D500 360° DTOF LiDAR installed as part of the BEAST-01 ACCE ROS2 kit; the sensor core is STL-19P/LDS19.',
  NULL,NULL,NULL,'included',NULL,1,1.45,5,'5V',NULL,NULL,NULL,
  '[{"label":"Sensor","value":"STL-19P / LDS19"},{"label":"Range","value":"0.03–12 m"},{"label":"Scan","value":"360° · 10 Hz · 5000 samples/s"},{"label":"Interface","value":"UART · 230400 baud · USB bridge to host"},{"label":"ROS model","value":"LDLIDAR_MODEL=ld19"}]'::jsonb,
  NULL,NULL,NULL
), (
  'orin-nano','module','Jetson Orin Nano Super',NULL,NULL,'BEAST-JETSON','needs-attention','inventory','owner',false,
  'Owned NVIDIA Jetson Orin Nano 8GB developer kit running JetPack 6.2.2 / R36.5 from NVMe with ROS 2 Humble and the Jetson-adapted Waveshare workspace built; staged to replace BEAST-01’s Raspberry Pi 5 after physical ACCE safety validation.',
  NULL,NULL,NULL,'owned',NULL,1,25,NULL,'battery',NULL,249,NULL,
  '[{"label":"AI perf","value":"up to 67 TOPS (Super); ~1.7× prior"},{"label":"Arch","value":"Ampere GPU + 6-core Arm"},{"label":"Power","value":"7–25 W"},{"label":"Memory","value":"8 GB"},{"label":"Cameras","value":"2× MIPI CSI (4-lane)"},{"label":"Carrier","value":"Accepts Orin Nano + Orin NX"},{"label":"Stack","value":"CUDA · TensorRT · Isaac ROS"},{"label":"Lifecycle","value":"through 2032"}]'::jsonb,
  '[{"label":"NVIDIA Jetson Orin","url":"https://www.nvidia.com/en-us/autonomous-machines/embedded-systems/jetson-orin/"}]'::jsonb,
  NULL,NULL
)
ON CONFLICT (id) DO UPDATE SET
  kind = EXCLUDED.kind,
  name = EXCLUDED.name,
  manufacturer = EXCLUDED.manufacturer,
  model = EXCLUDED.model,
  callsign = EXCLUDED.callsign,
  status = EXCLUDED.status,
  lifecycle = EXCLUDED.lifecycle,
  provenance = EXCLUDED.provenance,
  flagship = EXCLUDED.flagship,
  summary = EXCLUDED.summary,
  description = EXCLUDED.description,
  planning_notes = EXCLUDED.planning_notes,
  monitored_via = EXCLUDED.monitored_via,
  acquired = EXCLUDED.acquired,
  horizon = EXCLUDED.horizon,
  quantity = EXCLUDED.quantity,
  power_watts = EXCLUDED.power_watts,
  power_volts = EXCLUDED.power_volts,
  power_rail = EXCLUDED.power_rail,
  mass_grams = EXCLUDED.mass_grams,
  price_us = EXCLUDED.price_us,
  price_import = EXCLUDED.price_import,
  specs = EXCLUDED.specs,
  links = EXCLUDED.links,
  limitations = EXCLUDED.limitations,
  sources = EXCLUDED.sources,
  updated_at = now();

INSERT INTO tags(namespace,name,label) VALUES
  ('tag','acce','acce'),
  ('tag','ros2','ros2'),
  ('tag','camera','camera'),
  ('tag','depth','depth'),
  ('tag','oak','oak'),
  ('tag','beast','beast'),
  ('tag','lidar','lidar'),
  ('tag','dtof','dtof'),
  ('tag','mapping','mapping'),
  ('class','Tracked ROS2 Rover','Tracked ROS2 Rover'),
  ('class','RGB-D Camera','RGB-D Camera'),
  ('class','2D LiDAR','2D LiDAR')
ON CONFLICT (namespace,name) DO UPDATE SET label = EXCLUDED.label;

DELETE FROM asset_tags at
USING tags t
WHERE at.asset_id = 'beast'
  AND at.tag_id = t.id
  AND (
    (t.namespace = 'tag' AND t.name = 'roarm') OR
    (t.namespace = 'class' AND t.name = 'Tracked Rover + Arm')
  );

INSERT INTO asset_tags(asset_id,tag_id)
SELECT wanted.asset_id, t.id
FROM (VALUES
  ('beast','tag','acce'),
  ('beast','tag','ros2'),
  ('beast','class','Tracked ROS2 Rover'),
  ('oak-d-lite','tag','camera'),
  ('oak-d-lite','tag','depth'),
  ('oak-d-lite','tag','oak'),
  ('oak-d-lite','tag','beast'),
  ('oak-d-lite','tag','acce'),
  ('oak-d-lite','class','RGB-D Camera'),
  ('d500-lidar','tag','lidar'),
  ('d500-lidar','tag','dtof'),
  ('d500-lidar','tag','mapping'),
  ('d500-lidar','tag','beast'),
  ('d500-lidar','tag','acce'),
  ('d500-lidar','class','2D LiDAR')
) AS wanted(asset_id,namespace,name)
JOIN tags t USING (namespace,name)
ON CONFLICT DO NOTHING;

INSERT INTO asset_groups(asset_id,group_id) VALUES
  ('oak-d-lite','robotics'),
  ('d500-lidar','robotics'),
  ('orin-nano','compute')
ON CONFLICT DO NOTHING;

UPDATE sockets SET note = 'OAK-D Lite from the ACCE ROS2 kit'
WHERE host_asset_id = 'beast' AND name = '21mm Picatinny Rail';
UPDATE sockets SET note = 'D500 360° LiDAR from the ACCE ROS2 kit'
WHERE host_asset_id = 'beast' AND name = 'Middle Deck';
UPDATE sockets SET note = 'Stock ST3215 pan-tilt uses the servo bus; no manipulator arm is installed'
WHERE host_asset_id = 'beast' AND name = 'Serial Bus Servo';
UPDATE sockets SET note = 'D500/STL-19P UART routed to the host over USB'
WHERE host_asset_id = 'beast' AND name = 'LiDAR UART Port';

INSERT INTO interface_types(id,name,kind,note) VALUES
  ('sensor-rail','Sensor Rail Mount','mechanical','Top-deck accessory rail'),
  ('sensor-deck','Sensor Deck Mount','mechanical','Middle-deck sensor plate'),
  ('lidar-uart','LiDAR UART','data','LiDAR UART routed to host USB')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  kind = EXCLUDED.kind,
  note = EXCLUDED.note;

INSERT INTO socket_accepts(socket_id,interface_type_id)
SELECT s.id, wanted.interface_type_id
FROM (VALUES
  ('21mm Picatinny Rail','sensor-rail'),
  ('Middle Deck','sensor-deck'),
  ('LiDAR UART Port','lidar-uart')
) AS wanted(socket_name,interface_type_id)
JOIN sockets s
  ON s.host_asset_id = 'beast' AND s.name = wanted.socket_name
ON CONFLICT DO NOTHING;

INSERT INTO asset_interfaces(asset_id,interface_type_id) VALUES
  ('oak-d-lite','sensor-rail'),
  ('d500-lidar','sensor-deck'),
  ('d500-lidar','lidar-uart')
ON CONFLICT DO NOTHING;

-- No manipulator occupies the servo socket. Reconcile the three ACCE payload
-- assignments even if an earlier seed or manual replay partially populated them.
DELETE FROM loadout_assignments
WHERE socket_id = (
  SELECT id FROM sockets WHERE host_asset_id = 'beast' AND name = 'Serial Bus Servo'
);

INSERT INTO loadout_assignments(socket_id,asset_id,interface_type_id)
SELECT s.id, wanted.asset_id, wanted.interface_type_id
FROM (VALUES
  ('21mm Picatinny Rail','oak-d-lite','sensor-rail'),
  ('Middle Deck','d500-lidar','sensor-deck'),
  ('LiDAR UART Port','d500-lidar','lidar-uart')
) AS wanted(socket_name,asset_id,interface_type_id)
JOIN sockets s
  ON s.host_asset_id = 'beast' AND s.name = wanted.socket_name
ON CONFLICT (socket_id) DO UPDATE SET
  asset_id = EXCLUDED.asset_id,
  interface_type_id = EXCLUDED.interface_type_id;

INSERT INTO terminals(id,asset_id,name,connector,role,note) VALUES
  ('orin-usb','orin-nano','USB Host Ports','USB-A','bidirectional','Future ACCE camera and LiDAR host after cutover'),
  ('oak-usb','oak-d-lite','OAK-D Lite USB','USB','output','RGB, stereo depth, and onboard vision data'),
  ('d500-uart','d500-lidar','D500 UART','ZH1.5T-4P','output','STL-19P/LDS19 scan data at 230400 baud')
ON CONFLICT (id) DO UPDATE SET
  asset_id = EXCLUDED.asset_id,
  name = EXCLUDED.name,
  connector = EXCLUDED.connector,
  role = EXCLUDED.role,
  note = EXCLUDED.note;

INSERT INTO nets(id,name,kind,carries,note) VALUES
  ('net-servo-bus','ST3215 Serial Servo Bus','mixed','TTL half-duplex @ 1 Mbps + pack voltage (5A limit)','Daisy-chained, ID-addressed. BEAST-01 uses the stock two-servo pan-tilt only.'),
  ('net-camera','Camera Feed','data','USB video (MJPEG upstream)',NULL),
  ('net-oak-camera','OAK-D Lite RGB-D','data','USB RGB + stereo depth + device inference','Pi 5 is the current host; the Jetson becomes the host after cutover.'),
  ('net-d500-lidar','D500 LiDAR Scan','data','STL-19P/LDS19 UART @ 230400 baud via USB bridge','ROS 2 uses LDLIDAR_MODEL=ld19; Pi 5 is the current host and Jetson is the cutover target.')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  kind = EXCLUDED.kind,
  carries = EXCLUDED.carries,
  note = EXCLUDED.note;

INSERT INTO net_terminals(net_id,terminal_id) VALUES
  ('net-camera','orin-usb'),
  ('net-oak-camera','oak-usb'),
  ('net-oak-camera','pi5-usb'),
  ('net-oak-camera','orin-usb'),
  ('net-d500-lidar','d500-uart'),
  ('net-d500-lidar','gdb-lidar-uart'),
  ('net-d500-lidar','pi5-usb'),
  ('net-d500-lidar','orin-usb')
ON CONFLICT DO NOTHING;

INSERT INTO net_documents(net_id,document_id) VALUES
  ('net-oak-camera','doc-beast-product'),
  ('net-d500-lidar','doc-beast-product')
ON CONFLICT DO NOTHING;

-- Fail atomically if the database did not converge on the expected truth.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM assets WHERE id = 'roarm-m2') THEN
    RAISE EXCEPTION 'stale RoArm asset remains';
  END IF;
  IF EXISTS (SELECT 1 FROM wishlist_meta WHERE asset_id = 'orin-nano') THEN
    RAISE EXCEPTION 'Orin wishlist metadata remains';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM assets
    WHERE id = 'orin-nano' AND lifecycle = 'inventory' AND provenance = 'owner'
  ) THEN
    RAISE EXCEPTION 'Orin ownership state was not reconciled';
  END IF;
  IF (SELECT count(*) FROM assets WHERE id IN ('oak-d-lite','d500-lidar')) <> 2 THEN
    RAISE EXCEPTION 'ACCE sensing assets are incomplete';
  END IF;
  IF EXISTS (
    SELECT 1 FROM loadout_assignments la
    JOIN sockets s ON s.id = la.socket_id
    WHERE s.host_asset_id = 'beast' AND s.name = 'Serial Bus Servo'
  ) THEN
    RAISE EXCEPTION 'servo socket is still assigned';
  END IF;
  IF (
    SELECT count(*)
    FROM loadout_assignments la
    JOIN sockets s ON s.id = la.socket_id
    WHERE s.host_asset_id = 'beast'
      AND (s.name,la.asset_id,la.interface_type_id) IN (
        ('21mm Picatinny Rail','oak-d-lite','sensor-rail'),
        ('Middle Deck','d500-lidar','sensor-deck'),
        ('LiDAR UART Port','d500-lidar','lidar-uart')
      )
  ) <> 3 THEN
    RAISE EXCEPTION 'ACCE loadout assignments are incomplete';
  END IF;
  IF (
    SELECT count(*) FROM terminals
    WHERE id IN ('orin-usb','oak-usb','d500-uart')
  ) <> 3 THEN
    RAISE EXCEPTION 'ACCE connected-twin terminals are incomplete';
  END IF;
END
$$;

COMMIT;
