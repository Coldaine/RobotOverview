-- Migration 2026-07-03: connected twin (terminals + nets + documents)
-- Additive only. Existing rows are untouched; new tables are created and
-- seeded, and the one new asset (driver-board) is inserted.
BEGIN;
SET client_min_messages = warning;

-- ── CONNECTED TWIN (terminals + nets) ────────────────────────────────────────
-- A terminal is a physical connector on an asset; a net joins terminals that
-- are wired together (power rail, UART link, servo daisy-chain). Documents are
-- the downloaded source library (archive_path is the stable key; url filled
-- once files move to object storage).
CREATE TYPE net_kind AS ENUM ('power','data','mixed','mechanical');

CREATE TABLE terminals (
  id        TEXT PRIMARY KEY,
  asset_id  TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  name      TEXT NOT NULL,
  connector TEXT,
  role      TEXT CHECK (role IN ('input','output','bidirectional')),
  note      TEXT
);

CREATE TABLE nets (
  id      TEXT PRIMARY KEY,
  name    TEXT NOT NULL,
  kind    net_kind NOT NULL,
  carries TEXT,
  note    TEXT
);

CREATE TABLE net_terminals (
  net_id      TEXT NOT NULL REFERENCES nets(id) ON DELETE CASCADE,
  terminal_id TEXT NOT NULL REFERENCES terminals(id) ON DELETE CASCADE,
  PRIMARY KEY (net_id, terminal_id)
);

CREATE TABLE documents (
  id           TEXT PRIMARY KEY,
  title        TEXT NOT NULL,
  kind         TEXT NOT NULL CHECK (kind IN ('schematic','manual','cad','firmware','wiki','datasheet','image')),
  archive_path TEXT NOT NULL,
  url          TEXT,
  note         TEXT
);

CREATE TABLE document_assets (
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  asset_id    TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  PRIMARY KEY (document_id, asset_id)
);

CREATE TABLE net_documents (
  net_id      TEXT NOT NULL REFERENCES nets(id) ON DELETE CASCADE,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  PRIMARY KEY (net_id, document_id)
);
CREATE INDEX idx_terminals_asset    ON terminals(asset_id);
CREATE INDEX idx_net_terminals_term ON net_terminals(terminal_id);
CREATE INDEX idx_document_assets_asset ON document_assets(asset_id);

-- tag registry upserts (idempotent)
INSERT INTO tags(namespace,name,label) VALUES ('tag','waveshare','waveshare') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('tag','beast','beast') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('tag','controller','controller') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('tag','esp32','esp32') ON CONFLICT (namespace,name) DO NOTHING;
INSERT INTO tags(namespace,name,label) VALUES ('class','Robot Controller Board','Robot Controller Board') ON CONFLICT (namespace,name) DO NOTHING;

-- new asset: the General Driver board, plus its bay/tag rows
INSERT INTO assets(id,kind,name,manufacturer,model,callsign,status,lifecycle,provenance,flagship,summary,description,planning_notes,monitored_via,acquired,horizon,quantity,power_watts,power_volts,power_rail,mass_grams,price_us,price_import,specs,links,limitations,sources) VALUES ('driver-board','module','General Driver for Robots',NULL,NULL,'BEAST-CTL','operational','assembled','owner',false,'Waveshare ESP32-WROOM-32 driver board at the heart of BEAST-01: motor H-bridge, ST3215 servo bus, 5V host rail for the Pi, IMU, and battery telemetry on one 65×65mm PCB.',NULL,NULL,NULL,'included',NULL,1,NULL,NULL,NULL,NULL,NULL,NULL,'[{"label":"MCU","value":"ESP32-WROOM-32"},{"label":"Power in","value":"XH2.54 · DC 7–13V"},{"label":"Motor driver","value":"TB6612FNG dual H-bridge"},{"label":"Servo bus","value":"ST3215 TTL @ 1 Mbps (5A limit)"},{"label":"Host rail","value":"5V buck (MP8759, ~5A) via 40-pin"},{"label":"Telemetry","value":"INA219 V/I sense · IMU · OLED I²C"}]'::jsonb,NULL,NULL,NULL);
INSERT INTO asset_groups(asset_id,group_id) VALUES ('driver-board','robotics') ON CONFLICT DO NOTHING;
INSERT INTO asset_tags(asset_id,tag_id) SELECT 'driver-board',id FROM tags WHERE namespace='tag' AND name='controller' ON CONFLICT DO NOTHING;
INSERT INTO asset_tags(asset_id,tag_id) SELECT 'driver-board',id FROM tags WHERE namespace='tag' AND name='esp32' ON CONFLICT DO NOTHING;
INSERT INTO asset_tags(asset_id,tag_id) SELECT 'driver-board',id FROM tags WHERE namespace='tag' AND name='waveshare' ON CONFLICT DO NOTHING;
INSERT INTO asset_tags(asset_id,tag_id) SELECT 'driver-board',id FROM tags WHERE namespace='tag' AND name='beast' ON CONFLICT DO NOTHING;
INSERT INTO asset_tags(asset_id,tag_id) SELECT 'driver-board',id FROM tags WHERE namespace='class' AND name='Robot Controller Board' ON CONFLICT DO NOTHING;

