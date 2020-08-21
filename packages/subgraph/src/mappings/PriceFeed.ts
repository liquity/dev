import { PriceUpdated } from "../../generated/templates/PriceFeed/PriceFeed";

import { updatePrice } from "../entities/System";

export function handlePriceUpdated(event: PriceUpdated): void {
  updatePrice(event, event.params._newPrice);
}
