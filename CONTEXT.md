# Soldering app — Domain Glossary

## Core Concepts

**PCB (Printed Circuit Board)** — A single board loaded into the soldering workspace. Each PCB has drill data, a toolpath, position/rotation, and origin offset.

**PCB Tray** — The collection of all loaded PCBs. PCBs are processed in list order during printing.

**Active PCB** — The currently selected PCB in the Path tab sidebar. Edits apply to this PCB.

**Drill Space** — The coordinate system native to the drill file (mm from file origin). Points exist here before transformation.

**Bed Space** — The physical build plate coordinate system (0,0 to 235,235mm for Ender-3). All G-code coordinates are in bed space.

**Origin Offset** — The translation from drill space to bed space. Set per-PCB via `originOffsetX` and `originOffsetY`. Represents where the PCB's reference point sits on the build plate.

**Machine Origin** — The printer's home position (0,0,0) after G28. All bed-space coordinates are relative to this.

**No-Go Zone** — An exclusion area on the build plate that the toolpath must route around. Can be global (applies to all PCBs) or per-PCB.

## Path Concepts

**Path** — The ordered sequence of drill point IDs to be soldered. Built per-PCB, executed across all PCBs during printing.

**Path Optimization** — DFS (depth-first search) with left-move constraint pruning. For boards with >15 solder points, auto-clusters points using k-means, then optimizes each cluster independently with DFS, then optimizes cluster order with DFS on centroids. Runs in a worker thread for performance.

**Solder Point** — A drill point flagged for soldering (has `solder: true`). Points not in the path are skipped during printing.

## Clustering Concepts

**Auto-Clustering** — Automatic board sectioning using k-means algorithm. Triggered when solder point count exceeds 15. Groups nearby points into clusters of ~8 points each for independent optimization.

**Soft Boundary** — Points within a configurable distance (default 5mm) of an adjacent cluster are shared between clusters. This prevents suboptimal paths at cluster edges.

**Cluster Order** — The sequence in which optimized clusters are visited. Optimized using BFS on cluster centroids to find the shortest route between clusters.

## G-code Concepts

**Safe-Z Lift** — The Z height the iron lifts to between moves (`startSafeZ`, `solderSafeZ`, `endSafeZ`). Prevents collisions.

**Per-Point Template** — G-code template executed for each solder point. Variables: `{X}`, `{Y}`, `{SOAK}`, `{FEED}`, `{DWELL}`, `{PRIME}`, etc.

**Between-Board G-code** — G-code executed when transitioning between PCBs (typically a safe-Z lift).

**Periodic G-code** — G-code executed every N holes (configurable interval).

## Printer Control Concepts

**Jog** — Manual movement of the printer head via the jog wheel/bar. Uses relative G91 moves.

**Origin Setting** — The process of aligning a PCB's coordinate system with the printer. Involves homing, jogging to the PCB's first drill point, and confirming the position.

**Stepper Timeout Disable** — M17 S0 command that keeps steppers energized indefinitely, preventing position loss during extended operations.

**Flow Control** — Marlin's ok-protocol: send one line, wait for `ok` response, send next. Prevents serial buffer overflow.

**Feed Override** — Real-time speed multiplier (M220) applied to all moves. Range: 0-200%, default 100%.

**Emergency Stop** — Immediate motor disable (M84) and serial disconnect. Position is lost. Requires re-homing.

## Printer State

**Disconnected** — No serial connection. Default state.

**Connected** — Serial port open, firmware handshake (M115) complete.

**Homed** — Printer has executed G28. Position is known.

**Printing** — G-code is being streamed to the printer.

**Paused** — Print paused (motors disabled via M84). Resume requires M17 + G28.

## UI Concepts

**Path Tab** — The default tab for loading files, positioning PCBs, selecting points, optimizing paths, and simulating.

**Print Tab** — The tab for connecting to the printer, jogging, setting origins, and running prints.

**Jog Wheel** — Concentric circle SVG control for XY movement. 6 rings (0.1, 1, 5, 10, 50, 100mm) × 4 quadrants.

**Jog Bar** — Vertical Z-axis control with linear layers (0.1, 1, 5, 10, 50mm).

**Origin Modal** — Per-PCB modal for setting the origin. Requires homing first, then jogging to the target position.

**Calibrate Tab** — Standalone tab between Path and Print for calibrating solder feed and per-pad offsets. Three-column layout: pad size list (left), PCB canvas (center), extrude bar + jog controls (right). Requires printer connection. Updates Lagrange curves on confirm.

**Feed Calibration** — Process of determining the correct solder extrusion amount for a given pad size. User runs the solder sequence up to the feed step, then manually extrudes via a slider bar until the joint looks right. The calibrated value is stored in the Lagrange curve at that pad's area.

**Offset Calibration** — Process of determining the correct X/Y/Z offset for a specific pad. User jogs to the pad position (elevated), then jogs down to the correct position. The delta is saved as the pad's offset in the Lagrange curve.
