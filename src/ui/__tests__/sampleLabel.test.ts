import { sampleLabel } from '../ResultsPanel';

describe('sampleLabel', () => {
  it('names only what is still sample data', () => {
    expect(sampleLabel(true, true)).toBe('Sample flights and delays');
    expect(sampleLabel(true, false)).toBe('Sample flights');
    expect(sampleLabel(false, true)).toBe('Sample delays');
    expect(sampleLabel(false, false)).toBeNull();
  });
});
