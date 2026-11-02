import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "hy" | "ru" | "en";

const dict = {
  appName: { hy: "Hovo Power", ru: "Hovo Power", en: "Hovo Power" },
  balance: { hy: "Հաշվեկշիռ", ru: "Баланс", en: "Balance" },
  scanQr: { hy: "Սկանավորել QR կոդը", ru: "Сканировать QR-код", en: "Scan QR code" },
  orEnterCode: { hy: "կամ մուտքագրեք կայանի կոդը", ru: "или введите код станции", en: "or enter station code" },
  open: { hy: "Բացել", ru: "Открыть", en: "Open" },
  history: { hy: "Պատմություն", ru: "История", en: "History" },
  activeCharging: { hy: "Ընթացիկ լիցքավորում", ru: "Идёт зарядка", en: "Charging now" },
  station: { hy: "Կայան", ru: "Станция", en: "Station" },
  connector: { hy: "Միակցիչ", ru: "Разъём", en: "Connector" },
  chooseConnector: { hy: "Ընտրեք միակցիչը", ru: "Выберите разъём", en: "Choose connector" },
  chooseAmount: { hy: "Գումարը", ru: "Сумма", en: "Amount" },
  price: { hy: "Գին", ru: "Цена", en: "Price" },
  perKwh: { hy: "֏/կՎտ·ժ", ru: "֏/кВт·ч", en: "֏/kWh" },
  approx: { hy: "մոտ", ru: "примерно", en: "about" },
  kwh: { hy: "կՎտ·ժ", ru: "кВт·ч", en: "kWh" },
  kw: { hy: "կՎտ", ru: "кВт", en: "kW" },
  payIdram: { hy: "Վճարել Idram-ով", ru: "Оплатить через Idram", en: "Pay with Idram" },
  startFromBalance: { hy: "Սկսել հաշվեկշռից", ru: "Начать с баланса", en: "Start from balance" },
  fromBalanceNote: { hy: "Հաշվեկշռից կգանձվի", ru: "С баланса спишется", en: "From balance" },
  offline: { hy: "Կայանը անցանց է", ru: "Станция не в сети", en: "Station is offline" },
  free: { hy: "Ազատ", ru: "Свободен", en: "Available" },
  busy: { hy: "Զբաղված", ru: "Занят", en: "Busy" },
  unavailable: { hy: "Անհասանելի", ru: "Недоступен", en: "Unavailable" },
  freeOf: { hy: "ազատ", ru: "свободно", en: "free" },
  route: { hy: "Երթուղի", ru: "Маршрут", en: "Route" },
  select: { hy: "Ընտրել", ru: "Выбрать", en: "Select" },
  myLocation: { hy: "Իմ դիրքը", ru: "Где я", en: "My location" },
  stations: { hy: "Կայաններ", ru: "Станции", en: "Stations" },
  payment: { hy: "Վճարում", ru: "Оплата", en: "Payment" },
  waitingPayment: { hy: "Սպասում ենք վճարման հաստատմանը…", ru: "Ждём подтверждение оплаты…", en: "Waiting for payment confirmation…" },
  paymentCancelled: { hy: "Վճարումը չեղարկվեց", ru: "Оплата отменена", en: "Payment cancelled" },
  session: { hy: "Լիցքավորում", ru: "Зарядка", en: "Charging" },
  st_starting: { hy: "Միացրեք մալուխը մեքենային", ru: "Подключите кабель к машине", en: "Plug the cable into the car" },
  st_charging: { hy: "Լիցքավորվում է", ru: "Заряжается", en: "Charging" },
  st_stopping: { hy: "Կանգնեցվում է…", ru: "Останавливаем…", en: "Stopping…" },
  st_finished: { hy: "Ավարտված է", ru: "Завершено", en: "Finished" },
  st_failed: { hy: "Չհաջողվեց", ru: "Не удалось", en: "Failed" },
  energy: { hy: "Էներգիա", ru: "Энергия", en: "Energy" },
  power: { hy: "Հզորություն", ru: "Мощность", en: "Power" },
  cost: { hy: "Արժեք", ru: "Стоимость", en: "Cost" },
  paid: { hy: "Վճարված", ru: "Оплачено", en: "Paid" },
  time: { hy: "Ժամանակ", ru: "Время", en: "Time" },
  stop: { hy: "Կանգնեցնել", ru: "Остановить", en: "Stop" },
  cancel: { hy: "Չեղարկել", ru: "Отменить", en: "Cancel" },
  stopConfirm: { hy: "Կանգնեցնե՞լ լիցքավորումը", ru: "Остановить зарядку?", en: "Stop charging?" },
  yes: { hy: "Այո", ru: "Да", en: "Yes" },
  no: { hy: "Ոչ", ru: "Нет", en: "No" },
  returned: { hy: "Վերադարձվել է հաշվեկշռին", ru: "Возвращено на баланс", en: "Returned to balance" },
  done: { hy: "Պատրաստ է", ru: "Готово", en: "Done" },
  noHistory: { hy: "Դեռ լիցքավորումներ չկան", ru: "Зарядок пока не было", en: "No charging sessions yet" },
  cameraNeeded: { hy: "Թույլատրեք տեսախցիկը QR-ի համար", ru: "Разрешите доступ к камере для QR", en: "Allow camera access to scan QR" },
  allow: { hy: "Թույլատրել", ru: "Разрешить", en: "Allow" },
  pointCamera: { hy: "Ուղղեք տեսախցիկը կայանի QR կոդին", ru: "Наведите камеру на QR-код станции", en: "Point the camera at the station QR" },
  badQr: { hy: "Սա Hovo կայանի QR չէ", ru: "Это не QR-код станции Hovo", en: "Not a Hovo station QR code" },
  retry: { hy: "Կրկնել", ru: "Повторить", en: "Retry" },
  err_network: { hy: "Կապ չկա սերվերի հետ", ru: "Нет связи с сервером", en: "Can't reach the server" },
  err_station_not_found: { hy: "Կայանը չի գտնվել", ru: "Станция не найдена", en: "Station not found" },
  err_station_offline: { hy: "Կայանը անցանց է", ru: "Станция не в сети", en: "Station is offline" },
  err_connector_busy: { hy: "Միակցիչը զբաղված է", ru: "Разъём занят", en: "Connector is busy" },
  err_bad_amount: { hy: "Սխալ գումար", ru: "Неверная сумма", en: "Invalid amount" },
  err_generic: { hy: "Սխալ, փորձեք կրկին", ru: "Ошибка, попробуйте ещё раз", en: "Something went wrong" },
  reason_not_plugged_in: { hy: "Մալուխը չմիացվեց, գումարը վերադարձվեց", ru: "Кабель не подключили, деньги вернулись на баланс", en: "Cable not plugged in, money returned" },
  reason_budget_reached: { hy: "Վճարված գումարը սպառվեց", ru: "Оплаченная сумма израсходована", en: "Paid amount used up" },
  payWith: { hy: "Վճարման եղանակ", ru: "Способ оплаты", en: "Pay with" },
  idram: { hy: "Idram", ru: "Idram", en: "Idram" },
  addCard: { hy: "+ Կցել քարտ", ru: "+ Привязать карту", en: "+ Add card" },
  myCards: { hy: "Իմ քարտերը", ru: "Мои карты", en: "My cards" },
  noCards: { hy: "Կցված քարտեր չկան", ru: "Привязанных карт нет", en: "No saved cards" },
  deleteCard: { hy: "Ջնջե՞լ քարտը", ru: "Удалить карту?", en: "Remove card?" },
  cardLinked: { hy: "Քարտը կցված է", ru: "Карта привязана", en: "Card added" },
  cardFailed: { hy: "Չհաջողվեց կցել քարտը", ru: "Не удалось привязать карту", en: "Couldn't add the card" },
  cardNote: { hy: "Ստուգման համար կգանձվի և անմիջապես կվերադարձվի 10 ֏", ru: "Для проверки спишется и сразу вернётся 10 ֏", en: "10 ֏ is charged and refunded right away to verify the card" },
  payCard: { hy: "Վճարել քարտով", ru: "Оплатить картой", en: "Pay by card" },
  err_card_not_found: { hy: "Քարտը չի գտնվել", ru: "Карта не найдена", en: "Card not found" },
  err_gateway_error: { hy: "Բանկը չպատասխանեց, փորձեք կրկին", ru: "Банк не ответил, попробуйте ещё раз", en: "The bank didn't respond, try again" },
  language: { hy: "Լեզու", ru: "Язык", en: "Language" },
} as const;

export type Key = keyof typeof dict;

const Ctx = createContext<{ lang: Lang; setLang: (l: Lang) => void; t: (k: Key) => string }>({
  lang: "hy",
  setLang: () => {},
  t: (k) => dict[k].hy,
});

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("hy");
  useEffect(() => {
    AsyncStorage.getItem("hovo.lang").then((l) => {
      if (l === "hy" || l === "ru" || l === "en") setLangState(l);
    }).catch(() => {});
  }, []);
  const setLang = (l: Lang) => {
    setLangState(l);
    AsyncStorage.setItem("hovo.lang", l).catch(() => {});
  };
  return <Ctx.Provider value={{ lang, setLang, t: (k) => dict[k]?.[lang] ?? "" }}>{children}</Ctx.Provider>;
}

export const useT = () => useContext(Ctx);

export const hasKey = (k: string): k is Key => k in dict;

export function errorText(t: (k: Key) => string, code: string) {
  const key = ("err_" + code) as Key;
  return key in dict ? t(key) : t("err_generic");
}
