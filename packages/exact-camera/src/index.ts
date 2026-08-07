/** Exact value `numerator * 2^exponent`. Canonical values have an odd numerator. */
export type ExactDyadic = Readonly<{ numerator: bigint; exponent: bigint }>;

export type SerializedDyadic = Readonly<{ numerator: string; exponent: string }>;

export type ExactCamera = Readonly<{
  centerX: ExactDyadic;
  centerY: ExactDyadic;
  viewportScale: ExactDyadic;
  epoch: bigint;
}>;

export type SerializedCamera = Readonly<{
  schemaVersion: 1;
  centerX: SerializedDyadic;
  centerY: SerializedDyadic;
  viewportScale: SerializedDyadic;
  epoch: string;
}>;

export type WorldKey = Readonly<{
  formulaId: string;
  level: bigint;
  x: bigint;
  y: bigint;
  samplingVersion: number;
}>;

export function dyadic(numerator: bigint, exponent: bigint): ExactDyadic {
  if (numerator === 0n) return Object.freeze({ numerator: 0n, exponent: 0n });
  let n = numerator;
  let e = exponent;
  while ((n & 1n) === 0n) {
    n >>= 1n;
    e += 1n;
  }
  return Object.freeze({ numerator: n, exponent: e });
}

export function add(left: ExactDyadic, right: ExactDyadic): ExactDyadic {
  const exponent = left.exponent < right.exponent ? left.exponent : right.exponent;
  const leftShift = left.exponent - exponent;
  const rightShift = right.exponent - exponent;
  return dyadic((left.numerator << leftShift) + (right.numerator << rightShift), exponent);
}

export function negate(value: ExactDyadic): ExactDyadic {
  return dyadic(-value.numerator, value.exponent);
}

export function subtract(left: ExactDyadic, right: ExactDyadic): ExactDyadic {
  return add(left, negate(right));
}

export function multiply(left: ExactDyadic, right: ExactDyadic): ExactDyadic {
  return dyadic(left.numerator * right.numerator, left.exponent + right.exponent);
}

export function scalePowerOfTwo(value: ExactDyadic, exponentDelta: bigint): ExactDyadic {
  return dyadic(value.numerator, value.exponent + exponentDelta);
}

export function compare(left: ExactDyadic, right: ExactDyadic): -1 | 0 | 1 {
  const difference = subtract(left, right).numerator;
  return difference < 0n ? -1 : difference > 0n ? 1 : 0;
}

function floorDiv(numerator: bigint, positiveDenominator: bigint): bigint {
  const quotient = numerator / positiveDenominator;
  const remainder = numerator % positiveDenominator;
  return remainder < 0n ? quotient - 1n : quotient;
}

/** Mathematical floor of `value / 2^level`, including negative values. */
export function floorAtLevel(value: ExactDyadic, level: bigint): bigint {
  const shift = value.exponent - level;
  if (shift >= 0n) return value.numerator << shift;
  return floorDiv(value.numerator, 1n << -shift);
}

export function worldKey(
  formulaId: string,
  level: bigint,
  x: ExactDyadic,
  y: ExactDyadic,
  samplingVersion = 1,
): WorldKey {
  return Object.freeze({
    formulaId,
    level,
    x: floorAtLevel(x, level),
    y: floorAtLevel(y, level),
    samplingVersion,
  });
}

export function createCamera(
  centerX: ExactDyadic,
  centerY: ExactDyadic,
  viewportScale: ExactDyadic,
  epoch = 0n,
): ExactCamera {
  if (compare(viewportScale, dyadic(0n, 0n)) <= 0) {
    throw new RangeError("viewportScale must be positive");
  }
  return Object.freeze({ centerX, centerY, viewportScale, epoch });
}

/**
 * Zoom by an exact power of two about a focus expressed in viewport-scale units.
 * Positive `scaleExponentDelta` zooms out; negative values zoom in.
 */
export function zoomAbout(
  camera: ExactCamera,
  focusX: ExactDyadic,
  focusY: ExactDyadic,
  scaleExponentDelta: bigint,
): ExactCamera {
  const nextScale = scalePowerOfTwo(camera.viewportScale, scaleExponentDelta);
  const worldFocusX = add(camera.centerX, multiply(focusX, camera.viewportScale));
  const worldFocusY = add(camera.centerY, multiply(focusY, camera.viewportScale));
  return createCamera(
    subtract(worldFocusX, multiply(focusX, nextScale)),
    subtract(worldFocusY, multiply(focusY, nextScale)),
    nextScale,
    camera.epoch + 1n,
  );
}

export function pan(camera: ExactCamera, deltaX: ExactDyadic, deltaY: ExactDyadic): ExactCamera {
  return createCamera(
    add(camera.centerX, deltaX),
    add(camera.centerY, deltaY),
    camera.viewportScale,
    camera.epoch + 1n,
  );
}

export function serializeDyadic(value: ExactDyadic): SerializedDyadic {
  return { numerator: value.numerator.toString(), exponent: value.exponent.toString() };
}

export function deserializeDyadic(value: SerializedDyadic): ExactDyadic {
  if (!/^-?\d+$/.test(value.numerator) || !/^-?\d+$/.test(value.exponent)) {
    throw new TypeError("invalid dyadic encoding");
  }
  return dyadic(BigInt(value.numerator), BigInt(value.exponent));
}

export function serializeCamera(camera: ExactCamera): SerializedCamera {
  return {
    schemaVersion: 1,
    centerX: serializeDyadic(camera.centerX),
    centerY: serializeDyadic(camera.centerY),
    viewportScale: serializeDyadic(camera.viewportScale),
    epoch: camera.epoch.toString(),
  };
}

export function deserializeCamera(value: SerializedCamera): ExactCamera {
  if (value.schemaVersion !== 1 || !/^\d+$/.test(value.epoch)) {
    throw new TypeError("invalid camera encoding");
  }
  return createCamera(
    deserializeDyadic(value.centerX),
    deserializeDyadic(value.centerY),
    deserializeDyadic(value.viewportScale),
    BigInt(value.epoch),
  );
}
