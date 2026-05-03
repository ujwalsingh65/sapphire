import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { ema, macd, rsi, sma } from "./indicators.ts";

Deno.test("rsi returns 50 for insufficient data", () => {
  assertEquals(rsi([1, 2, 3]), 50);
});

Deno.test("rsi returns 100 when only gains", () => {
  const closes = Array.from({ length: 20 }, (_, i) => 100 + i);
  assertEquals(rsi(closes), 100);
});

Deno.test("rsi between 0 and 100", () => {
  const closes = [44, 47, 45, 50, 55, 53, 58, 60, 62, 61, 65, 70, 68, 72, 75, 78];
  const v = rsi(closes);
  assert(v >= 0 && v <= 100, `rsi out of range: ${v}`);
});

Deno.test("sma computes correct mean", () => {
  assertEquals(sma([1, 2, 3, 4, 5], 5), 3);
  assertEquals(sma([2, 4, 6], 3), 4);
});

Deno.test("sma returns last value when not enough data", () => {
  assertEquals(sma([1, 2], 5), 2);
});

Deno.test("ema length matches input and trends with data", () => {
  const series = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const out = ema(series, 3);
  assertEquals(out.length, series.length);
  assert(out[out.length - 1] > out[0], "ema should rise on rising series");
});

Deno.test("macd produces histogram = macd - signal", () => {
  const closes = Array.from({ length: 60 }, (_, i) => 100 + Math.sin(i / 5) * 5);
  const r = macd(closes);
  const diff = Math.abs(r.histogram - (r.macd - r.signal));
  assert(diff < 1e-9, `histogram mismatch: ${diff}`);
});