-- terminals
INSERT INTO terminals(id,asset_id,name,connector,role,note) VALUES ('gdb-power-in','driver-board','Battery Input','XH2.54','input','DC 7–13V from the UPS rail; feeds motors and the servo bus directly');
INSERT INTO terminals(id,asset_id,name,connector,role,note) VALUES ('gdb-5v-host','driver-board','5V Host Rail','40-pin header','output','MP8759 buck ~5A — powers the Raspberry Pi 5. The Orin cannot use this rail.');
INSERT INTO terminals(id,asset_id,name,connector,role,note) VALUES ('gdb-host-uart','driver-board','Host UART','40-pin header','bidirectional','ESP32 ↔ host JSON command/telemetry link');
INSERT INTO terminals(id,asset_id,name,connector,role,note) VALUES ('gdb-servo-bus','driver-board','ST3215 Serial Bus Servo Port','TTL bus header','bidirectional','ESP32 GPIO18/19 @ 1 Mbps; switch-limited to 5A');
INSERT INTO terminals(id,asset_id,name,connector,role,note) VALUES ('gdb-motor-a','driver-board','Motor Interface A','PH2.0 6P','output','TB6612FNG channel + encoder feedback');
INSERT INTO terminals(id,asset_id,name,connector,role,note) VALUES ('gdb-motor-b','driver-board','Motor Interface B','PH2.0 6P','output','TB6612FNG channel + encoder feedback');
INSERT INTO terminals(id,asset_id,name,connector,role,note) VALUES ('gdb-i2c','driver-board','I²C Peripheral Header','pin header','bidirectional','OLED and I²C sensors, driven by the ESP32');
INSERT INTO terminals(id,asset_id,name,connector,role,note) VALUES ('gdb-usb-esp32','driver-board','Type-C (ESP32 UART)','USB-C','bidirectional','CP2102 bridge — flashing and debug serial @ 115200');
INSERT INTO terminals(id,asset_id,name,connector,role,note) VALUES ('gdb-lidar-uart','driver-board','LiDAR UART Port','UART + Type-C','bidirectional','Second CP2102 routes radar serial to USB');
INSERT INTO terminals(id,asset_id,name,connector,role,note) VALUES ('gdb-12v-switched','driver-board','12V Switched Outputs','IO4 / IO5','output','ESP32-switched pack-voltage outputs for LEDs or payloads');
INSERT INTO terminals(id,asset_id,name,connector,role,note) VALUES ('ups-rail-out','stock-ups','Battery Rail Out','XH2.54','output','3S pack, 9–12.6V @ 2A');
INSERT INTO terminals(id,asset_id,name,connector,role,note) VALUES ('ups-charge-in','stock-ups','Charge Input','DC5521','input','12.6V / 2A charger; supports charge-while-discharge');
INSERT INTO terminals(id,asset_id,name,connector,role,note) VALUES ('ups-telemetry','stock-ups','Telemetry Header','pin header (5V/3V3/I²C)','output','INA219-style battery V/I telemetry over I²C');
INSERT INTO terminals(id,asset_id,name,connector,role,note) VALUES ('pi5-40pin','pi5','40-Pin GPIO Header','40-pin header','bidirectional','Stacks on the driver board: takes 5V power + UART');
INSERT INTO terminals(id,asset_id,name,connector,role,note) VALUES ('pi5-usb','pi5','USB Host Ports','USB-A','bidirectional','Camera input');
INSERT INTO terminals(id,asset_id,name,connector,role,note) VALUES ('orin-uart','orin-nano','40-Pin Header (UART jumpers)','jumper wires','bidirectional','TX/RX/GND only — the Orin does not stack and cannot draw header 5V');
INSERT INTO terminals(id,asset_id,name,connector,role,note) VALUES ('orin-dc-in','orin-nano','DC Power Input','barrel jack','input','9–19V ~45W; fed from the battery rail, never the 5V host rail');
INSERT INTO terminals(id,asset_id,name,connector,role,note) VALUES ('roarm-servo-in','roarm-m2','Servo Bus Chain','TTL bus daisy-chain','bidirectional','ST3215/ST3235 joints on the shared serial bus');
INSERT INTO terminals(id,asset_id,name,connector,role,note) VALUES ('beast-motor-left','beast','Left Track Motor','PH2.0 6P','input','DC gear motor with encoder');
INSERT INTO terminals(id,asset_id,name,connector,role,note) VALUES ('beast-motor-right','beast','Right Track Motor','PH2.0 6P','input','DC gear motor with encoder');
INSERT INTO terminals(id,asset_id,name,connector,role,note) VALUES ('beast-pan-tilt','beast','Pan-Tilt (2× ST3215)','TTL bus daisy-chain','bidirectional','Stock 2-DOF camera mount on the servo bus');
INSERT INTO terminals(id,asset_id,name,connector,role,note) VALUES ('beast-camera','beast','USB Camera','USB','output','5MP, 160° FOV, rides the pan-tilt');
INSERT INTO terminals(id,asset_id,name,connector,role,note) VALUES ('beast-oled','beast','OLED Display','I²C','input','Voltage / IP telemetry readout');

