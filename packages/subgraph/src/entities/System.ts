import { System, TroveChange } from "../../generated/schema";

const onlySystemId = "only";

function getSystem(): System {
  let systemOrNull = System.load(onlySystemId);

  if (systemOrNull != null) {
    return systemOrNull as System;
  } else {
    let newSystem = new System(onlySystemId);

    newSystem.troveChangeCount = 0;
    return newSystem;
  }
}

export function createTroveChange(id: string): TroveChange {
  let system = getSystem();

  let troveChange = new TroveChange(id);
  troveChange.sequenceNumber = system.troveChangeCount++;
  system.save();

  return troveChange;
}
