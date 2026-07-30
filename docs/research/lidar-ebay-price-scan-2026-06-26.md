---
title: eBay LiDAR Price Scan
date: 2026-06-26
author: Codex
status: research
source_scope: eBay listing pages; non-current rows flagged
---

# eBay LiDAR Price Scan - 2026-06-26

This pass re-opened current eBay listing pages for robot/SLAM LiDAR candidates. It
does not use email, non-eBay marketplaces, or the older pasted pricing pass as
final evidence.

## Bottom Line

- **Best cheap outlier:** [Unitree L1 PM 4D LiDAR](https://www.ebay.com/itm/406889927096) at **$235 + shipping**. It is used and scarce, but it is the lowest active exact robot-LiDAR hit found.
- **Best low-risk cheap experiment:** [Unitree L2](https://www.ebay.com/itm/267639884147) at **$350.55 + $14 shipping = $364.55** from a large-feedback seller. It is meaningfully cheaper than Mid-360, but should be treated as an SDK/ROS validation target before becoming the Hangar default.
- **Best Mid-360-compatible/default lane:** [Livox Mid-360 open box with cable](https://www.ebay.com/itm/406617604175) at **$699.99 + $8.13 shipping = $708.12**, US-located, includes cable, no returns. New China listings cluster roughly **$725-$830+** before tax.
- **Best salvage watch:** [Velodyne VLP-16 for parts](https://www.ebay.com/itm/236785084513) at **$99.99 or best offer, free shipping**, but the opened page says it is out of stock and the seller says it is untested with only the pictured unit included. Treat this as a saved-search pattern, not a buyable planning baseline.
- **Best functional-looking old-school SLAM bargain:** [Velodyne VLP-16 Puck](https://www.ebay.com/itm/358638586528) at **$175 + $14.18 shipping = $189.18**, used, no returns, US seller. This is the most interesting non-Mid-360 eBay lane if size, power, age, and cabling are acceptable.

## Answer To The Three Questions

**Is anything meaningfully cheaper than Mid-360?** Yes. Unitree L1/L2, used
Velodyne VLP-16, used Livox Horizon, used Livox MID-70/MID-40, and used
RoboSense RS-LiDAR-16 can all land under the usual Mid-360 eBay price. The
tradeoff is integration maturity, physical size, cabling, condition, or seller
risk.

**Are we missing another LiDAR class?** Yes: the used mechanical 16-line class
is a real eBay bargain lane. Velodyne VLP-16 and RoboSense RS-LiDAR-16 are older
and bulkier than Mid-360, but they are available far below new compact
robotics-focused sensors. Unitree L2 is also a distinct low-cost robotics lane,
but needs software verification before replacing Mid-360 in the Beast plan.

**Are robot/drone bundle offloads worth watching?** Mostly no. The active drone
payload listings price like survey equipment, not cheap parts donors. The only
watch-worthy salvage patterns are standalone used/for-parts sensors, especially
Velodyne VLP-16 units. Full robot/drone bundles are either implausibly cheap
zero-feedback listings or expensive packages.

## Raw Listing Observations

| # | Model / lane | Listing | Price / total before tax | Condition | Seller / origin | Qty / sold | Returns / accessories | Classification |
|---:|---|---|---:|---|---|---|---|---|
| 1 | Unitree L1 | [Unitree L1 PM 4D LiDAR Near Mint Condition 3D Depth Scanner Sensor](https://www.ebay.com/itm/406889927096) | $235.00; subagent saw about $7 shipping | Used, "tested good" | U98, 100%, DG China | Not visible | 30-day buyer-paid returns; accessories not clear | Buyable exact match |
| 2 | Unitree L2 | [Unitree 4D LiDAR L2 360 Scanning LiDAR Sensor for Robotics and Automation](https://www.ebay.com/itm/267639884147) | $350.55 + $14.00 = $364.55 | New | thanksbuyer-hobby, 99.6% | More than 10 available | Accessories not clear | Buyable exact match |
| 3 | Unitree L2 | [Unitree 4D LiDAR L2](https://www.ebay.com/itm/356462583858) | $419.00, free SpeedPAK | New | zcmaker, 92.9%, China | More than 10 available, 2 sold | 14-day buyer-paid returns | Buyable exact match |
| 4 | Livox Mid-360 | [Livox Mid-360 LiDAR Sensor - Open Box - Includes Cable](https://www.ebay.com/itm/406617604175) | $699.99 + $8.13 = $708.12 | Used/open box | mat-721611, 100%, Atlanta GA | Item feedback visible | No returns; official M12 1-to-3 splitter cable included per title/details | Buyable exact match |
| 5 | Livox Mid-360 | [Livox Mid-360 LiDAR 360x59 FOV 40m Range 265g for Mobile Robots](https://www.ebay.com/itm/177916747917) | About $705.91 | Used, 95% new, main unit only | fans_electronics_eu, 98.1% | Not visible | No accessories / no original box in seller note | Buyable exact match, accessory gap |
| 6 | Livox Mid-360 | [1pc Livox Mid 360 new laser radar Spot Goods Fast Shipping](https://www.ebay.com/itm/397105491223) | $781.33, free shipping; coupon displayed around $726.64 | New | Nova-Dynamics, 100%, China | 3 available | 30-day buyer-paid returns | Buyable exact match |
| 7 | Livox Mid-360 | [New Livox Mid 360 Lidar 3D Minimal Detection Range for Self-driving Localization](https://www.ebay.com/itm/226604899705) | $828.79 or best offer | New | autoservice001, about 97.9% | 10 available, 10 sold in earlier result | Returns visible on page snippets | Buyable exact match |
| 8 | Livox Mid-360 | [Livox Mid-360 Lidar Minimal Detection Range With Connector Cable](https://www.ebay.com/itm/205717773000) | $999.00, free SpeedPAK | New | brand_mini_pc_official_store, 99.1%, Shenzhen China | Not visible | Connector cable included | Buyable exact match, expensive |
| 9 | Livox Mid-360S | [New Livox Mid-360S LiDAR Sensor 3D Laser Scanner 360 FOV for Robotics SLAM AMR](https://www.ebay.com/itm/406793269299) | $736.00 base; cable/cover variants available | New | Miwi-electronics, 98.9% | 2 available | Type selector includes MID-360S, cable, cable+cover | Buyable exact match |
| 10 | Livox Mid-360S | [Livox Mid-360S lidar Minimal Detection Range Original](https://www.ebay.com/itm/287248417328) | $740.05 + $60.00 = $800.05 | New | Seller not captured in opened text | 5 available, 1 sold | Accessories not clear | Buyable exact match |
| 11 | Livox Mid-360S | [Livox Mid-360S 3D LiDAR Sensor Latest Gen 360 FOV for ROS Robotics AGV](https://www.ebay.com/itm/406886885872) | $780.00 | New/open box | U98, 100% | 3 available, 2 sold | Accessories not clear | Buyable exact match |
| 12 | Livox Mid-360S | [Livox MID-360S - Accessory](https://www.ebay.com/itm/267653745987) | $693.90 | Used | relznuk_pacifist, 80% | Not visible | Accessories not clear | Possible match, seller-risk flag |
| 13 | Hesai JT16 | [HESAI JT16 16-Channel LiDAR Sensor for Autonomous Vehicles Long-Range 3D Mapping](https://www.ebay.com/itm/356677201647) | $799.00 | New | zicznt, 50% | 2 available, 1 sold | Variant selector: only LiDAR or accessory kit | Buyable exact match, seller-risk flag |
| 14 | Hesai JT16 | [HESAI JT16 16-Channel LiDAR Sensor for Autonomous Vehicles Long-Range 3D Mapping](https://www.ebay.com/itm/356677218206) | $799.00, free SpeedPAK | New | zcmaker, 92.9%, China | Last one, 1 sold | 14-day buyer-paid returns; accessory-kit variant | Buyable exact match |
| 15 | RoboSense E1R | [Robosense E1R Fully Solid-State Digital LiDAR for Robots](https://www.ebay.com/itm/356462580074) | $1,099.00, free SpeedPAK | New | zicznt, 50%, China | 8 available, 2 sold | 14-day buyer-paid returns; E1R 3.5M/8M variants | Buyable exact match, seller-risk flag |
| 16 | RoboSense E1R | [RoboSense E1R LiDAR, The First Fully Solid-State Digital LiDAR for Robots](https://www.ebay.com/itm/168266429815) | About $2,862.93, free shipping | Not clearly captured | Hexlight Canada, 97.5%, Shenzhen China | 1 watcher | 14-day seller-paid returns | Too expensive |
| 17 | RoboSense Airy | [RoboSense Airy 96-Beam LiDAR Sensor A01-H Solid-state Beyond Livox Mid-360](https://www.ebay.com/itm/406886857646) | $726.00 | New | U98, 100% | Last one, 2 sold | Accessories not clear | Buyable exact match |
| 18 | RoboSense Airy | [Robosense Airy 96-Channel digital LiDAR Sensor for Autonomous Vehicles Robot](https://www.ebay.com/itm/358328176491) | $1,159.00 | New | zicznt, feedback varied in search results | 9 available | Accessory-kit variant shown | Buyable exact match, less attractive than $726 row |
| 19 | RoboSense M1 | [RoboSense RS-LiDAR-M1 v2 Automotive-grade Solid-State LiDAR Lucid OEM](https://www.ebay.com/itm/126879934497) | $600.00 or best offer, free shipping | Used | OEMGPSNAV.COM, 100%, Charlotte NC | 2 available | 30-day seller-paid returns | Possible match, OEM integration risk |
| 20 | RoboSense RS-LiDAR-16 | [USED The Robosense RS-LiDAR-16 advanced 3D LiDAR sensor is suitable for robots/x](https://www.ebay.com/itm/316671492950) | $403.20 or best offer | Used, seller says cleaned/tested/functional | xjk1_47, 99.5% | 3 available | Returns not fully captured in opened lines | Possible match |
| 21 | Livox Horizon | [Livox Horizon Lidar Sensor](https://www.ebay.com/itm/356466067784) | $400.00 | Used | zcmaker, 92.9%, China | 2 available | 14-day buyer-paid returns | Buyable exact match |
| 22 | Livox Horizon | [Livox Horizon Lidar Sensor](https://www.ebay.com/itm/205678599157) | $499.00 or best offer | Used | viskat-47, 94.4% | 2 available, 2 sold | Accessories not clear | Buyable exact match |
| 23 | Livox MID-70 | [1pcs used Livox MID-70 Laser Lidar Module with cable](https://www.ebay.com/itm/800066421531) | $446.00 or best offer | Used | xinhai001, 100%, Wuhan China | 5 available | Cable included in title | Possible match |
| 24 | Livox MID-70 | [Livox MID-70 3D LiDAR Sensor Converter and cable MID 70](https://www.ebay.com/itm/157226950080) | About $473.14 landed before possible import fees | Used | Techyard Canada, 100%, Kitchener ON | 8 available, 5 sold | Converter and cable named | Possible match |
| 25 | Livox MID-70 | [Livox Mid-70 LiDAR - 70.4 FOV 260m Range 200k Pts/s IP67](https://www.ebay.com/itm/358253103092) | $719.00 or best offer | Used, 90% new, no original box | auskyview, 100%, Shenzhen China | More than 10 available, 2 sold | Accessories not clear | Buyable exact match, not cheaper enough |
| 26 | Livox MID-40 | [Livox Mid-40 LiDAR Sensor - Customized Cable for UAV or Autonomous Platform](https://www.ebay.com/itm/317869563360) | $475.00 + $13.98 = $488.98 | New/open box | ririhaori4089, 100%, San Jose CA | 1 watcher | 14-day buyer-paid returns; customized cable implied | Possible match |
| 27 | Livox Avia | [Livox Avia Lidar Applicable to Electric Power, Forestry, Pan-mapping](https://www.ebay.com/itm/358196839726) | $1,999.00 or best offer | New | zcmaker, 92.9% | 7 available, 3 sold | Returns accepted | Too expensive |
| 28 | Hesai XT16 | [HESAI PandarXT-16 16-Channel Medium-Range LiDAR Sensor Module 120m Range](https://www.ebay.com/itm/396804448508) | $1,251.15 + $35.00 = $1,286.15 | Used, good condition | Seller not captured | Not captured | 1 sensor module named | Too expensive |
| 29 | Velodyne VLP-16 | [Velodyne VLP-16 Puck LiDAR Sensor](https://www.ebay.com/itm/234740701349) | $276.50, free shipping | Used, working, scratches/delamination | Seller not captured in opened lines | More than 10 available, 6 sold | 30-day seller-paid returns | Buyable exact match |
| 30 | Velodyne VLP-16 | [Velodyne LiDAR Sensor Puck VLP-16 3D Scanner Autonomous Robot Mapping PN 82-0577](https://www.ebay.com/itm/358638586528) | $175.00 + $14.18 = $189.18 | Used, seller claims working/good cosmetic | TestWorld Inc, 99.9%, Rocklin CA | 1 watched today | No returns | Possible match, best functional-looking bargain |
| 31 | Velodyne VLP-16 salvage | [Velodyne VLP-16 Puck LiDAR Sensor 360 Degree Mapping Drone Surround View](https://www.ebay.com/itm/236785084513) | $99.99 or best offer, free shipping | For parts/not working; untested, pictured unit only | Nemesisentpdx, 99.9%, Portland OR | Page says out of stock in opened text | 30-day seller-paid returns | Not current / salvage watch |
| 32 | Velodyne 80-VLP-16-A | [Velodyne 80-VLP-16-A LiDAR Pucks](https://www.ebay.com/itm/186755704215) | $450.00 or best offer | Seller refurbished/tested | linneklocharl, 98.7%, Florence MT | More than 10 available, 70 sold | No returns | Buyable exact match |
| 33 | Ouster OS0-32 | [OUSTER LIDAR OS0-32 Brand New/P$](https://www.ebay.com/itm/226709433551) | $2,487.18 or best offer | New | autoservice001, about 98.9% | 2 available | Accessories not clear | Too expensive |
| 34 | Ouster OS1-64 | [OUSTER 3D LIDAR OUTDOOR MID-RANGE HIGH-RESOLUTION IMAGING LIDAR OS1-64-U](https://www.ebay.com/itm/355476545479) | $12,999.99 or best offer | New/open box | migcor_3921, 100%, Missouri | Not captured | 30-day seller-paid returns | Too expensive |
| 35 | DJI Zenmuse L1 | [DJI Zenmuse L1 LiDAR RGB Camera Module for Matrice 300/350 RTK](https://www.ebay.com/itm/286917638277) | $1,419.00 | Used, tested, 95% new | DJI Air Wander, 100%, China | 3 available, 3 sold | Camera/LiDAR module | Too expensive / drone-specific |
| 36 | DJI Zenmuse L2 | [DJI Zenmuse L2 LiDAR RGB Mapping Camera Module for Matrice 350/300 RTK](https://www.ebay.com/itm/406349428651) | $6,249.99, free SpeedPAK | Used, tested, 95% new | DJI Store, 99.8%, China | 3 available, 2 sold | Camera/LiDAR module | Too expensive / drone-specific |
| 37 | Drone payload | [Drone Lidar Geosun gAirhawk GS-MID40 All in One Unit RTK GNSS for Mapping, Livox](https://www.ebay.com/itm/398000698057) | $1,599.99 or best offer | Used | kafair_55, 100% | Not captured | Exact payload includes Livox MID40 lane | Bundle/salvage, too expensive for parts |
| 38 | Robot dog bundle | [Unitree Go2 Edu Plus Mid-360 Robot Dog](https://www.ebay.com/itm/157821425681) | $17,055.00 + $120.89 shipping | New | Futurology Store, 99.2%, Pennsylvania | Not captured | Full Go2 Edu Plus/Mid-360 bundle | Bundle, not a bargain |
| 39 | Robot dog suspicious | [Unitree Go2-Air Robot Dog](https://www.ebay.com/itm/377119741159) | $288.88 | New | 0-feedback seller, China | 5 available | Implausibly low for a full Go2 | Possible scam/noisy bundle |

## Search Lanes Completed

Exact models checked: Livox Mid-360, Livox Mid-360S, Hesai JT16, RoboSense E1R,
Unitree L1.

Adjacent candidates checked: Unitree L2, RoboSense Airy, RoboSense M1, Livox
Avia, Livox Horizon, Livox MID-70, Hesai XT16, Ouster OS0, Ouster OS1, Velodyne
VLP-16, DJI Zenmuse L1, DJI Zenmuse L2.

Used/salvage searches checked: used lidar robot, drone lidar, slam lidar,
mapping lidar, UGV lidar, robot dog lidar, Livox drone, DJI lidar payload.

## Correction: Title-Derived Breadth Sweep

The first pass over-weighted opened listing pages. For eBay market shape, the
right raw layer is broader: infer model family, likely sensor-vs-accessory, and
price directly from result titles/descriptions, then reserve opened-page checks
for final buy decisions. Rows below are title/result-derived observations from
additional eBay searches. They intentionally keep duplicates, noisy rows, and
accessory hits because that is what shows the actual eBay surface.

Searches represented here include: `Livox Mid-360`, `Livox Mid-360S`,
`Unitree L1`, `Unitree L2`, `Hesai JT16`, `Hesai XT16`, `Hesai XT32`,
`Hesai Pandar40P`, `RoboSense E1R`, `RoboSense Airy`, `RoboSense M1`,
`RoboSense RS-LiDAR-16`, `Livox Horizon`, `Livox MID-70`, `Livox MID-40`,
`Livox Avia`, `Velodyne VLP-16`, `Velodyne HDL-32E`, `Ouster OS0`,
`Ouster OS1`, `DJI Zenmuse L1`, `DJI Zenmuse L2`, `drone lidar`,
`robot dog lidar`, and `mapping lidar`.

| # | Search lane | Title-derived item | Visible price | Inferred class |
|---:|---|---|---:|---|
| 40 | Livox Mid-360 | New Livox Mid 360 Lidar 3D Minimal Detection Range for Self-driving Localization | $828.79 OBO | Sensor |
| 41 | Livox Mid-360 | New Livox Mid 360 Lidar 3D Minimal Detection Range for Self-driving Localization | $1,485.00 OBO | Sensor |
| 42 | Livox Mid-360 | Brand New Livox MID-360 3D LIDAR Sensors for mobile robot | $862.07 OBO | Sensor |
| 43 | Livox Mid-360 | 1 pc New Livox mid 360 3D Multi Line Lidar Fast Shipping via FedEx or DHL | $1,287.00 | Sensor |
| 44 | Livox Mid-360 | Livox Mid-360 LiDAR - Minimal Detection Range Original Sensor | price not visible in result | Sensor |
| 45 | Livox Mid-360 | 1PCS NEW Livox MID360 3D solid-state LiDAR DHL shipping | price not visible in result | Sensor |
| 46 | Livox Mid-360 | Livox Mid-360 LiDAR 360x59 FOV 40m Range 265g for Mobile Robots, main unit only | about $705.91 | Sensor, no accessories |
| 47 | Livox Mid-360S | Livox Mid-360S lidar Minimal Detection Range Original | $937.45 | Sensor |
| 48 | Livox Mid-360S | Livox Mid-360S lidar Minimal Detection Range Original | price not visible in result | Sensor |
| 49 | Livox Mid-360S | Livox Mid-360S 3D LiDAR Sensor Latest Gen 360 FOV for ROS Robotics AGV | $780.00 | Sensor |
| 50 | Livox Mid-360S | Livox MID-360S - Accessory | $693.90 | Sensor/accessory-labeled |
| 51 | Livox Mid-360S | Livox Mid-360S 360 LiDAR 59 FOV High-Res 3D Scanning Sensor | $925.99 OBO | Sensor |
| 52 | Unitree L1 | Unitree L1 PM 4D LiDAR Near Mint Condition 3D Depth Scanner Sensor | $235.00 | Sensor |
| 53 | Unitree L1 | Unitree 4D LiDAR Sensor - L1 Model - New/Open Box Free Shipping | $225.00 OBO | Out of stock / ended-like |
| 54 | Unitree L1 | Unitree L1 RM LiDAR (RM) | $499.99 OBO | Not current |
| 55 | Unitree L2 | Unitree 4D LiDAR L2 - Accessory | $416.34 | Sensor/accessory-labeled |
| 56 | Unitree L2 | Unitree L2 4D 3D Lidar Sensor Scanner - 360x90 30 meters | $824.99 | Sensor |
| 57 | Unitree L2 | Unitree 4D LiDAR L2 Laser Radar Sensor High Precision Environment Scanning New | $493.35 | Sensor |
| 58 | Unitree L2 | Unitree 4D LiDAR L2 High-Precision 360 Scanning LiDAR Sensor for Robotics | $394.60 total | Sensor |
| 59 | Unitree L2 | Unitree 4D LiDAR L2 360 Scanning LiDAR Sensor for Robotics | price not visible in result | Sensor |
| 60 | Unitree L2 | NEW Unitree 4D LiDAR L2 3D Laser Radar | price not visible in result | Sensor |
| 61 | Hesai JT16 | HESAI JT16 16-Channel LiDAR Sensor for Autonomous Vehicles Long-Range 3D Mapping | $799.00 | Sensor |
| 62 | Hesai JT16 | HESAI JT16 16-Channel LiDAR Sensor for Autonomous Vehicles Long-Range 3D Mapping, pre-owned related hit | $570.00 | Sensor / related-result price |
| 63 | Hesai XT16 | Hesai Pandar XT16 16-Channel 360 Spinning Mid-Range LiDAR | price not visible in result | Sensor |
| 64 | Hesai XT16 | HESAI PandarXT-16 16-Channel Medium-Range LiDAR Sensor Module 120m Range | $1,286.15 total | Sensor |
| 65 | Hesai XT16 | HESAI PandarXT-16 16Channel Medium-Range 3D LiDAR Sensor | price not visible in result | Sensor |
| 66 | Hesai XT32 | Hesai XT32 32-Channel 360 Spinning Long-Range Lidar Brand New Via FedEx | $2,499.00 OBO | Sensor |
| 67 | Hesai XT32 | Vip link Free Tax Hesai PandarXT 32 360 Spinning Long-Range Lidar Brand New | $1,929.45 OBO | Sensor |
| 68 | Hesai XT32 | Free Tax Hesai PandarXT 32 32-Channel 360 Spinning Long-Range Lidar Brand New | $2,031.17 OBO; coupon $1,931.17 | Sensor |
| 69 | Hesai XT32 | Hesai PandarXT 32 32-Channel 360 Spinning Long-Range Lidar Brand New Via FedEx | $2,122.20 OBO | Not current / related row |
| 70 | Hesai Pandar40P | 1pcs USED Hesai Pandar40P 40-Channel 360 Spinning Long-Range Lidar | $297.03 OBO | Sensor |
| 71 | Hesai Pandar40P | Hesai Pandar40P 40-Channel 360 Spinning Long-Range Lidar with WARRANTY fedex | $253.30 | Sensor |
| 72 | Hesai Pandar40P | 1pcs USED Hesai Pandar40P 40-Channel 360 Spinning Long-Range Lidar | $245.00 | Sensor |
| 73 | Hesai Pandar40P | 1pc USED Hesai Pandar40P 40-Channel 360 Spinning Long-Range Lidar | $246.00 OBO | Sensor |
| 74 | Hesai Pandar40P | Hesai Pandar40P 40-Channel 360 Spinning Long-Range Lidar with WARRANTY | $149.50 OBO | Ended / not current |
| 75 | Hesai Pandar40P | Hesai Pandar40P 40-Channel 360 Spinning Long-Rangefinder Lidar EXCELLENT W CASE | $2,000.00 OBO | Sensor / premium kit |
| 76 | Hesai Pandar40P | Hesai Pandar40P 40-Channel 360 Spinning Long-Range Lidar | $899.00 OBO | Sensor |
| 77 | Hesai Pandar40P | Hesai Pandar 40P 40-Channel 360 Spinning Long-Range Lidar Kit w case | $529.00 each; bulk to $497.26 | Sensor kit |
| 78 | Hesai QT64 | Hesai QT64 64line lidar sensor | price not visible in result | Sensor |
| 79 | RoboSense E1R | Robosense E1R Fully Solid-State Digital LiDAR for Robots | $1,099.00 | Sensor |
| 80 | RoboSense E1R | RoboSense E1R LiDAR, The First Fully Solid-State Digital LiDAR for Robots | about $2,862.93 | Sensor |
| 81 | RoboSense E1R | Robosense's Solid-state Digital 3D LiDAR E1R for Robots | $499.99 OBO | Used / likely scarce |
| 82 | RoboSense E1R | RoboSense E1R related listing in Unitree ended page | about $3,297.05 | Related/noisy |
| 83 | RoboSense Airy | Robosense Airy 96-Channel digital LiDAR Sensor for Autonomous Vehicles robot | price not visible in result | Sensor |
| 84 | RoboSense Airy | RoboSense Airy 96-Beam LiDAR Sensor A01-H Solid-state Beyond Livox Mid-360 | $726.00 | Sensor |
| 85 | RoboSense Airy | Robosense Airy Robot Sensor 96-line Digital 3D LiDAR 360x90 Ultra-wide angle | $1,149.00 each; bulk to $1,091.55 | Sensor |
| 86 | RoboSense Airy | Robosense Airy 96-Channel digital LiDAR Sensor for Autonomous Vehicles Robot | $1,159.00 | Sensor |
| 87 | RoboSense M1 | NEW RoboSense RS-LiDAR-M1 V3.2.0 M1 AUTOMOTIVE-GRADE SOLID-STATE LiDAR SENSOR | $1,350.00 OBO | Sensor |
| 88 | RoboSense M1 | Robosense RS-LiDAR-M1 | $1,199.00 OBO | Sensor |
| 89 | RoboSense M1 | RoboSense RS-LiDAR-M1 (200 m) Automotive-grade Solid-State LiDAR | $300.00 OBO | Sensor, high integration risk |
| 90 | RoboSense M1 | RoboSense RS-LiDAR-M1 v2 (200 m) Automotive-grade Solid-State LiDAR Lucid OEM | $600.00 OBO | Sensor, OEM integration risk |
| 91 | RoboSense M1 Plus | RoboSense M1 Plus 200-Meter LiDAR Platform Long Range Solid State Laser Radar | $1,507.50 total | Sensor |
| 92 | RoboSense RS-LiDAR-16 | ROBOSENSE RS-LiDAR-16 SENSOR NEW | $635.00 | Sensor |
| 93 | RoboSense RS-LiDAR-16 | RoboSense RS-LiDAR-16 LiDAR Sensor | $585.00 OBO | Sensor |
| 94 | RoboSense RS-LiDAR-16 | Robosense RS-LiDAR-16 advanced 3D LiDAR sensor is suitable for robots | $425.00 OBO | Sensor |
| 95 | RoboSense RS-LiDAR-16 | Duty-free 1PCS USED The Robosense RS-LiDAR-16 advanced Expedited Shipping | $451.25 OBO | Sensor |
| 96 | RoboSense RS-LiDAR-16 | RoboSense RS-LiDAR-16 3D 16-Line LiDAR Sensor Module Second Hand w/ 150m Range | about $610.41 | Sensor |
| 97 | RoboSense RS-LiDAR-16 | USED The Robosense RS-LiDAR-16 advanced 3D LiDAR sensor is suitable for robots | $566.10 | Sensor |
| 98 | RoboSense RS-LiDAR-32 | Robosense RS-LiDAR-32 3D LiDAR sensor is suitable for robots | $699.00 OBO | Sensor |
| 99 | RoboSense Ruby Lite | Robosense rs ruby lite 80 80-line LiDAR Sensor | price not visible in result | Sensor |
| 100 | Livox Horizon | Livox Horizon Lidar Sensor | $499.00 OBO | Sensor |
| 101 | Livox Horizon | Livox Horizon Lidar Sensor | $400.00 | Sensor |
| 102 | Livox Horizon | 1pcs Livox horizon LiDAR Brand new genuine 1 years warranty via DHL or FedEx | $1,899.00 OBO | Sensor |
| 103 | Livox Horizon | Livox Horizon Lidar Sensor (Lidar box only - picture shown) | $299.00 OBO | Sensor / incomplete |
| 104 | Livox Horizon | LIVOX Horizon LiDAR with Converter 2.0 hub accessories | price not visible in result | Sensor/accessories |
| 105 | Livox lot | Lot of Livox Horizon + Livox Tele-15 Lidar Sensor | price not visible in result | Lot / salvage |
| 106 | Livox MID-70 | Livox Mid-70 LiDAR 5 CM Minimal Detection Range Original In Stock (Brand New) | $1,299.00 OBO | Sensor |
| 107 | Livox MID-70 | Livox Mid-70 LiDAR - 70.4 FOV 260m Range 200k Pts/s IP67 | $719.00 OBO | Sensor |
| 108 | Livox MID-70 | New Livox Mid 70 Lidar 3D Minimal Detection Range for Self-driving Localization | $1,087.67 OBO | Sensor |
| 109 | Livox MID-70 | 1pcs used Livox MID-70 Laser Lidar Module with cable | $446.00 OBO | Sensor with cable |
| 110 | Livox MID-70 | Livox MID-70 3D LiDAR Sensor Converter and cable MID 70 | $473.14 total | Sensor with converter/cable |
| 111 | Livox MID-70 | Shipping Rates Vary by Country Livox MiD-70 Lidar Sensor w/Converter 2.0 cabling | $632.50 total | Sensor with cabling |
| 112 | Livox MID-70 | Livox Mid-70 LiDAR Sensor 70 Circular FOV 3D Laser Scanner | price not visible in result | Sensor |
| 113 | Livox MID-40 | Used Livox MID-40 Lidar 3D Minimal Detection Range for Self-driving Localization | $687.98 OBO | Sensor |
| 114 | Livox MID-40 | 1Pcs New Livox mid-40 LIDAR weight reduction modification for UAV and drones | $1,184.24 total | Sensor / UAV modified |
| 115 | Livox converter | Genuine Livox Converter for Mid-40 / Mid-100 LiDAR RJ45 Ethernet | $59.00 | Accessory |
| 116 | Livox hub | Livox Lidar Hub/Interface for Mid-40/Mid-100 | $50.00 OBO | Accessory |
| 117 | Livox hub | Livox Hub LiDAR Converter for Multi-LiDAR Sync & Ethernet Integration | $595.00 OBO | Accessory / hub |
| 118 | Livox Avia | Livox Avia Lidar Applicable to Electric Power, Forestry, Pan-mapping Brand new | price not visible in result | Sensor |
| 119 | Livox Avia | Livox Avia Lidar Applicable to Electric Power, Forestry, Pan-mapping (Brand new) | $1,999.00 OBO | Sensor |
| 120 | Livox Avia | Livox Avia LiDAR Sensor High-Precision 3D Laser Scanner 450m Range for UAV SLAM | $1,911.00 | Sensor |
| 121 | Livox Avia | Livox Avia High-Performance LiDAR Sensor Laser Radar 3D Mapping & Robotics & Drone | $1,969.00 each | Sensor |
| 122 | Livox Avia | Livox Avia Lidar - 3D mapping / Drone mapping (Brand new in plastic) | $1,350.00 OBO | Sensor |
| 123 | Livox Avia | Livox Avia Lidar Applicable to Electric Power, Forestry, Pan-mapping Brand new#H | $1,960.20 OBO | Sensor |
| 124 | Livox HAP | Livox HAP Lidar | $1,798.00 | Sensor |
| 125 | Velodyne VLP-16 | Velodyne VLP-16 Puck LiDAR Sensor | $276.50; bulk to $221.20 | Sensor |
| 126 | Velodyne VLP-16 | 3D 16 line LiDAR VLP-16 PUCK lidar sensor Velodyne-16 | price not visible in result | Sensor |
| 127 | Velodyne VLP-16 | Velodyne 80-VLP-16-A LiDAR Pucks | $450.00; bulk to $373.50 | Sensor |
| 128 | Velodyne VLP-16 | Velodyne LiDAR VLP-16 USB | $99.99 OBO | Sensor / maybe interface variant |
| 129 | Velodyne VLP-16 | Velodyne VLP-16 Puck Lidar Sensor 816301020896 | price not visible in result | Sensor |
| 130 | Velodyne VLP-16 | Velodyne VLP 16 80-VLP-16-LW-A lidar Sensor Puck LITE | price not visible in result | Sensor |
| 131 | Velodyne VLP-16 | VLP-16 1PC Used Velodyne LiDAR VLP-16/Puck | price not visible in result | Sensor |
| 132 | Velodyne HDL-32E | HDL-32E 1pcs Velodyne lidar HDL-32E Autonomous driving onboard radar M12 | $452.95 OBO | Sensor |
| 133 | Velodyne HDL-32E | HDL-32E 1pcs Velodyne lidar HDL-32E Autonomous driving onboard radar M12 | $439.36 | Sensor |
| 134 | Velodyne HDL-32E | HDL-32E 1pcs Velodyne lidar HDL-32E Autonomous driving onboard radar M12 | $442.95 | Sensor |
| 135 | Velodyne HDL-32E | Velodyne HDL-32e Lidar Sensor - Good condition | price not visible in result | Sensor |
| 136 | Velodyne adapter | VELODYNE CABLE ADAPTER HDL32 HIGH DEFINITION LIDAR | price not visible; related HDL-32E $452.95 | Accessory/noisy |
| 137 | Ouster OS0 | OUSTER LIDAR OS0-32 Brand New/P$ | $2,487.18 OBO | Sensor |
| 138 | Ouster OS0 | USED OUSTER LiDAR Sensor OS0-128-U | $2,900.00 OBO | Sensor |
| 139 | Ouster OS0 | Ouster OS0-128-U 3D Lidar With Base | $1,999.99 OBO | Sensor |
| 140 | Ouster OS0 | OUSTER OS0-32 LIDAR OS0-32 | $7,218.67 | Sensor |
| 141 | Ouster OS0 | OUSTER LIDAR OS0-32 Brand New 1PCS | $2,355.74 OBO | Sensor |
| 142 | Ouster OS0 | OUSTER LIDAR OS0-32 Brand New 1PCS | $2,374.00 OBO | Sensor |
| 143 | Ouster OS1 | OUSTER 3D LIDAR OUTDOOR MID-RANGE HIGH-RESOLUTION IMAGING LIDAR OS1-64-U | $12,999.99 OBO | Sensor |
| 144 | Ouster OS1 | 1pc Ouster OS1-32 new LIDAR Sensor | price not visible in result | Sensor |
| 145 | Ouster OS1 | Ouster OS1 64 Lidar OS1-64 Version REV 6.2 | price not visible in result | Sensor |
| 146 | Ouster OS1 | Ouster OS1-128 Lidar Sensor brand new #g | $6,311.25 OBO | Sensor |
| 147 | Ouster OS1 | OUSTER LIDAR OS1 32 Brand New | $3,599.00 OBO | Sensor |
| 148 | Ouster OS1 | Test OK used Ouster 128-line LiDAR, medium-range OS1-128-U | $5,360.55 OBO | Sensor |
| 149 | Ouster OS1 | Ouster OS1-128 Rev7 Uniform LiDar Sensor, Opened, Never Deployed | $6,900.00 OBO | Sensor |
| 150 | DJI Zenmuse L1 | DJI Zenmuse L1 LiDAR RGB Camera Module for Matrice 300/350 RTK | $1,419.00 | Drone payload |
| 151 | DJI Zenmuse L1 | DJI Zenmuse L1 LiDAR RGB Mapping Camera for DJI Matrice 300 RTK/350 RTK Drones | $3,497.00 | Drone payload |
| 152 | DJI Zenmuse L1 | DJI Zenmuse L1 In Good Condition | price not visible in result | Drone payload |
| 153 | DJI Zenmuse L1 | DJI ZENMUSE L1 LIDAR CAMERA. DEMO UNIT - EXCELLENT CONDITION | $1,995.00 OBO | Ended / drone payload |
| 154 | DJI Zenmuse L1 | DJI Zenmuse L1 Lidar+RGB Surveying Solution Ship Via FedEx Free Tariff To US | $3,515.99 | Drone payload |
| 155 | DJI Zenmuse L2 | DJI Zenmuse L2 LiDAR Camera with Care Enterprise Basic | $24,999.00 | Drone payload |
| 156 | DJI Zenmuse L2 | DJI ZENMUSE L2 High-Precision Aerial LiDAR System For Matrice 300/350 RTK | $9,999.98 | Drone payload |
| 157 | DJI Zenmuse L2 | DJI ZENMUSE L2 High-Precision Aerial LiDAR System Free Tariff To US | price not visible in result | Drone payload |
| 158 | DJI Zenmuse L2 | DJI Zenmuse L2 LiDAR RGB Mapping Camera Module for Matrice 350/300 RTK | $6,249.99 | Drone payload |
| 159 | DJI Zenmuse L3 | DJI Zenmuse L3 - Long Range LiDAR System Payload | $17,400.00 | Drone payload |
| 160 | Drone payload | Drone Lidar Geosun gAirhawk GS-MID40 All in One Unit RTK GNSS for Mapping, Livox | includes Livox Mid-40; price not visible in result here | Bundle/payload |
| 161 | Robot dog | Yahboom 12DOF Metal Robot Dog DOGZILLA with Camera, Lidar | price not visible in result | Robot bundle |
| 162 | Robot dog | Lite 3L YUNSHENCHU LiDAR Bionic Quadruped Robot Dog High Driving Force | $16,218.19 OBO | Robot bundle |
| 163 | Robot dog | Unitree Go2-Air Robot Dog | $288.88 in previous row; result title says L1 lidar | Noisy/suspicious |
| 164 | Robot dog | Go2-Air Bionic Quadruped Robot Dog Ultra-wide 4D LIDAR | price not visible in result | Robot bundle |
| 165 | Robot dog | Go2-Pro Bionic Quadruped Robot Dog Voice Interaction Ultra-wide 4D LIDAR Robot | $5,599.00 OBO | Robot bundle |
| 166 | Robot vacuum | iHome AutoVac Nova S1 Robot Vacuum, Lidar Navigation 2600Pa Suction | $39.99 OBO | Consumer 2D/noisy |

## Duplicate / Noisy Hit Notes

- Livox Mid-360 and Mid-360S have many repeated China listings clustered around
  the same sellers and price bands. Treat the lower Mid-360 eBay baseline as
  roughly **$700 used/open box US** or **$725-$830+ China/new** before tax.
- Unitree L1 is scarce as a standalone current listing; most "Unitree L1" search
  results are actually L2 listings or ended L1 rows.
- DJI Zenmuse L1/L2 and full drone mapping payloads are real LiDAR hits, but
  they are survey/drone systems. They do not solve the Beast standalone-LiDAR
  budget unless the goal changes to drone payload salvage.
- Robot dog listings are noisy. Real Mid-360-equipped Go2 Edu bundles are
  five-figure listings; sub-$400 "Go2-Air Robot Dog" pages from zero-feedback
  sellers should not be treated as real sensor offloads.

## Recommendation For Hangar `standalone-lidar`

Keep Mid-360 as the cleanest software/integration target, but stop treating
`$500 class` as the only practical eBay price lane. A better planning split is:

- **Default/integration target:** Livox Mid-360, expected eBay total about
  `$700-$830+`.
- **Cheap robot-native experiment:** Unitree L2, expected eBay total about
  `$365-$420`, pending SDK/ROS validation.
- **Cheap used mechanical SLAM lane:** Velodyne VLP-16, expected eBay total
  about `$190-$450`, with age/condition/cabling burden.
- **Used Livox legacy lane:** Livox Horizon/MID-40/MID-70, expected eBay total
  about `$400-$720`, useful if cabling and driver support are acceptable.

Do not update `src/data/hangar.ts` from this scan without a separate decision:
the current result is market research, not an accepted purchase target.