-- documents + document_assets
INSERT INTO documents(id,title,kind,archive_path,url,note) VALUES ('doc-gdb-schematic','General Driver for Robots — Schematic','schematic','UGV-Beast-Archive/02-Driver-Board/General_Driver_for_Robots_Schematic.pdf',NULL,NULL);
INSERT INTO document_assets(document_id,asset_id) VALUES ('doc-gdb-schematic','driver-board') ON CONFLICT DO NOTHING;
INSERT INTO documents(id,title,kind,archive_path,url,note) VALUES ('doc-gdb-wiki','General Driver for Robots — Wiki','wiki','UGV-Beast-Archive/08-Wiki-Pages/General-Driver-for-Robots_Wiki.md',NULL,NULL);
INSERT INTO document_assets(document_id,asset_id) VALUES ('doc-gdb-wiki','driver-board') ON CONFLICT DO NOTHING;
INSERT INTO documents(id,title,kind,archive_path,url,note) VALUES ('doc-gdb-step','General Driver for Robots — STEP CAD','cad','UGV-Beast-Archive/02-Driver-Board/General_Driver_for_Robots_STEP.zip',NULL,NULL);
INSERT INTO document_assets(document_id,asset_id) VALUES ('doc-gdb-step','driver-board') ON CONFLICT DO NOTHING;
INSERT INTO documents(id,title,kind,archive_path,url,note) VALUES ('doc-ups-schematic','UPS Module 3S — Schematic','schematic','UGV-Beast-Archive/03-Power-UPS/Ups01_Schematic.pdf',NULL,NULL);
INSERT INTO document_assets(document_id,asset_id) VALUES ('doc-ups-schematic','stock-ups') ON CONFLICT DO NOTHING;
INSERT INTO documents(id,title,kind,archive_path,url,note) VALUES ('doc-ups-wiki','UPS Module 3S — Wiki','wiki','UGV-Beast-Archive/08-Wiki-Pages/UPS-Module-3S_Wiki.md',NULL,NULL);
INSERT INTO document_assets(document_id,asset_id) VALUES ('doc-ups-wiki','stock-ups') ON CONFLICT DO NOTHING;
INSERT INTO documents(id,title,kind,archive_path,url,note) VALUES ('doc-ups-code','UPS Module 3S — INA219 Monitoring Code','firmware','UGV-Beast-Archive/03-Power-UPS/UPS_Module_3S_Code.zip',NULL,NULL);
INSERT INTO document_assets(document_id,asset_id) VALUES ('doc-ups-code','stock-ups') ON CONFLICT DO NOTHING;
INSERT INTO documents(id,title,kind,archive_path,url,note) VALUES ('doc-st3215-manual','ST3215 Servo — User Manual','manual','UGV-Beast-Archive/04-Servos/ST3215_Servo_User_Manual.pdf',NULL,NULL);
INSERT INTO document_assets(document_id,asset_id) VALUES ('doc-st3215-manual','roarm-m2') ON CONFLICT DO NOTHING;
INSERT INTO document_assets(document_id,asset_id) VALUES ('doc-st3215-manual','beast') ON CONFLICT DO NOTHING;
INSERT INTO documents(id,title,kind,archive_path,url,note) VALUES ('doc-st-protocol','ST Serial Bus Servo — Protocol Manual','manual','UGV-Beast-Archive/04-Servos/ST_Servo_Communication_Protocol_Manual.pdf',NULL,NULL);
INSERT INTO document_assets(document_id,asset_id) VALUES ('doc-st-protocol','roarm-m2') ON CONFLICT DO NOTHING;
INSERT INTO document_assets(document_id,asset_id) VALUES ('doc-st-protocol','beast') ON CONFLICT DO NOTHING;
INSERT INTO documents(id,title,kind,archive_path,url,note) VALUES ('doc-st-circuit','ST Bus Servo — Control Circuit Schematic','schematic','UGV-Beast-Archive/04-Servos/ST_Bus_Servo_Control_Circuit.pdf',NULL,NULL);
INSERT INTO document_assets(document_id,asset_id) VALUES ('doc-st-circuit','driver-board') ON CONFLICT DO NOTHING;
INSERT INTO documents(id,title,kind,archive_path,url,note) VALUES ('doc-beast-wiki','UGV Beast — Wiki','wiki','UGV-Beast-Archive/08-Wiki-Pages/UGV-Beast_Wiki.md',NULL,NULL);
INSERT INTO document_assets(document_id,asset_id) VALUES ('doc-beast-wiki','beast') ON CONFLICT DO NOTHING;
INSERT INTO documents(id,title,kind,archive_path,url,note) VALUES ('doc-beast-product','UGV Beast PT — Product Page','wiki','UGV-Beast-Archive/08-Wiki-Pages/UGV-Beast_Product-Page.md',NULL,NULL);
INSERT INTO document_assets(document_id,asset_id) VALUES ('doc-beast-product','beast') ON CONFLICT DO NOTHING;
INSERT INTO documents(id,title,kind,archive_path,url,note) VALUES ('doc-beast-cad','UGV Beast PT AI Kit — STEP CAD','cad','UGV-Beast-Archive/05-Chassis-CAD/UGV_Beast_PT_AI_Kit_STEP.zip',NULL,NULL);
INSERT INTO document_assets(document_id,asset_id) VALUES ('doc-beast-cad','beast') ON CONFLICT DO NOTHING;
INSERT INTO documents(id,title,kind,archive_path,url,note) VALUES ('doc-orin-3d','UGV Beast PT Jetson Orin — 3D CAD','cad','UGV-Beast-Archive/06-Jetson-Orin/UGV_Beast_PT_Jetson_Orin_3D.zip',NULL,NULL);
INSERT INTO document_assets(document_id,asset_id) VALUES ('doc-orin-3d','orin-nano') ON CONFLICT DO NOTHING;
INSERT INTO document_assets(document_id,asset_id) VALUES ('doc-orin-3d','beast') ON CONFLICT DO NOTHING;
INSERT INTO documents(id,title,kind,archive_path,url,note) VALUES ('doc-orin-wiki','UGV Beast PT Jetson Orin AI Kit — Wiki','wiki','UGV-Beast-Archive/08-Wiki-Pages/UGV-Beast-PT-Jetson-Orin-AI-Kit_Wiki.md',NULL,NULL);
INSERT INTO document_assets(document_id,asset_id) VALUES ('doc-orin-wiki','orin-nano') ON CONFLICT DO NOTHING;
INSERT INTO documents(id,title,kind,archive_path,url,note) VALUES ('doc-esp32-firmware','UGV01 Base — ESP32 Firmware','firmware','UGV-Beast-Archive/07-Code-Firmware/UGV01_BASE_ESP32_Firmware.zip',NULL,NULL);
INSERT INTO document_assets(document_id,asset_id) VALUES ('doc-esp32-firmware','driver-board') ON CONFLICT DO NOTHING;
INSERT INTO documents(id,title,kind,archive_path,url,note) VALUES ('doc-cp210x-driver','CP210x USB-UART Driver','firmware','UGV-Beast-Archive/07-Code-Firmware/CP210x_USB_TO_UART_Driver.zip',NULL,NULL);
INSERT INTO document_assets(document_id,asset_id) VALUES ('doc-cp210x-driver','driver-board') ON CONFLICT DO NOTHING;

