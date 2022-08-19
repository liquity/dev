import React from "react";
import { InfoMessage } from "../../../InfoMessage";
import { NOT_BONDED_YET } from "../../lexicon";

export const Empty: React.FC = () => {
  return <InfoMessage title={NOT_BONDED_YET.term}>{NOT_BONDED_YET.description}</InfoMessage>;
};
