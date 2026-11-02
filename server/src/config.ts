// All settings come from environment variables. See ../.env.example
export const config = {
  port: Number(process.env.PORT ?? 8080),
  // Public URL of this server (used in Idram links and in the app)
  publicUrl: process.env.PUBLIC_URL ?? "http://localhost:8080",
  dbFile: process.env.DB_FILE ?? "hovo.db",
  // Folder with the built web app (PWA). When set, the server also serves the app at "/".
  webDir: process.env.WEB_DIR ?? "",

  idram: {
    // When true, a fake payment page is shown instead of Idram (for development).
    mock: (process.env.IDRAM_MOCK ?? "1") === "1",
    recAccount: process.env.IDRAM_REC_ACCOUNT ?? "",
    secretKey: process.env.IDRAM_SECRET_KEY ?? "",
    paymentUrl: process.env.IDRAM_PAYMENT_URL ?? "https://banking.idram.am/Payment/GetPayment",
    language: process.env.IDRAM_LANGUAGE ?? "AM", // AM | RU | EN
  },

  // Bank card acquiring through an RBS-type gateway (ArCa iPay is used by most Armenian banks:
  // Ardshinbank, Inecobank, Converse, ACBA, Evocabank ...). Credentials are issued by the acquiring bank.
  card: {
    mock: (process.env.CARD_MOCK ?? "1") === "1",
    gatewayUrl: process.env.CARD_GATEWAY_URL ?? "https://ipay.arca.am/payment/rest", // test: https://ipaytest.arca.am:8445/payment/rest
    username: process.env.CARD_GATEWAY_USERNAME ?? "",
    password: process.env.CARD_GATEWAY_PASSWORD ?? "",
    currency: process.env.CARD_CURRENCY ?? "051", // AMD (ISO 4217 numeric)
    verifyAmount: Number(process.env.CARD_VERIFY_AMOUNT ?? 10), // AMD charged then reversed when linking a card
  },

  billing: {
    minAmount: Number(process.env.MIN_AMOUNT ?? 500), // AMD
    maxAmount: Number(process.env.MAX_AMOUNT ?? 50000), // AMD
  },

  // Seed data used on first start (one station, two connectors).
  seed: {
    stationId: process.env.SEED_STATION_ID ?? "HOVO-001",
    stationName: process.env.SEED_STATION_NAME ?? "Hovo Power Station",
    stationAddress: process.env.SEED_STATION_ADDRESS ?? "Yerevan",
    pricePerKwh: Number(process.env.SEED_PRICE_PER_KWH ?? 120), // AMD per kWh
    connectors: Number(process.env.SEED_CONNECTORS ?? 2),
    lat: Number(process.env.SEED_LAT ?? 40.1772), // Yerevan center; set the real coordinates
    lng: Number(process.env.SEED_LNG ?? 44.5035),
  },
};