-- nets + net_terminals + net_documents
INSERT INTO nets(id,name,kind,carries,note) VALUES ('net-battery-rail','Battery Rail','power','3S pack · 9–12.6V','UPS → driver board; feeds motors + servo bus directly. The Orin taps this rail in the Jetson swap (the 5V host rail cannot power it).');
INSERT INTO net_terminals(net_id,terminal_id) VALUES ('net-battery-rail','ups-rail-out') ON CONFLICT DO NOTHING;
INSERT INTO net_terminals(net_id,terminal_id) VALUES ('net-battery-rail','gdb-power-in') ON CONFLICT DO NOTHING;
INSERT INTO net_terminals(net_id,terminal_id) VALUES ('net-battery-rail','orin-dc-in') ON CONFLICT DO NOTHING;
INSERT INTO net_documents(net_id,document_id) VALUES ('net-battery-rail','doc-ups-schematic') ON CONFLICT DO NOTHING;
INSERT INTO net_documents(net_id,document_id) VALUES ('net-battery-rail','doc-gdb-schematic') ON CONFLICT DO NOTHING;
INSERT INTO net_documents(net_id,document_id) VALUES ('net-battery-rail','doc-ups-wiki') ON CONFLICT DO NOTHING;
INSERT INTO nets(id,name,kind,carries,note) VALUES ('net-5v-host','5V Host Rail','power','5V ≈5A (MP8759 buck)','Powers the Raspberry Pi 5 through the stacked 40-pin header.');
INSERT INTO net_terminals(net_id,terminal_id) VALUES ('net-5v-host','gdb-5v-host') ON CONFLICT DO NOTHING;
INSERT INTO net_terminals(net_id,terminal_id) VALUES ('net-5v-host','pi5-40pin') ON CONFLICT DO NOTHING;
INSERT INTO net_documents(net_id,document_id) VALUES ('net-5v-host','doc-gdb-schematic') ON CONFLICT DO NOTHING;
INSERT INTO net_documents(net_id,document_id) VALUES ('net-5v-host','doc-gdb-wiki') ON CONFLICT DO NOTHING;
INSERT INTO nets(id,name,kind,carries,note) VALUES ('net-host-uart','Host ↔ ESP32 UART','data','UART JSON commands + telemetry','The only Pi GPIO interface the robot occupies. Orin swap uses TX/RX/GND jumpers instead of stacking.');
INSERT INTO net_terminals(net_id,terminal_id) VALUES ('net-host-uart','gdb-host-uart') ON CONFLICT DO NOTHING;
INSERT INTO net_terminals(net_id,terminal_id) VALUES ('net-host-uart','pi5-40pin') ON CONFLICT DO NOTHING;
INSERT INTO net_terminals(net_id,terminal_id) VALUES ('net-host-uart','orin-uart') ON CONFLICT DO NOTHING;
INSERT INTO net_documents(net_id,document_id) VALUES ('net-host-uart','doc-gdb-wiki') ON CONFLICT DO NOTHING;
INSERT INTO net_documents(net_id,document_id) VALUES ('net-host-uart','doc-beast-product') ON CONFLICT DO NOTHING;
INSERT INTO nets(id,name,kind,carries,note) VALUES ('net-servo-bus','ST3215 Serial Servo Bus','mixed','TTL half-duplex @ 1 Mbps + pack voltage (5A limit)','Daisy-chained, ID-addressed. Stock kit runs the pan-tilt only; the RoArm-M2 is an operator addition on the same bus.');
INSERT INTO net_terminals(net_id,terminal_id) VALUES ('net-servo-bus','gdb-servo-bus') ON CONFLICT DO NOTHING;
INSERT INTO net_terminals(net_id,terminal_id) VALUES ('net-servo-bus','beast-pan-tilt') ON CONFLICT DO NOTHING;
INSERT INTO net_terminals(net_id,terminal_id) VALUES ('net-servo-bus','roarm-servo-in') ON CONFLICT DO NOTHING;
INSERT INTO net_documents(net_id,document_id) VALUES ('net-servo-bus','doc-st-protocol') ON CONFLICT DO NOTHING;
INSERT INTO net_documents(net_id,document_id) VALUES ('net-servo-bus','doc-st-circuit') ON CONFLICT DO NOTHING;
INSERT INTO net_documents(net_id,document_id) VALUES ('net-servo-bus','doc-st3215-manual') ON CONFLICT DO NOTHING;
INSERT INTO nets(id,name,kind,carries,note) VALUES ('net-motor-left','Left Track Drive','mixed','TB6612FNG PWM + encoder feedback',NULL);
INSERT INTO net_terminals(net_id,terminal_id) VALUES ('net-motor-left','gdb-motor-a') ON CONFLICT DO NOTHING;
INSERT INTO net_terminals(net_id,terminal_id) VALUES ('net-motor-left','beast-motor-left') ON CONFLICT DO NOTHING;
INSERT INTO net_documents(net_id,document_id) VALUES ('net-motor-left','doc-gdb-schematic') ON CONFLICT DO NOTHING;
INSERT INTO net_documents(net_id,document_id) VALUES ('net-motor-left','doc-gdb-wiki') ON CONFLICT DO NOTHING;
INSERT INTO nets(id,name,kind,carries,note) VALUES ('net-motor-right','Right Track Drive','mixed','TB6612FNG PWM + encoder feedback',NULL);
INSERT INTO net_terminals(net_id,terminal_id) VALUES ('net-motor-right','gdb-motor-b') ON CONFLICT DO NOTHING;
INSERT INTO net_terminals(net_id,terminal_id) VALUES ('net-motor-right','beast-motor-right') ON CONFLICT DO NOTHING;
INSERT INTO net_documents(net_id,document_id) VALUES ('net-motor-right','doc-gdb-schematic') ON CONFLICT DO NOTHING;
INSERT INTO net_documents(net_id,document_id) VALUES ('net-motor-right','doc-gdb-wiki') ON CONFLICT DO NOTHING;
INSERT INTO nets(id,name,kind,carries,note) VALUES ('net-camera','Camera Feed','data','USB video (MJPEG upstream)',NULL);
INSERT INTO net_terminals(net_id,terminal_id) VALUES ('net-camera','beast-camera') ON CONFLICT DO NOTHING;
INSERT INTO net_terminals(net_id,terminal_id) VALUES ('net-camera','pi5-usb') ON CONFLICT DO NOTHING;
INSERT INTO net_documents(net_id,document_id) VALUES ('net-camera','doc-beast-product') ON CONFLICT DO NOTHING;
INSERT INTO nets(id,name,kind,carries,note) VALUES ('net-oled-i2c','OLED Telemetry','data','I²C',NULL);
INSERT INTO net_terminals(net_id,terminal_id) VALUES ('net-oled-i2c','gdb-i2c') ON CONFLICT DO NOTHING;
INSERT INTO net_terminals(net_id,terminal_id) VALUES ('net-oled-i2c','beast-oled') ON CONFLICT DO NOTHING;
INSERT INTO net_documents(net_id,document_id) VALUES ('net-oled-i2c','doc-gdb-wiki') ON CONFLICT DO NOTHING;
INSERT INTO nets(id,name,kind,carries,note) VALUES ('net-ups-telemetry','UPS Battery Telemetry','data','I²C V/I readings','Per the UPS wiki RPi wiring table (SDA/SCL/5V/GND); optional hookup on the Beast.');
INSERT INTO net_terminals(net_id,terminal_id) VALUES ('net-ups-telemetry','ups-telemetry') ON CONFLICT DO NOTHING;
INSERT INTO net_terminals(net_id,terminal_id) VALUES ('net-ups-telemetry','pi5-40pin') ON CONFLICT DO NOTHING;
INSERT INTO net_documents(net_id,document_id) VALUES ('net-ups-telemetry','doc-ups-wiki') ON CONFLICT DO NOTHING;
INSERT INTO net_documents(net_id,document_id) VALUES ('net-ups-telemetry','doc-ups-code') ON CONFLICT DO NOTHING;

-- enforce archive_path as the stable key (schema.sql declares it UNIQUE)
ALTER TABLE documents ADD CONSTRAINT documents_archive_path_key UNIQUE (archive_path);

-- app-role grants, inside the transaction so the migration is all-or-nothing.
-- Scoped to what the app actually needs (no TRUNCATE/REFERENCES/TRIGGER);
-- guarded so environments without the role still apply cleanly.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'hangar') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE
      ON terminals, nets, net_terminals, documents, document_assets, net_documents TO hangar;
  END IF;
END
$$;

COMMIT;
