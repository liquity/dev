/** @internal */
export const proxify = <T, U>(
  t: new (...args: never[]) => T,
  u: new (...args: never[]) => U,
  f: (method: keyof U) => (this: T, ...args: unknown[]) => unknown
): void => {
  Object.assign(
    t.prototype,
    Object.fromEntries(
      Object.getOwnPropertyNames(u.prototype)
        .filter(method => method !== "constructor")
        .map(method => [method, f(method as keyof U)])
    )
  );
};

type BunchOfMethods = Record<string, (...args: unknown[]) => unknown>;

/** @internal */
export function _glue<T, U>(
  t: new (...args: never[]) => T,
  u: new (...args: never[]) => U
): new (t: T, u: U) => T & U;

/** @internal */
export function _glue<T, U, V>(
  t: new (...args: never[]) => T,
  u: new (...args: never[]) => U,
  v: new (...args: never[]) => V
): new (t: T, u: U, v: V) => T & U & V;

/** @internal */
export function _glue<T, U, V, W>(
  t: new (...args: never[]) => T,
  u: new (...args: never[]) => U,
  v: new (...args: never[]) => V,
  w: new (...args: never[]) => W
): new (t: T, u: U, v: V, w: W) => T & U & V & W;

/** @internal */
export function _glue(
  ...constructors: (new (...args: never[]) => BunchOfMethods)[]
): new (...instances: BunchOfMethods[]) => unknown {
  const Glued = class {
    _instances: BunchOfMethods[];

    constructor(...instances: BunchOfMethods[]) {
      this._instances = instances;
    }
  };

  constructors.forEach((ctor, i) =>
    proxify(
      Glued,
      ctor,
      method =>
        function (...args) {
          return this._instances[i][method].call(this._instances[i], ...args);
        }
    )
  );

  return Glued;
}
