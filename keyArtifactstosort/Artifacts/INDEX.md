# Derived extractions — ROS Driver for Robots

Staging home for **derived** work products (not vendor re-downloads). Do not put
re-downloadable vendor zips here — those stay under `../reference/` and are gitignored
as `reference/*.zip`.

Source schematic (authoritative PDF):
`../RasperryPIversionofROS_Driver_for_Robots.pdf`
(byte-identical to `public/datacore/pdfs/ROS_Driver_for_Robots.pdf`).

## Active: `ros-driver/current/`

**`ros_driver_traced_connectivity_v1`** — path-trace revision 1 (108 edges). This is the
authority for board connectivity and supply topology. Use it for wiring questions.

| File | Notes |
|---|---|
| `ros_driver_traced_connectivity_v1.zip` | Archive copy |
| `ros_driver_traced_connectivity_v1/ros_driver_traced_connectivity_v1.md` | Narrative + supply topology |
| `ros_driver_traced_connectivity_v1/ros_driver_path_edges.csv` | Edge table |
| `ros_driver_traced_connectivity_v1/ros_driver_traced_graph.json` | Graph form |
| `ros_driver_traced_connectivity_v1/ros_driver_source_load_matrix.csv` | Source / load matrix |

## Superseded: `ros-driver/superseded/`

**`ros_driver_complete_extraction`** — earlier logical/inventory dump (BOM, pin→net, EDIF).
Kept for persistence only (`../agents.md`: do not delete). Not promoted into Hangar inventory
or any parts catalog. Do not prefer it over traced for electrical claims.

## Other files in this folder

| File | Notes |
|---|---|
| `Screenshot 2026-07-27 111058.png` | Pre-existing capture; not part of either zip |
