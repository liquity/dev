import { AddressZero } from "@ethersproject/constants";
import { isAddress, getAddress } from "@ethersproject/address";

export type LiquityFrontendConfig = {
  frontendTag: string;
  infuraApiKey?: string;
  testnetOnly?: boolean;
};

const defaultConfig: LiquityFrontendConfig = {
  frontendTag: AddressZero
};

function hasKey<K extends string>(o: object, k: K): o is Record<K, unknown> {
  return k in o;
}

const parseConfig = (json: unknown): LiquityFrontendConfig => {
  const config = { ...defaultConfig };

  if (typeof json === "object" && json !== null) {
    if (hasKey(json, "frontendTag") && json.frontendTag !== "") {
      const { frontendTag } = json;

      if (typeof frontendTag === "string" && isAddress(frontendTag)) {
        config.frontendTag = getAddress(frontendTag);
      } else {
        console.error("Malformed frontendTag:");
        console.log(frontendTag);
      }
    }

    if (hasKey(json, "infuraApiKey") && json.infuraApiKey !== "") {
      const { infuraApiKey } = json;

      if (typeof infuraApiKey === "string") {
        config.infuraApiKey = infuraApiKey;
      } else {
        console.error("Malformed infuraApiKey:");
        console.log(infuraApiKey);
      }
    }

    if (hasKey(json, "testnetOnly")) {
      const { testnetOnly } = json;

      if (typeof testnetOnly === "boolean") {
        config.testnetOnly = testnetOnly;
      } else {
        console.error("Malformed testnetOnly:");
        console.log(testnetOnly);
      }
    }
  } else {
    console.error("Malformed config:");
    console.log(json);
  }

  return config;
};

let configPromise: Promise<LiquityFrontendConfig> | undefined = undefined;

const fetchConfig = async () => {
  try {
    const response = await fetch("config.json");

    if (!response.ok) {
      throw new Error(`Failed to fetch config.json (status ${response.status})`);
    }

    return parseConfig(await response.json());
  } catch (err) {
    return { ...defaultConfig };
  }
};

export const getConfig = (): Promise<LiquityFrontendConfig> => {
  if (!configPromise) {
    configPromise = fetchConfig();
  }

  return configPromise;
};
