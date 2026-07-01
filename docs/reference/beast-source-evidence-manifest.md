---
title: BEAST-01 Source Evidence Manifest
audience: AI agents and operators migrating BEAST source evidence to object storage
status: reference
last_updated: 2026-07-01
---

# BEAST-01 Source Evidence Manifest

This manifest records the authoritative local BEAST-01 source evidence currently
cached under the ignored `UGV-Beast-Archive/` directory. The files must stay out of
git. When the Hangar source archive bucket exists, upload these payloads and store
the metadata rows in the database or object manifest.

The hashes below were computed locally on 2026-07-01 with SHA256. Local paths use
the ignored cache path as the operator-visible source of truth for now.

## Manifest

| ID | Type | Subsystem | Source URL | Local ignored path | Bytes | SHA256 | Future S3 key |
|---|---|---|---|---|---:|---|---|
| general-driver-dimensions-dxf | CAD | Driver board | https://files.waveshare.com/upload/5/50/GENERAL-DRIVER-FOR-ROBOTS-STR-DXF.zip | `UGV-Beast-Archive\02-Driver-Board\General_Driver_for_Robots_Dimensions_DXF.zip` | 115624 | `83a4ccd0957f2200c2e7dfe4946b56b50688286598841b850d6840e606c530cc` | `beast/source-archive/02-driver-board/General_Driver_for_Robots_Dimensions_DXF.zip` |
| general-driver-dimensions-pdf | PDF/CAD | Driver board | https://files.waveshare.com/upload/0/0a/GENERAL-DRIVER-FOR-ROBOTS-STR-PDF.zip | `UGV-Beast-Archive\02-Driver-Board\General_Driver_for_Robots_Dimensions_PDF.zip` | 132095 | `757155cbb7ebfeb6358a25b2fc14fa41da0b62baf35ee3270b001214d9ee2173` | `beast/source-archive/02-driver-board/General_Driver_for_Robots_Dimensions_PDF.zip` |
| general-driver-schematic | PDF | Driver board | https://files.waveshare.com/upload/3/37/General_Driver_for_Robots.pdf | `UGV-Beast-Archive\02-Driver-Board\General_Driver_for_Robots_Schematic.pdf` | 1008991 | `dab698578c1b75bdf72a5ade4bada2d9f5a5da54f37737e1f41b0b2c59b9ce8a` | `beast/source-archive/02-driver-board/General_Driver_for_Robots_Schematic.pdf` |
| general-driver-step | CAD | Driver board | https://files.waveshare.com/upload/8/8e/General_Driver_for_Robots_STEP.zip | `UGV-Beast-Archive\02-Driver-Board\General_Driver_for_Robots_STEP.zip` | 1098032 | `51e402703c5429a1068817a290a3078b994aecf87125f741ce0331ff1549eec8` | `beast/source-archive/02-driver-board/General_Driver_for_Robots_STEP.zip` |
| ros-driver-schematic | PDF | Driver board | https://files.waveshare.com/wiki/RaspRover/ROS_Driver_for_Robots.pdf | `UGV-Beast-Archive\02-Driver-Board\ROS_Driver_for_Robots_Schematic.pdf` | 1023807 | `b8ccd10fdb738af05436e118429cfedab9dda072401d2b3a45dfb3b6fd9b8dd5` | `beast/source-archive/02-driver-board/ROS_Driver_for_Robots_Schematic.pdf` |
| ups-code | Code archive | Power / UPS | https://files.waveshare.com/upload/e/ea/UPS_Module_3S_Code.zip | `UGV-Beast-Archive\03-Power-UPS\UPS_Module_3S_Code.zip` | 23084509 | `734edc42fc017c8128235a5240d9239344f465ef0f52810db93d1b658e7a9d4e` | `beast/source-archive/03-power-ups/UPS_Module_3S_Code.zip` |
| ups-dimensions-dxf | CAD | Power / UPS | https://files.waveshare.com/upload/f/f6/UPS_Module_3Sdxf.zip | `UGV-Beast-Archive\03-Power-UPS\UPS_Module_3S_Dimensions_DXF.zip` | 17867 | `3907ab3f23c82f2cdfe02f098d9ca22ad7bdb79ac8a88b561713323b6e33bb4e` | `beast/source-archive/03-power-ups/UPS_Module_3S_Dimensions_DXF.zip` |
| ups-step | CAD | Power / UPS | https://files.waveshare.com/upload/3/38/UPS_Module_3Sstep.zip | `UGV-Beast-Archive\03-Power-UPS\UPS_Module_3S_STEP.zip` | 22277 | `a278f656fd425c6a421c753946386efc7a6b7008bfb66aa0acaef76a77ea3fde` | `beast/source-archive/03-power-ups/UPS_Module_3S_STEP.zip` |
| ups-schematic | PDF | Power / UPS | https://www.waveshare.com/w/upload/5/53/Ups01.pdf | `UGV-Beast-Archive\03-Power-UPS\Ups01_Schematic.pdf` | 1352928 | `ea654047e0c8ae1b8128ecf878ae69e976646ea504c1e6619432751eb452a3b2` | `beast/source-archive/03-power-ups/Ups01_Schematic.pdf` |
| st-bus-servo-control-circuit | PDF | Servos | https://files.waveshare.com/upload/d/d3/Bus_servo_control_circuit.pdf | `UGV-Beast-Archive\04-Servos\ST_Bus_Servo_Control_Circuit.pdf` | 141892 | `2d732e7bbaa7fb0ca70da324030b41f50ec39033dba2cfa35234e2be323bcbf4` | `beast/source-archive/04-servos/ST_Bus_Servo_Control_Circuit.pdf` |
| st-servo-protocol-manual | PDF | Servos | https://files.waveshare.com/upload/2/27/Communication_Protocol_User_Manual-EN%28191218-0923%29.pdf | `UGV-Beast-Archive\04-Servos\ST_Servo_Communication_Protocol_Manual.pdf` | 332610 | `3bf67ac6e28ac37e98a083ce1c32201801123b065d01632350c54fd1d184af5a` | `beast/source-archive/04-servos/ST_Servo_Communication_Protocol_Manual.pdf` |
| st-servo-firmware | Firmware archive | Servos | https://files.waveshare.com/upload/d/d8/ST_Servo.zip | `UGV-Beast-Archive\04-Servos\ST_Servo_Firmware.zip` | 34767 | `939b9d88793b9cb8ef5d09222dfd6eb35c169f4cdc29d498eb0a1a6146752763` | `beast/source-archive/04-servos/ST_Servo_Firmware.zip` |
| st3215-servo-2d | CAD | Servos | https://files.waveshare.com/upload/0/08/ST3215-2D.zip | `UGV-Beast-Archive\04-Servos\ST3215_Servo_2D.zip` | 172516 | `bd034f5301ec271a77a87e8bf5f6bb9995bb3348ba728b97ae3c58dffa79dc1b` | `beast/source-archive/04-servos/ST3215_Servo_2D.zip` |
| st3215-servo-3d | CAD | Servos | https://files.waveshare.com/upload/5/59/ST3215-3D.zip | `UGV-Beast-Archive\04-Servos\ST3215_Servo_3D.zip` | 566939 | `2735561e0c1dc899b35d4740273e5340f15967028d2dd4014feed03d8175562c` | `beast/source-archive/04-servos/ST3215_Servo_3D.zip` |
| st3215-servo-user-manual | PDF | Servos | https://files.waveshare.com/upload/f/f4/ST3215_Servo_User_Manual.pdf | `UGV-Beast-Archive\04-Servos\ST3215_Servo_User_Manual.pdf` | 1606210 | `f37f43544e674e5eaf87c5a134f575fb37d207f2269f6e8c60328d9a82918d49` | `beast/source-archive/04-servos/ST3215_Servo_User_Manual.pdf` |
| beast-pi4b-3d | CAD | Chassis | https://files.waveshare.com/wiki/UGV-Beast/UGV_Beast_PI4B_AI_Kit_3D.zip | `UGV-Beast-Archive\05-Chassis-CAD\UGV_Beast_PI4B_AI_Kit_3D.zip` | 272014 | `cb7d51373314daa966dff26a30cb04d05adcf7c8d57e03341516f6b0f6e74259` | `beast/source-archive/05-chassis-cad/UGV_Beast_PI4B_AI_Kit_3D.zip` |
| beast-pi4b-step | CAD | Chassis | https://files.waveshare.com/wiki/UGV-Beast/UGV_Beast_PI4B_AI_Kit_step.zip | `UGV-Beast-Archive\05-Chassis-CAD\UGV_Beast_PI4B_AI_Kit_STEP.zip` | 11096497 | `b52f72922132568b8728d14c39c783edca1bb13bd1b5f0c694bde3e15c577f27` | `beast/source-archive/05-chassis-cad/UGV_Beast_PI4B_AI_Kit_STEP.zip` |
| beast-pt-3d | CAD | Chassis | https://files.waveshare.com/wiki/UGV-Beast/UGV_Beast_PT_AI_Kit_3D.zip | `UGV-Beast-Archive\05-Chassis-CAD\UGV_Beast_PT_AI_Kit_3D.zip` | 307341 | `33db3df8d1ad24a92a1a74ce0d5360ec78950fa421e48bc5e780acc76e038c9a` | `beast/source-archive/05-chassis-cad/UGV_Beast_PT_AI_Kit_3D.zip` |
| beast-pt-step | CAD | Chassis | https://files.waveshare.com/wiki/UGV-Beast/UGV_Beast_PT_AI_Kit_step.zip | `UGV-Beast-Archive\05-Chassis-CAD\UGV_Beast_PT_AI_Kit_STEP.zip` | 12303971 | `bf649936f7663c7e4520fe4e45aa02d0b5ae588e5c200229a1f2cbfdcd9b7631` | `beast/source-archive/05-chassis-cad/UGV_Beast_PT_AI_Kit_STEP.zip` |
| beast-jetson-orin-3d | CAD | Jetson Orin mount | https://files.waveshare.com/wiki/UGV-Beast-PT-Jetson-Orin-AI-Kit/UGV_Beast_PT_Jetson_Orin-3D.zip | `UGV-Beast-Archive\06-Jetson-Orin\UGV_Beast_PT_Jetson_Orin_3D.zip` | 15378700 | `56615c77a93b90b760e6e2277de55ff36fe8ff610f77d2fedb197ca0d6f879b4` | `beast/source-archive/06-jetson-orin/UGV_Beast_PT_Jetson_Orin_3D.zip` |
| beast-jetson-orin-2d | CAD | Jetson Orin mount | https://files.waveshare.com/wiki/UGV-Beast-PT-Jetson-Orin-AI-Kit/UGV_Beast_PT_Jetson_Orin_AI_Kit-2D.zip2D | `UGV-Beast-Archive\06-Jetson-Orin\UGV_Beast_PT_Jetson_Orin_AI_Kit_2D.zip` | 425915 | `acc6d8c8ae83d7ae5ddf9efe34960c3e0fcd0d126542fa9f7ef25682d7f4cd77` | `beast/source-archive/06-jetson-orin/UGV_Beast_PT_Jetson_Orin_AI_Kit_2D.zip` |
| cp210x-driver | Driver archive | Code / firmware | https://files.waveshare.com/wiki/common/CP210x_USB_TO_UART.zip | `UGV-Beast-Archive\07-Code-Firmware\CP210x_USB_TO_UART_Driver.zip` | 4953661 | `7cb2b9b40e5279e55409e84b3f018744b1aae9c06ac9779e549e7d19b5ad67b3` | `beast/source-archive/07-code-firmware/CP210x_USB_TO_UART_Driver.zip` |
| ros-driver-demo | Code archive | Code / firmware | https://files.waveshare.com/wiki/RaspRover/ROS_Driver.zip | `UGV-Beast-Archive\07-Code-Firmware\ROS_Driver_OpenSource_Demo.zip` | 6951776 | `bead7c9fa2948e6d2219bcdfe47f10fc182eba431148b1ff65f3fd4d4e18f87b` | `beast/source-archive/07-code-firmware/ROS_Driver_OpenSource_Demo.zip` |
| ugv-base-general-snapshot | Code snapshot | Code / firmware | https://github.com/waveshareteam/ugv_base_general/tree/d308df91b333a513f45a238bef9ba9a0a5edf64c | `UGV-Beast-Archive\07-Code-Firmware\ugv_base_general_repo_20260628.zip` | 7397722 | `5539128322b2f8f1b398de7c2bcb71ac73be0e27ccf3437442a1df5e2620b94e` | `beast/source-archive/07-code-firmware/ugv_base_general_repo_20260628.zip` |
| ugv-jetson-snapshot | Code snapshot | Code / firmware | https://github.com/waveshareteam/ugv_jetson/tree/18e9a24590e1bfdb39a1bc24aaf8a6af820805d3 | `UGV-Beast-Archive\07-Code-Firmware\ugv_jetson_code_20260628.zip` | 1335725 | `8e34b75ffed59eddb64f070f3bd6cad0d8a198125adb7edbc233d663947ecc6c` | `beast/source-archive/07-code-firmware/ugv_jetson_code_20260628.zip` |
| ugv01-base-esp32-firmware | Firmware archive | Code / firmware | https://files.waveshare.com/upload/0/0c/UGV01_BASE.zip | `UGV-Beast-Archive\07-Code-Firmware\UGV01_BASE_ESP32_Firmware.zip` | 28761 | `5daf339df0a8ca879230d806b8d5d62d65703b4e243b4827682077770bbef4e5` | `beast/source-archive/07-code-firmware/UGV01_BASE_ESP32_Firmware.zip` |
| general-driver-wiki | Wiki capture | Driver board | https://www.waveshare.com/wiki/General_Driver_for_Robots | `UGV-Beast-Archive\08-Wiki-Pages\General-Driver-for-Robots_Wiki.md` | 13181 | `68dd968008f2202a2c33042b313d5be2498ae1d76dd52c09e16eda229c3c37e1` | `beast/source-archive/08-wiki-pages/General-Driver-for-Robots_Wiki.md` |
| st3215-servo-wiki | Wiki capture | Servos | https://www.waveshare.com/wiki/ST3215_Servo | `UGV-Beast-Archive\08-Wiki-Pages\ST3215-Servo_Wiki.md` | 31935 | `b8e420425edbfe9e183e0e8a8cfa61a2a88e94125b56426d95983877bd5008e8` | `beast/source-archive/08-wiki-pages/ST3215-Servo_Wiki.md` |
| ugv-beast-product-page | Product page capture | UGV Beast | https://www.waveshare.com/ugv-beast.htm | `UGV-Beast-Archive\08-Wiki-Pages\UGV-Beast_Product-Page.md` | 79972 | `e4989f5e30c059d6be71605fb821c737d912dec1052a3a7150465909ac466306` | `beast/source-archive/08-wiki-pages/UGV-Beast_Product-Page.md` |
| ugv-beast-wiki | Wiki capture | UGV Beast | https://www.waveshare.com/wiki/UGV-Beast | `UGV-Beast-Archive\08-Wiki-Pages\UGV-Beast_Wiki.md` | 24485 | `eba192cd4055ed395e40eb1e3108c0609a3fcc9d66fd04f8f46d11bbafb5f5a8` | `beast/source-archive/08-wiki-pages/UGV-Beast_Wiki.md` |
| ugv-beast-jetson-orin-ros2-wiki | Wiki capture | Jetson Orin ROS2 | https://www.waveshare.com/wiki/UGV_Beast_Jetson_Orin_ROS2 | `UGV-Beast-Archive\08-Wiki-Pages\UGV-Beast-Jetson-Orin-ROS2_Wiki.md` | 24468 | `6f7b0f432b0f92b2a36e059be1060de1b4d77c190621fc889cbf9c7e167579b8` | `beast/source-archive/08-wiki-pages/UGV-Beast-Jetson-Orin-ROS2_Wiki.md` |
| ugv-beast-jetson-orin-ai-kit-wiki | Wiki capture | Jetson Orin AI kit | https://www.waveshare.com/wiki/UGV_Beast_PT_Jetson_Orin_AI_Kit | `UGV-Beast-Archive\08-Wiki-Pages\UGV-Beast-PT-Jetson-Orin-AI-Kit_Wiki.md` | 25262 | `1b3ed3cfc6d46b629c969cefd25acde117a7830a7a083a1e43c374e9f52c6d3f` | `beast/source-archive/08-wiki-pages/UGV-Beast-PT-Jetson-Orin-AI-Kit_Wiki.md` |
| ups-module-3s-wiki | Wiki capture | Power / UPS | https://www.waveshare.com/wiki/UPS_Module_3S | `UGV-Beast-Archive\08-Wiki-Pages\UPS-Module-3S_Wiki.md` | 10060 | `6cbb18ce03addbb31835d26f2cb0be34039fa1db918955a92db5fb94c2fdab12` | `beast/source-archive/08-wiki-pages/UPS-Module-3S_Wiki.md` |

## Live upstream heads checked

These heads were checked on 2026-07-01 to compare the local code snapshots against
current upstream:

| Repo | Branch | Head |
|---|---|---|
| `waveshareteam/ugv_jetson` | `main` | `18e9a24590e1bfdb39a1bc24aaf8a6af820805d3` |
| `waveshareteam/ugv_base_general` | `main` | `d308df91b333a513f45a238bef9ba9a0a5edf64c` |
| `waveshareteam/ugv_ws` | `ros2-humble-develop` | `f0b3ad9c16e7acb6d6145f261116d71bf6338f4a` |
| `waveshareteam/ugv_rpi` | `main` | `3ae9f203f61bfaaf123ee376f78247d007880b0c` |

## Notes

- `UGV-Beast-Archive/` is the authoritative local cache until the source archive moves
  to S3-compatible object storage.
- The local cache also contains human-authored index/summary files. Those are useful
  operator notes, but the manifest above tracks payloads that should become object-store
  objects.
- The Jetson Orin AI kit 2D source URL is recorded exactly as captured in the local
  Waveshare wiki copy, including the unusual `zip2D` suffix.
- Do not commit any file from `UGV-Beast-Archive/`.
