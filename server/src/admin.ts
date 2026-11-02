// Manage stations from the command line.
//   node src/admin.ts list
//   node src/admin.ts add --id HOVO-002 --name "Hovo Gyumri" --address "Gyumri, ..." --lat 40.79 --lng 43.84 --price 120 --connectors 2
//   node src/admin.ts set --id HOVO-001 --lat 40.18 --lng 44.51 --price 130
// The --id must equal the chargePointId the charger uses in its OCPP URL.
import { parseArgs } from "node:util";
import { db, q } from "./db.ts";

const { positionals, values: v } = parseArgs({
  allowPositionals: true,
  options: {
    id: { type: "string" }, name: { type: "string" }, address: { type: "string" },
    lat: { type: "string" }, lng: { type: "string" }, price: { type: "string" }, connectors: { type: "string" },
  },
});

const cmd = positionals[0];
if (cmd === "list") {
  console.table(q.stations().map((s) => ({ ...s, connectors: q.connectors(s.id).length })));
} else if (cmd === "add") {
  if (!v.id || !v.name || !v.price) throw new Error("--id, --name and --price are required");
  db.prepare("INSERT INTO stations (id, name, address, price_per_kwh, lat, lng) VALUES (?, ?, ?, ?, ?, ?)").run(
    v.id, v.name, v.address ?? "", Number(v.price), v.lat ? Number(v.lat) : null, v.lng ? Number(v.lng) : null,
  );
  for (let c = 1; c <= Number(v.connectors ?? 1); c++) {
    db.prepare("INSERT INTO connectors (station_id, connector_id) VALUES (?, ?)").run(v.id, c);
  }
  console.log("added", v.id);
} else if (cmd === "set") {
  if (!v.id || !q.station(v.id)) throw new Error("unknown --id");
  const cols: Record<string, string | number | undefined> = {
    name: v.name, address: v.address, lat: v.lat && Number(v.lat), lng: v.lng && Number(v.lng),
    price_per_kwh: v.price && Number(v.price),
  };
  for (const [col, val] of Object.entries(cols)) {
    if (val !== undefined && val !== "") db.prepare(`UPDATE stations SET ${col} = ? WHERE id = ?`).run(val, v.id);
  }
  console.log("updated", v.id);
} else {
  console.log("usage: node src/admin.ts list | add ... | set ...");
}
