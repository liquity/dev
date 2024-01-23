"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.goerli = exports.mainnet = void 0;
const mainnet_json_1 = __importDefault(require("./mainnet.json"));
exports.mainnet = mainnet_json_1.default;
const goerli_json_1 = __importDefault(require("./goerli.json"));
exports.goerli = goerli_json_1.default;
