import { planeCenterAt, planePolygon, trailPolygon } from '../geometry';
import { BOX, LETTERS, TRAIL } from '../jauntMark';

describe('Jaunt wordmark shapes', () => {
  it('has the four letters and the t stem', () => {
    expect(LETTERS).toHaveLength(5);
  });

  it('draws the contrail rising to the right and widening toward the plane', () => {
    const band = trailPolygon(1);
    expect(TRAIL.head.x).toBeGreaterThan(TRAIL.tail.x);
    expect(TRAIL.head.y).toBeLessThan(TRAIL.tail.y);
    const tailW = Math.hypot(band[0].x - band[3].x, band[0].y - band[3].y);
    const headW = Math.hypot(band[1].x - band[2].x, band[1].y - band[2].y);
    expect(headW).toBeGreaterThan(tailW * 2);
    // An undrawn band has no length.
    const none = trailPolygon(0);
    expect((none[1].x + none[2].x) / 2).toBeCloseTo(TRAIL.tail.x, 5);
    expect((none[1].y + none[2].y) / 2).toBeCloseTo(TRAIL.tail.y, 5);
  });

  it('keeps the plane ahead of the band and inside the box', () => {
    const at = planeCenterAt(1);
    expect(at.x).toBeCloseTo(TRAIL.plane.x, 5);
    for (const p of planePolygon(at)) {
      expect(p.x).toBeLessThanOrEqual(BOX.maxX + 1);
      expect(p.y).toBeGreaterThanOrEqual(BOX.minY - 1);
    }
  });
});
