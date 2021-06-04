import { LastGoodPriceUpdated } from "../../generated/PriceFeed/PriceFeed";

import { updatePrice } from "../entities/SystemState";

export function handleLastGoodPriceUpdated(event: LastGoodPriceUpdated): void {
  updatePrice(event, event.params._lastGoodPrice);
}
