type UnknownObject = Record<string, unknown>;

const hasOwnProperty = (o: UnknownObject, key: string) =>
  Object.prototype.hasOwnProperty.call(o, key);

const shallowEquals = (a: UnknownObject, b: UnknownObject) => {
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  return (
    keysA.length === keysB.length &&
    keysA.every(key => hasOwnProperty(b, key) && Object.is(a[key], b[key]))
  );
};

const isObject = (a: unknown): a is UnknownObject => a !== null && typeof a === "object";

export const equals = (a: unknown, b: unknown): boolean =>
  isObject(a) && isObject(b) ? shallowEquals(a, b) : Object.is(a, b);
