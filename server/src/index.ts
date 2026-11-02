import { createServer } from "node:http";
import express from "express";
import { config } from "./config.ts";
import "./db.ts";
import { api } from "./api.ts";
import { idramRouter, markPaid } from "./idram.ts";
import { cardRouter } from "./card.ts";
import { attachOcpp } from "./ocpp.ts";

const app = express();
app.set("trust proxy", true);
app.get("/health", (_req, res) => res.json({ ok: true }));
app.use("/api", api);
app.use(idramRouter);
app.use(cardRouter(markPaid));

const server = createServer(app);
attachOcpp(server);
server.listen(config.port, () => {
  console.log(`Hovo server on :${config.port}`);
  console.log(`  API:   ${config.publicUrl}/api`);
  console.log(`  OCPP:  ${config.publicUrl.replace(/^http/, "ws")}/ocpp/<chargePointId>`);
  console.log(`  Idram: ${config.idram.mock ? "MOCK mode" : "live, account " + config.idram.recAccount}`);
  console.log(`  Cards: ${config.card.mock ? "MOCK mode" : "live, " + config.card.gatewayUrl}`);
});
